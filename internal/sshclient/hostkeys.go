package sshclient

import (
	"bufio"
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"net"
	"os"
	"path/filepath"
	"strings"
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

	return NewHostKeyManagerWithPaths(appKnownHosts, userKnownHosts)
}

// NewHostKeyManagerWithPaths creates a HostKeyManager with custom paths (useful for testing).
func NewHostKeyManagerWithPaths(appKnownHosts, userKnownHosts string) (*HostKeyManager, error) {
	return &HostKeyManager{
		appKnownHosts:  appKnownHosts,
		userKnownHosts: userKnownHosts,
	}, nil
}

// VerifyHostKey verifies the key against known_hosts.
// It checks Termlet's internal known_hosts first, then falls back to system known_hosts.
// If the key is trusted, it returns status "trusted" and no prompt.
// If unknown, it returns status "unknown" with a HostKeyPrompt.
// If changed/mismatched, it returns status "changed" with a HostKeyPrompt and error.
func (h *HostKeyManager) VerifyHostKey(hostname string, port int, remote net.Addr, key ssh.PublicKey) (*models.HostKeyPrompt, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	addr := net.JoinHostPort(hostname, fmt.Sprintf("%d", port))
	fingerprint := ssh.FingerprintSHA256(key)
	keyType := key.Type()

	// 1. Check Termlet app known_hosts first
	if _, err := os.Stat(h.appKnownHosts); err == nil {
		checker, err := knownhosts.New(h.appKnownHosts)
		if err == nil {
			err = checker(addr, remote, key)
			if err == nil {
				return nil, nil // Trusted in Termlet!
			}

			var keyErr *knownhosts.KeyError
			if errors.As(err, &keyErr) && len(keyErr.Want) > 0 {
				return &models.HostKeyPrompt{
					Hostname:    hostname,
					Address:     addr,
					KeyType:     keyType,
					Fingerprint: fingerprint,
					Status:      "changed",
					Message:     fmt.Sprintf("WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! Host key for %s does not match known_hosts records.", hostname),
				}, fmt.Errorf("host key verification failed: key for %s has changed", hostname)
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
		}
	}

	// 2. Check System known_hosts (~/.ssh/known_hosts)
	if _, err := os.Stat(h.userKnownHosts); err == nil {
		checker, err := knownhosts.New(h.userKnownHosts)
		if err == nil {
			err = checker(addr, remote, key)
			if err == nil {
				return nil, nil // Trusted in system known_hosts!
			}

			var keyErr *knownhosts.KeyError
			if errors.As(err, &keyErr) && len(keyErr.Want) > 0 {
				return &models.HostKeyPrompt{
					Hostname:    hostname,
					Address:     addr,
					KeyType:     keyType,
					Fingerprint: fingerprint,
					Status:      "changed",
					Message:     fmt.Sprintf("WARNING: REMOTE HOST IDENTIFICATION HAS CHANGED! Host key for %s does not match system known_hosts records.", hostname),
				}, fmt.Errorf("host key verification failed: key for %s has changed", hostname)
			}

			var revokedErr *knownhosts.RevokedError
			if errors.As(err, &revokedErr) {
				return &models.HostKeyPrompt{
					Hostname:    hostname,
					Address:     addr,
					KeyType:     keyType,
					Fingerprint: fingerprint,
					Status:      "changed",
					Message:     fmt.Sprintf("SECURITY ALERT: Host key for %s is REVOKED in system known_hosts!", hostname),
				}, fmt.Errorf("host key is revoked")
			}
		}
	}

	// 3. Host key is unknown / first-time connection
	return &models.HostKeyPrompt{
		Hostname:    hostname,
		Address:     addr,
		KeyType:     keyType,
		Fingerprint: fingerprint,
		Status:      "unknown",
		Message:     fmt.Sprintf("The authenticity of host '%s (%s)' can't be established. Key fingerprint is %s.", hostname, addr, fingerprint),
	}, nil
}

// TrustHostKey appends or replaces the key in the app's known_hosts file.
func (h *HostKeyManager) TrustHostKey(hostname string, port int, key ssh.PublicKey) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	addr := net.JoinHostPort(hostname, fmt.Sprintf("%d", port))

	// Ensure parent dir exists
	dir := filepath.Dir(h.appKnownHosts)
	if err := os.MkdirAll(dir, 0700); err != nil {
		return fmt.Errorf("failed to create dir: %w", err)
	}

	// Remove any existing entries for this host first to prevent duplicates/conflicts
	_ = h.removeHostLocked(h.appKnownHosts, addr)

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

// ListKnownHosts parses and returns all host keys from both Termlet and System known_hosts files.
func (h *HostKeyManager) ListKnownHosts() ([]models.KnownHostEntry, error) {
	h.mu.Lock()
	defer h.mu.Unlock()

	var entries []models.KnownHostEntry

	// Read Termlet known_hosts
	if termletEntries, err := h.parseFile(h.appKnownHosts, "termlet"); err == nil {
		entries = append(entries, termletEntries...)
	}

	// Read System known_hosts
	if sysEntries, err := h.parseFile(h.userKnownHosts, "system"); err == nil {
		entries = append(entries, sysEntries...)
	}

	return entries, nil
}

func (h *HostKeyManager) parseFile(filePath string, source string) ([]models.KnownHostEntry, error) {
	data, err := os.ReadFile(filePath)
	if err != nil {
		return nil, err
	}

	var results []models.KnownHostEntry
	scanner := bufio.NewScanner(bytes.NewReader(data))
	lineNum := 0

	for scanner.Scan() {
		lineNum++
		raw := strings.TrimSpace(scanner.Text())
		if raw == "" || strings.HasPrefix(raw, "#") {
			continue
		}

		_, hosts, pubKey, comment, _, err := ssh.ParseKnownHosts([]byte(raw))
		if err != nil || pubKey == nil {
			continue
		}

		hostStr := strings.Join(hosts, ", ")
		pubKeyB64 := base64.StdEncoding.EncodeToString(pubKey.Marshal())
		fp := ssh.FingerprintSHA256(pubKey)

		results = append(results, models.KnownHostEntry{
			Host:        hostStr,
			KeyType:     pubKey.Type(),
			Fingerprint: fp,
			PublicKey:   pubKeyB64,
			Comment:     comment,
			Source:      source,
			LineNumber:  lineNum,
		})
	}

	return results, nil
}

// RemoveKnownHost removes all entries matching the given host target from the specified source.
func (h *HostKeyManager) RemoveKnownHost(source string, host string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	targetFile := h.appKnownHosts
	if source == "system" {
		targetFile = h.userKnownHosts
	}

	return h.removeHostLocked(targetFile, host)
}

// RemoveKnownHostByLine removes the entry at a specific 1-based line number in the specified source file.
func (h *HostKeyManager) RemoveKnownHostByLine(source string, lineNum int) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	targetFile := h.appKnownHosts
	if source == "system" {
		targetFile = h.userKnownHosts
	}

	data, err := os.ReadFile(targetFile)
	if err != nil {
		return fmt.Errorf("failed to read %s: %w", targetFile, err)
	}

	scanner := bufio.NewScanner(bytes.NewReader(data))
	var remaining []string
	currentLine := 0

	for scanner.Scan() {
		currentLine++
		if currentLine == lineNum {
			continue // Drop this line
		}
		remaining = append(remaining, scanner.Text())
	}

	content := strings.Join(remaining, "\n")
	if len(remaining) > 0 {
		content += "\n"
	}

	return os.WriteFile(targetFile, []byte(content), 0600)
}

// ClearKnownHosts clears all entries from the specified source (resets Termlet file to header).
func (h *HostKeyManager) ClearKnownHosts(source string) error {
	h.mu.Lock()
	defer h.mu.Unlock()

	targetFile := h.appKnownHosts
	header := "# termlet known_hosts\n"
	if source == "system" {
		targetFile = h.userKnownHosts
		header = "# known_hosts\n"
	}

	return os.WriteFile(targetFile, []byte(header), 0600)
}

func (h *HostKeyManager) removeHostLocked(filePath string, targetHost string) error {
	data, err := os.ReadFile(filePath)
	if err != nil {
		if os.IsNotExist(err) {
			return nil
		}
		return err
	}

	scanner := bufio.NewScanner(bytes.NewReader(data))
	var remaining []string
	normTarget := knownhosts.Normalize(targetHost)

	for scanner.Scan() {
		raw := scanner.Text()
		trimmed := strings.TrimSpace(raw)
		if trimmed == "" || strings.HasPrefix(trimmed, "#") {
			remaining = append(remaining, raw)
			continue
		}

		_, hosts, _, _, _, err := ssh.ParseKnownHosts([]byte(trimmed))
		if err != nil {
			remaining = append(remaining, raw)
			continue
		}

		matched := false
		for _, h := range hosts {
			if h == targetHost || h == normTarget || knownhosts.Normalize(h) == normTarget {
				matched = true
				break
			}
		}

		if !matched {
			remaining = append(remaining, raw)
		}
	}

	content := strings.Join(remaining, "\n")
	if len(remaining) > 0 {
		content += "\n"
	}

	return os.WriteFile(filePath, []byte(content), 0600)
}
