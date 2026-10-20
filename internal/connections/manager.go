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

// DroppedHandler is invoked when an active connection drops unexpectedly.
type DroppedHandler func(sessionID string, profile Profile, reason error)

// Manager coordinates all active SSH and SFTP connections.
type Manager struct {
	mu           sync.RWMutex
	sessions     map[string]*Session
	clientMgr    *sshclient.ClientManager
	profileStore *storage.ProfileStorage
	secretStore  *storage.SecretStorage
	onDropped    DroppedHandler
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

// SetDroppedHandler sets the listener called when a connection drops unexpectedly.
func (m *Manager) SetDroppedHandler(handler DroppedHandler) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.onDropped = handler
}

func (m *Manager) handleDropped(sessionID string, reason error) {
	m.mu.RLock()
	sess, exists := m.sessions[sessionID]
	var profile Profile
	if exists {
		profile = sess.Profile
	}
	handler := m.onDropped
	m.mu.RUnlock()

	if exists && handler != nil {
		handler(sessionID, profile, reason)
	}
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
	session.SetCachedSecret(password)

	// Start KeepAlive monitoring
	keepAliveSec := profile.KeepAliveInterval
	if keepAliveSec <= 0 {
		keepAliveSec = 20
	}
	session.StartKeepAlive(time.Duration(keepAliveSec)*time.Second, 5*time.Second, func(sid string, reason error) {
		m.handleDropped(sid, reason)
	})

	m.mu.Lock()
	m.sessions[sessionID] = session
	m.mu.Unlock()

	return session, nil, nil
}

// Reconnect re-establishes a dropped or existing session using cached or stored credentials.
func (m *Manager) Reconnect(ctx context.Context, sessionID string) (*Session, *models.HostKeyPrompt, error) {
	m.mu.RLock()
	sess, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return nil, nil, fmt.Errorf("session not found: %s", sessionID)
	}

	sess.mu.RLock()
	profile := sess.Profile
	cachedSecret := sess.cachedSecret
	sess.mu.RUnlock()

	if cachedSecret == "" && profile.ID != "" && m.secretStore != nil {
		savedSecret, _ := m.secretStore.GetSecret(profile.ID)
		if savedSecret != "" {
			cachedSecret = savedSecret
		}
	}

	authMethods, err := sshclient.BuildAuthMethods(string(profile.AuthMethod), profile.KeyPath, cachedSecret, cachedSecret)
	if err != nil {
		return nil, nil, fmt.Errorf("authentication error: %w", err)
	}

	res, err := m.clientMgr.Connect(ctx, profile.Host, profile.Port, profile.Username, authMethods, false, 15*time.Second)
	if err != nil {
		return nil, nil, err
	}

	if res.HostKeyPrompt != nil {
		return nil, res.HostKeyPrompt, nil
	}

	if res.Client == nil {
		return nil, nil, fmt.Errorf("failed to re-establish SSH connection")
	}

	sftpCl, err := sftpclient.NewClient(res.Client)
	if err != nil {
		_ = res.Client.Close()
		return nil, nil, fmt.Errorf("failed to re-initialize SFTP subsystem: %w", err)
	}

	sess.UpdateConnection(res.Client, sftpCl)

	keepAliveSec := profile.KeepAliveInterval
	if keepAliveSec <= 0 {
		keepAliveSec = 20
	}
	sess.StartKeepAlive(time.Duration(keepAliveSec)*time.Second, 5*time.Second, func(sid string, reason error) {
		m.handleDropped(sid, reason)
	})

	return sess, nil, nil
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

	// Close safely with timeout so Disconnect never blocks or hangs the application
	done := make(chan error, 1)
	go func() {
		done <- sess.Close()
	}()

	select {
	case err := <-done:
		return err
	case <-time.After(1500 * time.Millisecond):
		return nil
	}
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
