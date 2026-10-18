package sshclient

import (
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"sync"
	"termlet/internal/models"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/knownhosts"
)

// HostKeyManager handles verifying and trusting remote host public keys.
type HostKeyManager struct {
	mu             sync.Mutex
	appKnownHosts  string
	userKnownHosts string
}

// NewHostKeyManager creates a new HostKeyManager with standard paths.
func NewHostKeyManager() (*HostKeyManager, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}

	appDir := filepath.Join(homeDir, ".config", "termlet")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create config dir: %w", err)
	}

	appKnownHosts := filepath.Join(appDir, "known_hosts")
	if _, err := os.Stat(appKnownHosts); os.IsNotExist(err) {
		_ = os.WriteFile(appKnownHosts, []byte("# termlet known_hosts\n"), 0600)
	}

	userKnownHosts := filepath.Join(homeDir, ".ssh", "known_hosts")

	return &HostKeyManager{
		appKnownHosts:  appKnownHosts,
		userKnownHosts: userKnownHosts,
	}, nil
}

// VerifyHostKey verifies the key against known_hosts.
// If the key is trusted, it returns status "trusted" and no prompt.
// If unknown, it returns status "unknown" with a HostKeyPrompt.
// If changed/mismatched, it returns status "changed" with a HostKeyPrompt and error.
func (h *HostKeyManager) VerifyHostKey(hostname string, port int, remote net.Addr, key ssh.PublicKey) (*models.HostKeyPrompt, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	addr := net.JoinHostPort(hostname, fmt.Sprintf("%d", port))
	fingerprint := ssh.FingerprintSHA256(key)
	keyType := key.Type()

	var files []string
	if _, err := os.Stat(h.appKnownHosts); err == nil {
		files = append(files, h.appKnownHosts)
	}
	if _, err := os.Stat(h.userKnownHosts); err == nil {
		files = append(files, h.userKnownHosts)
	}

	if len(files) == 0 {
		return &models.HostKeyPrompt{
			Hostname:    hostname,
			Address:     addr,
			KeyType:     keyType,
			Fingerprint: fingerprint,
			Status:      "unknown",
			Message:     fmt.Sprintf("The authenticity of host '%s (%s)' can't be established.", hostname, addr),
		}, nil
	}

	checker, err := knownhosts.New(files...)
	if err != nil {
		return &models.HostKeyPrompt{
			Hostname:    hostname,
			Address:     addr,
			KeyType:     keyType,
			Fingerprint: fingerprint,
			Status:      "unknown",
			Message:     fmt.Sprintf("Error reading known_hosts: %v", err),
		}, nil
	}

	err = checker(addr, remote, key)
	if err == nil {
		return nil, nil // Trusted!
	}

	var keyErr *knownhosts.KeyError
	if errors.As(err, &keyErr) {
		if len(keyErr.Want) > 0 {
			// Host is known, but key has changed! Potential MITM attack!
			return &models.HostKeyPrompt{
				Hostname:    hostname,
				Address:     addr,
				KeyType:     keyType,
				Fingerprint: fingerprint,
				Status:      "changed",
				Message:     fmt.Sprintf("WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! Host key for %s does not match known_hosts records.", hostname),
			}, fmt.Errorf("host key verification failed: key for %s has changed", hostname)
		}

		// Host key is unknown/new
		return &models.HostKeyPrompt{
			Hostname:    hostname,
			Address:     addr,
			KeyType:     keyType,
			Fingerprint: fingerprint,
			Status:      "unknown",
			Message:     fmt.Sprintf("The authenticity of host '%s (%s)' can't be established. Key fingerprint is %s.", hostname, addr, fingerprint),
		}, nil
	}

	var revokedErr *knownhosts.RevokedError
	if errors.As(err, &revokedErr) {
		return &models.HostKeyPrompt{
			Hostname:    hostname,
			Address:     addr,
			KeyType:     keyType,
			Fingerprint: fingerprint,
			Status:      "changed",
			Message:     fmt.Sprintf("SECURITY ALERT: Host key for %s is REVOKED in known_hosts!", hostname),
		}, fmt.Errorf("host key is revoked")
	}

	// Default fallback to unknown
	return &models.HostKeyPrompt{
		Hostname:    hostname,
		Address:     addr,
		KeyType:     keyType,
		Fingerprint: fingerprint,
		Status:      "unknown",
		Message:     fmt.Sprintf("Unknown host key for '%s': %v", hostname, err),
	}, nil
}

// TrustHostKey appends the key to the app's known_hosts file.
func (h *HostKeyManager) TrustHostKey(hostname string, port int, key ssh.PublicKey) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	addr := net.JoinHostPort(hostname, fmt.Sprintf("%d", port))
	line := knownhosts.Line([]string{knownhosts.Normalize(addr)}, key)

	f, err := os.OpenFile(h.appKnownHosts, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0600)
	if err != nil {
		return fmt.Errorf("failed to open known_hosts for writing: %w", err)
	}
	defer f.Close()

	if _, err := f.WriteString(line + "\n"); err != nil {
		return fmt.Errorf("failed to write host key to known_hosts: %w", err)
	}

	return nil
}
