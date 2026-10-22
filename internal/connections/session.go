package connections

import (
	"context"
	"fmt"
	"path/filepath"
	"strings"
	"sync"
	"termlet/internal/models"
	"termlet/internal/sftpclient"
	"time"

	"golang.org/x/crypto/ssh"
)

// DisconnectCallback is invoked when a session disconnects unexpectedly.
type DisconnectCallback func(sessionID string, reason error)

var interactiveCommands = map[string]string{
	"vim":   "text editor",
	"vi":    "text editor",
	"nvim":  "text editor",
	"nano":  "text editor",
	"pico":  "text editor",
	"emacs": "text editor",
	"top":   "interactive process monitor",
	"htop":  "interactive process monitor",
	"btop":  "interactive process monitor",
	"less":  "interactive pager",
	"more":  "interactive pager",
	"man":   "interactive manual pager",
	"watch": "interactive display monitor",
}

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

	// Terminal execution fields
	remoteCwdMu   sync.RWMutex
	remoteCwd     string
	activeCmdMu   sync.Mutex
	activeSSHSess *ssh.Session
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
	startDir := profile.StartDirectory
	if startDir == "" || startDir == "." {
		startDir = "~"
	}
	return &Session{
		ID:          id,
		Profile:     profile,
		SSH:         sshClient,
		SFTP:        sftpClient,
		ConnectedAt: now,
		LastActive:  now,
		remoteCwd:   startDir,
	}
}

// GetRemoteCwd returns the tracked remote working directory for the session.
func (s *Session) GetRemoteCwd() string {
	s.remoteCwdMu.RLock()
	defer s.remoteCwdMu.RUnlock()
	if s.remoteCwd == "" {
		return "~"
	}
	return s.remoteCwd
}

// SetRemoteCwd explicitly updates the remote working directory.
func (s *Session) SetRemoteCwd(cwd string) {
	s.remoteCwdMu.Lock()
	defer s.remoteCwdMu.Unlock()
	s.remoteCwd = strings.TrimSpace(cwd)
}

// CancelCommand cancels the currently executing command if one is in flight.
func (s *Session) CancelCommand() bool {
	s.activeCmdMu.Lock()
	defer s.activeCmdMu.Unlock()
	if s.activeSSHSess != nil {
		_ = s.activeSSHSess.Close()
		s.activeSSHSess = nil
		return true
	}
	return false
}

// ExecCommand executes a shell command on the remote SSH server while maintaining stateful cwd.
func (s *Session) ExecCommand(ctx context.Context, command string) (*models.RemoteExecResult, error) {
	trimmed := strings.TrimSpace(command)
	if trimmed == "" {
		return &models.RemoteExecResult{
			Cwd:      s.GetRemoteCwd(),
			ExitCode: 0,
		}, nil
	}

	if trimmed == "clear" {
		return &models.RemoteExecResult{
			Cwd:      s.GetRemoteCwd(),
			ExitCode: 0,
		}, nil
	}

	// Intercept known full-screen interactive TTY applications that cannot run without a PTY
	fields := strings.Fields(trimmed)
	if len(fields) > 0 {
		baseCmd := strings.ToLower(filepath.Base(fields[0]))
		if desc, isInteractive := interactiveCommands[baseCmd]; isInteractive {
			currentCwd := s.GetRemoteCwd()
			arg := ""
			if len(fields) > 1 {
				arg = fields[1]
			}
			hint := ""
			switch baseCmd {
			case "vim", "vi", "nvim", "nano", "pico", "emacs":
				if arg != "" {
					hint = fmt.Sprintf("\nTip: Termlet includes a built-in graphical code editor! Double-click '%s' in the Explorer or use Quick Open (Ctrl+P) to view and edit files directly, or use 'cat %s' to view contents.", arg, arg)
				} else {
					hint = "\nTip: Termlet includes a built-in graphical code editor! Double-click any file in the Explorer or use Quick Open (Ctrl+P) to edit files."
				}
			case "top", "htop", "btop":
				hint = "\nTip: For non-interactive process status, use 'ps aux' or 'top -b -n 1'."
			case "less", "more", "man":
				if arg != "" {
					hint = fmt.Sprintf("\nTip: View complete text non-interactively using 'cat %s'.", arg)
				} else {
					hint = "\nTip: Use 'cat <file>' to display text without an interactive pager."
				}
			}
			return &models.RemoteExecResult{
				Cwd:      currentCwd,
				ExitCode: 1,
				Error:    fmt.Sprintf("'%s' is an %s requiring an interactive TTY and cannot run inside an inline subshell.%s", baseCmd, desc, hint),
			}, nil
		}
	}

	s.mu.RLock()
	sshCl := s.SSH
	closed := s.closed || s.dropped
	s.mu.RUnlock()

	if closed || sshCl == nil {
		return nil, fmt.Errorf("session is not connected")
	}

	sshSess, err := sshCl.NewSession()
	if err != nil {
		return nil, fmt.Errorf("failed to open SSH channel: %w", err)
	}
	defer sshSess.Close()

	s.activeCmdMu.Lock()
	s.activeSSHSess = sshSess
	s.activeCmdMu.Unlock()

	defer func() {
		s.activeCmdMu.Lock()
		s.activeSSHSess = nil
		s.activeCmdMu.Unlock()
	}()

	done := make(chan struct{})
	defer close(done)

	go func() {
		select {
		case <-ctx.Done():
			_ = sshSess.Close()
		case <-done:
		}
	}()

	currentCwd := s.GetRemoteCwd()
	cdPrefix := ""
	if currentCwd != "" && currentCwd != "~" {
		cdPrefix = fmt.Sprintf("cd %q 2>/dev/null || cd ~;\n", currentCwd)
	} else {
		cdPrefix = "cd ~ 2>/dev/null || true;\n"
	}

	wrapperScript := fmt.Sprintf("%s%s\n__TERMLET_STATUS__=$?\nprintf \"\\n__TERMLET_CWD__:%%s\\n\" \"$(pwd -P 2>/dev/null || pwd)\"\nexit $__TERMLET_STATUS__", cdPrefix, trimmed)

	outBytes, execErr := sshSess.CombinedOutput(wrapperScript)

	rawOutput := string(outBytes)
	cwdMarker := "__TERMLET_CWD__:"
	newCwd := currentCwd
	cleanOutput := rawOutput
	exitCode := 0

	if idx := strings.LastIndex(rawOutput, cwdMarker); idx != -1 {
		cleanOutput = strings.TrimRight(rawOutput[:idx], "\r\n")
		cwdPart := strings.TrimSpace(rawOutput[idx+len(cwdMarker):])
		if lines := strings.Split(cwdPart, "\n"); len(lines) > 0 {
			extractedCwd := strings.TrimSpace(lines[0])
			if extractedCwd != "" {
				newCwd = extractedCwd
				s.SetRemoteCwd(newCwd)
			}
		}
	}

	var errMsg string
	if execErr != nil {
		if exitErr, ok := execErr.(*ssh.ExitError); ok {
			exitCode = exitErr.ExitStatus()
		} else {
			exitCode = 1
			if ctx != nil && ctx.Err() != nil {
				errMsg = "command cancelled or timed out"
			} else {
				errMsg = execErr.Error()
			}
		}
	}

	s.mu.Lock()
	s.LastActive = time.Now()
	s.mu.Unlock()

	return &models.RemoteExecResult{
		Output:   cleanOutput,
		Cwd:      newCwd,
		ExitCode: exitCode,
		Error:    errMsg,
	}, nil
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
