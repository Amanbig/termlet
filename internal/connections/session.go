package connections

import (
	"fmt"
	"sync"
	"termlet/internal/sftpclient"
	"time"

	"golang.org/x/crypto/ssh"
)

// Session represents an active connection to an SSH server with an SFTP subsystem.
type Session struct {
	mu          sync.RWMutex
	ID          string
	Profile     Profile
	SSH         *ssh.Client
	SFTP        *sftpclient.Client
	ConnectedAt time.Time
	LastActive  time.Time
	closed      bool
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

// Close safely shuts down the SFTP and SSH clients.
func (s *Session) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if s.closed {
		return nil
	}
	s.closed = true

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

	if s.closed || s.SSH == nil || s.SFTP == nil {
		return false
	}

	// Quick check using SFTP alive check
	return s.SFTP.IsAlive()
}

// GetSFTP returns the active SFTP client, or an error if the session is closed.
func (s *Session) GetSFTP() (*sftpclient.Client, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if s.closed || s.SFTP == nil {
		return nil, fmt.Errorf("session %s is closed or inactive", s.ID)
	}

	s.LastActive = time.Now()
	return s.SFTP, nil
}

// Summary returns a lightweight representation for the UI.
func (s *Session) Summary() SessionSummary {
	s.mu.RLock()
	defer s.mu.RUnlock()

	return SessionSummary{
		ID:             s.ID,
		ProfileID:      s.Profile.ID,
		ProfileName:    s.Profile.Name,
		Host:           s.Profile.Host,
		Port:           s.Profile.Port,
		Username:       s.Profile.Username,
		ConnectedAt:    s.ConnectedAt.Unix(),
		StartDirectory: s.Profile.StartDirectory,
		IsAlive:        !s.closed && s.SFTP != nil && s.SFTP.IsAlive(),
	}
}
