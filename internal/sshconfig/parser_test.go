package sshconfig

import (
	"os"
	"path/filepath"
	"termlet/internal/models"
	"testing"
)

func TestParseSSHConfig(t *testing.T) {
	tempDir := t.TempDir()
	configPath := filepath.Join(tempDir, "config")

	sampleConfig := `
# Global defaults
User developer
Port 22

Host vps1
    HostName 192.168.1.50
    User root
    Port 2222
    IdentityFile ~/.ssh/id_rsa
    LocalForward 8080 127.0.0.1:80

Host prod-api staging-api
    HostName api.example.com
    IdentityFile ~/.ssh/id_ed25519

Host *
    ServerAliveInterval 60
`

	if err := os.WriteFile(configPath, []byte(sampleConfig), 0600); err != nil {
		t.Fatalf("failed to write test config: %v", err)
	}

	profiles, err := ParseSSHConfig(configPath)
	if err != nil {
		t.Fatalf("ParseSSHConfig failed: %v", err)
	}

	if len(profiles) != 3 {
		t.Fatalf("expected 3 profiles (vps1, prod-api, staging-api), got %d", len(profiles))
	}

	// Verify vps1
	p1 := profiles[0]
	if p1.Name != "vps1" {
		t.Errorf("expected name vps1, got %s", p1.Name)
	}
	if p1.Host != "192.168.1.50" {
		t.Errorf("expected host 192.168.1.50, got %s", p1.Host)
	}
	if p1.Port != 2222 {
		t.Errorf("expected port 2222, got %d", p1.Port)
	}
	if p1.Username != "root" {
		t.Errorf("expected username root, got %s", p1.Username)
	}
	if p1.AuthMethod != models.AuthMethodPrivateKey {
		t.Errorf("expected private_key auth, got %s", p1.AuthMethod)
	}
	if len(p1.PortForwards) != 1 {
		t.Fatalf("expected 1 port forward for vps1, got %d", len(p1.PortForwards))
	}
	pf := p1.PortForwards[0]
	if pf.LocalPort != 8080 || pf.RemoteHost != "127.0.0.1" || pf.RemotePort != 80 {
		t.Errorf("unexpected port forward config: %+v", pf)
	}

	// Verify prod-api
	p2 := profiles[1]
	if p2.Name != "prod-api" {
		t.Errorf("expected name prod-api, got %s", p2.Name)
	}
	if p2.Host != "api.example.com" {
		t.Errorf("expected host api.example.com, got %s", p2.Host)
	}
	if p2.Username != "developer" { // Inherited from global defaults
		t.Errorf("expected username developer, got %s", p2.Username)
	}

	// Verify staging-api
	p3 := profiles[2]
	if p3.Name != "staging-api" {
		t.Errorf("expected name staging-api, got %s", p3.Name)
	}
}

func TestParseSSHConfigNonExistent(t *testing.T) {
	_, err := ParseSSHConfig("/path/to/non/existent/config")
	if err == nil {
		t.Fatal("expected error for non-existent file, got nil")
	}
}
