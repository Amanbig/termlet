package connections

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"termlet/internal/models"
	"termlet/internal/sftpclient"
	"termlet/internal/sshclient"
	"termlet/internal/storage"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"
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

// GetHostKeyManager returns the underlying HostKeyManager.
func (m *Manager) GetHostKeyManager() *sshclient.HostKeyManager {
	return m.clientMgr.GetHostKeyManager()
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

// resolveBastionClient establishes an SSH client connection to the bastion / jump host if specified.
func (m *Manager) resolveBastionClient(ctx context.Context, profile Profile, trustKey bool) (*ssh.Client, string, *models.HostKeyPrompt, error) {
	jumpProfileID := profile.JumpHostProfileID

	// Fallback to matching ProxyJump alias/hostname if JumpHostProfileID is empty
	if jumpProfileID == "" && profile.ProxyJump != "" && m.profileStore != nil {
		profiles, _ := m.profileStore.List()
		for _, p := range profiles {
			if strings.EqualFold(p.Name, profile.ProxyJump) || strings.EqualFold(p.Host, profile.ProxyJump) {
				jumpProfileID = p.ID
				break
			}
		}
	}

	if jumpProfileID == "" {
		return nil, "", nil, nil
	}

	if m.profileStore == nil {
		return nil, "", nil, fmt.Errorf("profile storage not initialized to resolve jump host")
	}

	jumpProfile, err := m.profileStore.Get(jumpProfileID)
	if err != nil {
		return nil, "", nil, fmt.Errorf("jump host profile (%s) not found: %w", jumpProfileID, err)
	}

	jumpProfile.Normalize()

	jumpSecret := ""
	if m.secretStore != nil {
		jumpSecret, _ = m.secretStore.GetSecret(jumpProfile.ID)
	}

	jumpAuth, err := sshclient.BuildAuthMethods(string(jumpProfile.AuthMethod), jumpProfile.KeyPath, jumpSecret, jumpSecret)
	if err != nil {
		return nil, "", nil, fmt.Errorf("jump host %s auth error: %w", jumpProfile.Name, err)
	}

	jumpRes, err := m.clientMgr.Connect(ctx, jumpProfile.Host, jumpProfile.Port, jumpProfile.Username, jumpAuth, trustKey, 15*time.Second)
	if err != nil {
		return nil, "", nil, fmt.Errorf("failed to connect to jump host %s (%s:%d): %w", jumpProfile.Name, jumpProfile.Host, jumpProfile.Port, err)
	}

	if jumpRes.HostKeyPrompt != nil {
		jumpRes.HostKeyPrompt.Hostname = fmt.Sprintf("%s (Jump Host: %s)", jumpRes.HostKeyPrompt.Hostname, jumpProfile.Name)
		return nil, "", jumpRes.HostKeyPrompt, nil
	}

	if jumpRes.Client == nil {
		return nil, "", nil, fmt.Errorf("failed to establish connection to jump host %s", jumpProfile.Name)
	}

	return jumpRes.Client, jumpProfile.Name, nil, nil
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

	// Resolve jump host if configured
	bastionCl, jumpName, prompt, err := m.resolveBastionClient(ctx, profile, trustKey)
	if err != nil {
		return nil, nil, err
	}
	if prompt != nil {
		return nil, prompt, nil
	}

	var res *sshclient.ConnectResult
	if bastionCl != nil {
		res, err = m.clientMgr.ConnectViaBastion(ctx, bastionCl, profile.Host, profile.Port, profile.Username, authMethods, trustKey, 15*time.Second)
		if err != nil {
			_ = bastionCl.Close()
			return nil, nil, err
		}
	} else {
		res, err = m.clientMgr.Connect(ctx, profile.Host, profile.Port, profile.Username, authMethods, trustKey, 15*time.Second)
		if err != nil {
			return nil, nil, err
		}
	}

	if res.HostKeyPrompt != nil {
		if bastionCl != nil {
			_ = bastionCl.Close()
		}
		// Host key needs user approval
		return nil, res.HostKeyPrompt, nil
	}

	if res.Client == nil {
		if bastionCl != nil {
			_ = bastionCl.Close()
		}
		return nil, nil, fmt.Errorf("failed to establish SSH connection")
	}

	// Initialize SFTP subsystem
	sftpCl, err := sftpclient.NewClient(res.Client)
	if err != nil {
		_ = res.Client.Close()
		if bastionCl != nil {
			_ = bastionCl.Close()
		}
		return nil, nil, fmt.Errorf("SFTP initialization failed: %w", err)
	}

	sessionID := uuid.New().String()
	session := NewSession(sessionID, profile, res.Client, sftpCl)
	if bastionCl != nil {
		session.SetBastion(bastionCl, jumpName)
	}
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

	// Resolve jump host if configured
	bastionCl, jumpName, prompt, err := m.resolveBastionClient(ctx, profile, false)
	if err != nil {
		return nil, nil, err
	}
	if prompt != nil {
		return nil, prompt, nil
	}

	var res *sshclient.ConnectResult
	if bastionCl != nil {
		res, err = m.clientMgr.ConnectViaBastion(ctx, bastionCl, profile.Host, profile.Port, profile.Username, authMethods, false, 15*time.Second)
		if err != nil {
			_ = bastionCl.Close()
			return nil, nil, err
		}
	} else {
		res, err = m.clientMgr.Connect(ctx, profile.Host, profile.Port, profile.Username, authMethods, false, 15*time.Second)
		if err != nil {
			return nil, nil, err
		}
	}

	if res.HostKeyPrompt != nil {
		if bastionCl != nil {
			_ = bastionCl.Close()
		}
		return nil, res.HostKeyPrompt, nil
	}

	if res.Client == nil {
		if bastionCl != nil {
			_ = bastionCl.Close()
		}
		return nil, nil, fmt.Errorf("failed to re-establish SSH connection")
	}

	sftpCl, err := sftpclient.NewClient(res.Client)
	if err != nil {
		_ = res.Client.Close()
		if bastionCl != nil {
			_ = bastionCl.Close()
		}
		return nil, nil, fmt.Errorf("failed to re-initialize SFTP subsystem: %w", err)
	}

	sess.UpdateConnection(res.Client, sftpCl, bastionCl)
	if jumpName != "" {
		sess.SetBastion(bastionCl, jumpName)
	}

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

// ExecCommand executes a command on the remote server for the given session and terminal tab.
func (m *Manager) ExecCommand(ctx context.Context, sessionID string, terminalID string, command string) (*models.RemoteExecResult, error) {
	sess, err := m.GetSession(sessionID)
	if err != nil {
		return nil, err
	}
	return sess.ExecCommand(ctx, command, terminalID)
}

// CancelCommand terminates the active command for the given session and terminal tab.
func (m *Manager) CancelCommand(sessionID string, terminalID string) error {
	m.mu.RLock()
	sess, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("session not found: %s", sessionID)
	}

	sess.CancelCommand(terminalID)
	return nil
}

// GetRemoteCwd retrieves the remote working directory for the session and terminal tab.
func (m *Manager) GetRemoteCwd(sessionID string, terminalID string) (string, error) {
	sess, err := m.GetSession(sessionID)
	if err != nil {
		return "", err
	}
	return sess.GetRemoteCwd(terminalID), nil
}

// SetRemoteCwd updates the remote working directory for the session and terminal tab.
func (m *Manager) SetRemoteCwd(sessionID string, terminalID string, cwd string) error {
	sess, err := m.GetSession(sessionID)
	if err != nil {
		return err
	}
	sess.SetRemoteCwd(cwd, terminalID)
	return nil
}

// StartTerminal initializes an interactive PTY shell session on the remote server.
func (m *Manager) StartTerminal(sessionID string, terminalID string, rows, cols int, onData func(string), onExit func()) error {
	sess, err := m.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.StartTerminal(terminalID, rows, cols, onData, onExit)
}

// SendTerminalInput delivers keystrokes/data to the remote PTY.
func (m *Manager) SendTerminalInput(sessionID string, terminalID string, data string) error {
	sess, err := m.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.SendTerminalInput(terminalID, data)
}

// ResizeTerminal notifies the remote PTY of terminal dimension changes.
func (m *Manager) ResizeTerminal(sessionID string, terminalID string, rows, cols int) error {
	sess, err := m.GetSession(sessionID)
	if err != nil {
		return err
	}
	return sess.ResizeTerminal(terminalID, rows, cols)
}

// CloseTerminal terminates and cleans up an individual terminal instance.
func (m *Manager) CloseTerminal(sessionID string, terminalID string) error {
	m.mu.RLock()
	sess, exists := m.sessions[sessionID]
	m.mu.RUnlock()

	if !exists {
		return nil
	}

	sess.CloseTerminal(terminalID)
	return nil
}
