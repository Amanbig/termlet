package connections

import (
	"context"
	"fmt"
	"sync"
	"termlet/internal/models"
	"termlet/internal/sftpclient"
	"termlet/internal/sshclient"
	"termlet/internal/storage"
	"time"

	"github.com/google/uuid"
)

// Manager coordinates all active SSH and SFTP connections.
type Manager struct {
	mu           sync.RWMutex
	sessions     map[string]*Session
	clientMgr    *sshclient.ClientManager
	profileStore *storage.ProfileStorage
	secretStore  *storage.SecretStorage
}

// NewManager creates an instance of Manager.
func NewManager(profileStore *storage.ProfileStorage, secretStore *storage.SecretStorage) (*Manager, error) {
	cm, err := sshclient.NewClientManager()
	if err != nil {
		return nil, fmt.Errorf("failed to init client manager: %w", err)
	}

	return &Manager{
		sessions:     make(map[string]*Session),
		clientMgr:    cm,
		profileStore: profileStore,
		secretStore:  secretStore,
	}, nil
}

// Connect establishes a connection using the provided profile and optional credentials.
func (m *Manager) Connect(ctx context.Context, profile Profile, password string, trustKey bool) (*Session, *models.HostKeyPrompt, error) {
	profile.Normalize()

	// If no password provided, check secret storage
	if password == "" && profile.ID != "" && m.secretStore != nil {
		savedSecret, _ := m.secretStore.GetSecret(profile.ID)
		if savedSecret != "" {
			password = savedSecret
		}
	}

	authMethods, err := sshclient.BuildAuthMethods(string(profile.AuthMethod), profile.KeyPath, password, password)
	if err != nil {
		return nil, nil, fmt.Errorf("authentication configuration error: %w", err)
	}

	// Connect SSH with host key inspection
	res, err := m.clientMgr.Connect(ctx, profile.Host, profile.Port, profile.Username, authMethods, trustKey, 15*time.Second)
	if err != nil {
		return nil, nil, err
	}

	if res.HostKeyPrompt != nil {
		// Host key needs user approval
		return nil, res.HostKeyPrompt, nil
	}

	if res.Client == nil {
		return nil, nil, fmt.Errorf("failed to establish SSH connection")
	}

	// Initialize SFTP subsystem
	sftpCl, err := sftpclient.NewClient(res.Client)
	if err != nil {
		_ = res.Client.Close()
		return nil, nil, fmt.Errorf("SFTP initialization failed: %w", err)
	}

	sessionID := uuid.New().String()
	session := NewSession(sessionID, profile, res.Client, sftpCl)

	m.mu.Lock()
	m.sessions[sessionID] = session
	m.mu.Unlock()

	return session, nil, nil
}

// GetSession retrieves an active session by its ID.
func (m *Manager) GetSession(sessionID string) (*Session, error) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	sess, exists := m.sessions[sessionID]
	if !exists {
		return nil, fmt.Errorf("session not found: %s", sessionID)
	}

	if !sess.IsAlive() {
		return nil, fmt.Errorf("session %s is disconnected", sessionID)
	}

	return sess, nil
}

// Disconnect terminates and removes a session.
func (m *Manager) Disconnect(sessionID string) error {
	m.mu.Lock()
	sess, exists := m.sessions[sessionID]
	delete(m.sessions, sessionID)
	m.mu.Unlock()

	if !exists {
		return nil
	}

	return sess.Close()
}

// ListSessions returns summaries of all active sessions.
func (m *Manager) ListSessions() []SessionSummary {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var list []SessionSummary
	for _, s := range m.sessions {
		list = append(list, s.Summary())
	}
	return list
}

// CloseAll cleanly terminates all active sessions.
func (m *Manager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, s := range m.sessions {
		_ = s.Close()
		delete(m.sessions, id)
	}
}
