package connections

import (
	"context"
	"fmt"
	"sync"
	"termlet/internal/sftpclient"
	"time"

	"golang.org/x/crypto/ssh"
)

// DisconnectCallback is invoked when a session disconnects unexpectedly.
type DisconnectCallback func(sessionID string, reason error)

// Session represents an active connection to an SSH server with an SFTP subsystem.
type Session struct {
	mu              sync.RWMutex
	ID              string
	Profile         Profile
	SSH             *ssh.Client
	SFTP            *sftpclient.Client
	ConnectedAt     time.Time
	LastActive      time.Time
	closed          bool
	dropped         bool
	cachedSecret    string
	cancelKeepAlive context.CancelFunc
	onDisconnect    DisconnectCallback
}

// SessionSummary provides a view of an active session suitable for UI presentation.
type SessionSummary struct {
	ID             string `json:"id"`
	ProfileID      string `json:"profile_id"`
	ProfileName    string `json:"profile_name"`
	Host           string `json:"host"`
	Port           int    `json:"port"`
	Username       string `json:"username"`
	ConnectedAt    int64  `json:"connected_at"`
	StartDirectory string `json:"start_directory"`
	IsAlive        bool   `json:"is_alive"`
	Status         string `json:"status"` // "connected" | "disconnected" | "dropped"
	AutoReconnect  bool   `json:"auto_reconnect"`
}

// NewSession creates a new initialized Session.
func NewSession(id string, profile Profile, sshClient *ssh.Client, sftpClient *sftpclient.Client) *Session {
	now := time.Now()
	return &Session{
		ID:          id,
		Profile:     profile,
		SSH:         sshClient,
		SFTP:        sftpClient,
		ConnectedAt: now,
		LastActive:  now,
	}
}

// SetCachedSecret stores the credentials in memory for the session lifespan to allow reconnecting.
func (s *Session) SetCachedSecret(secret string) {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.cachedSecret = secret
}

// GetCachedSecret retrieves the in-memory cached credentials.
func (s *Session) GetCachedSecret() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.cachedSecret
}

// StartKeepAlive initiates a background keepalive goroutine using OpenSSH global requests.
func (s *Session) StartKeepAlive(interval time.Duration, timeout time.Duration, onDisconnect DisconnectCallback) {
	s.mu.Lock()
	if s.cancelKeepAlive != nil {
		s.cancelKeepAlive()
	}
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelKeepAlive = cancel
	s.onDisconnect = onDisconnect
	s.mu.Unlock()

	if interval <= 0 {
		interval = 20 * time.Second
	}
	if timeout <= 0 {
		timeout = 5 * time.Second
	}

	go s.keepAliveLoop(ctx, interval, timeout)
}

// StopKeepAlive stops the periodic keepalive loop.
func (s *Session) StopKeepAlive() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cancelKeepAlive != nil {
		s.cancelKeepAlive()
		s.cancelKeepAlive = nil
	}
}

func (s *Session) keepAliveLoop(ctx context.Context, interval time.Duration, timeout time.Duration) {
	ticker := time.NewTicker(interval)
	defer ticker.Stop()

	missedCount := 0
	const maxMissed = 3

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			s.mu.RLock()
			isDone := s.closed || s.dropped
			client := s.SSH
			s.mu.RUnlock()

			if isDone || client == nil {
				return
			}

			// OpenSSH keepalive request
			errCh := make(chan error, 1)
			go func() {
				// keepalive@openssh.com expects a reply. If connection is alive, it returns nil or rejection with err=nil.
				_, _, err := client.SendRequest("keepalive@openssh.com", true, nil)
				errCh <- err
			}()

			var probeErr error
			select {
			case probeErr = <-errCh:
			case <-time.After(timeout):
				probeErr = fmt.Errorf("keepalive request timed out after %v", timeout)
			case <-ctx.Done():
				return
			}

			if probeErr != nil {
				missedCount++
				if missedCount >= maxMissed {
					s.MarkDropped(probeErr)
					return
				}
			} else {
				missedCount = 0
				s.mu.Lock()
				s.LastActive = time.Now()
				s.mu.Unlock()
			}
		}
	}
}

// MarkDropped flags the session as unexpectedly lost, closes client resources, and triggers onDisconnect.
func (s *Session) MarkDropped(reason error) {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return
	}
	s.closed = true
	s.dropped = true
	if s.cancelKeepAlive != nil {
		s.cancelKeepAlive()
		s.cancelKeepAlive = nil
	}
	cb := s.onDisconnect
	s.mu.Unlock()

	if s.SFTP != nil {
		_ = s.SFTP.Close()
	}
	if s.SSH != nil {
		_ = s.SSH.Close()
	}

	if cb != nil {
		cb(s.ID, reason)
	}
}

// UpdateConnection updates active SSH and SFTP handles upon reconnect.
func (s *Session) UpdateConnection(sshClient *ssh.Client, sftpClient *sftpclient.Client) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.SFTP != nil {
		_ = s.SFTP.Close()
	}
	if s.SSH != nil {
		_ = s.SSH.Close()
	}

	s.SSH = sshClient
	s.SFTP = sftpClient
	s.closed = false
	s.dropped = false
	s.ConnectedAt = time.Now()
	s.LastActive = time.Now()
}

// Close safely shuts down the SFTP and SSH clients cleanly.
func (s *Session) Close() error {
	s.mu.Lock()
	if s.closed {
		s.mu.Unlock()
		return nil
	}
	s.closed = true
	if s.cancelKeepAlive != nil {
		s.cancelKeepAlive()
		s.cancelKeepAlive = nil
	}
	s.mu.Unlock()

	var errs []error
	if s.SFTP != nil {
		if err := s.SFTP.Close(); err != nil {
			errs = append(errs, err)
		}
	}
	if s.SSH != nil {
		if err := s.SSH.Close(); err != nil {
			errs = append(errs, err)
		}
	}

	if len(errs) > 0 {
		return fmt.Errorf("errors closing session: %v", errs)
	}
	return nil
}

// IsAlive checks if both SSH and SFTP layers are still responsive.
func (s *Session) IsAlive() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.closed || s.dropped || s.SSH == nil || s.SFTP == nil {
		return false
	}

	// Quick check using SFTP alive check
	return s.SFTP.IsAlive()
}

// IsDropped checks whether the session was terminated due to a network drop.
func (s *Session) IsDropped() bool {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.dropped
}

// GetSFTP returns the active SFTP client, or an error if the session is closed.
func (s *Session) GetSFTP() (*sftpclient.Client, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.closed || s.dropped || s.SFTP == nil {
		return nil, fmt.Errorf("session %s is closed or disconnected", s.ID)
	}

	s.LastActive = time.Now()
	return s.SFTP, nil
}

// Summary returns a lightweight representation for the UI.
func (s *Session) Summary() SessionSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	isAlive := !s.closed && !s.dropped && s.SFTP != nil && s.SFTP.IsAlive()
	status := "connected"
	if s.dropped {
		status = "dropped"
	} else if s.closed || !isAlive {
		status = "disconnected"
	}

	return SessionSummary{
		ID:             s.ID,
		ProfileID:      s.Profile.ID,
		ProfileName:    s.Profile.Name,
		Host:           s.Profile.Host,
		Port:           s.Profile.Port,
		Username:       s.Profile.Username,
		ConnectedAt:    s.ConnectedAt.Unix(),
		StartDirectory: s.Profile.StartDirectory,
		IsAlive:        isAlive,
		Status:         status,
		AutoReconnect:  s.Profile.AutoReconnect,
	}
}
