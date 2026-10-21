package sshclient

import (
	"crypto/ed25519"
	"crypto/rand"
	"net"
	"os"
	"path/filepath"
	"testing"

	"golang.org/x/crypto/ssh"
)

func generateTestKey(t *testing.T) ssh.PublicKey {
	t.Helper()
	pub, _, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("failed to generate ed25519 key: %v", err)
	}
	sshPub, err := ssh.NewPublicKey(pub)
	if err != nil {
		t.Fatalf("failed to create ssh.PublicKey: %v", err)
	}
	return sshPub
}

func TestHostKeyManager(t *testing.T) {
	tempDir := t.TempDir()
	appKH := filepath.Join(tempDir, "termlet_known_hosts")
	userKH := filepath.Join(tempDir, "user_known_hosts")

	_ = os.WriteFile(appKH, []byte("# termlet known_hosts\n"), 0600)
	_ = os.WriteFile(userKH, []byte("# user known_hosts\n"), 0600)

	hkm, err := NewHostKeyManagerWithPaths(appKH, userKH)
	if err != nil {
		t.Fatalf("NewHostKeyManagerWithPaths failed: %v", err)
	}

	key1 := generateTestKey(t)
	dummyAddr, _ := net.ResolveTCPAddr("tcp", "192.168.1.100:22")

	// 1. Initial check: unknown host
	prompt, err := hkm.VerifyHostKey("192.168.1.100", 22, dummyAddr, key1)
	if err != nil {
		t.Fatalf("expected nil error on unknown key, got: %v", err)
	}
	if prompt == nil || prompt.Status != "unknown" {
		t.Fatalf("expected unknown prompt, got: %+v", prompt)
	}

	// 2. Trust host key
	err = hkm.TrustHostKey("192.168.1.100", 22, key1)
	if err != nil {
		t.Fatalf("TrustHostKey failed: %v", err)
	}

	// 3. Second check: should now be trusted!
	prompt, err = hkm.VerifyHostKey("192.168.1.100", 22, dummyAddr, key1)
	if err != nil {
		t.Fatalf("expected nil error on trusted key, got: %v", err)
	}
	if prompt != nil {
		t.Fatalf("expected nil prompt on trusted key, got: %+v", prompt)
	}

	// 4. Changed key attack check: different key for same host
	key2 := generateTestKey(t)
	prompt, err = hkm.VerifyHostKey("192.168.1.100", 22, dummyAddr, key2)
	if err == nil {
		t.Fatalf("expected error on changed host key, got nil")
	}
	if prompt == nil || prompt.Status != "changed" {
		t.Fatalf("expected changed status prompt, got: %+v", prompt)
	}

	// 5. List known hosts
	entries, err := hkm.ListKnownHosts()
	if err != nil {
		t.Fatalf("ListKnownHosts failed: %v", err)
	}
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}
	if entries[0].Host != "192.168.1.100" || entries[0].Source != "termlet" {
		t.Errorf("unexpected entry: %+v", entries[0])
	}
	if entries[0].Fingerprint != ssh.FingerprintSHA256(key1) {
		t.Errorf("fingerprint mismatch: got %s, want %s", entries[0].Fingerprint, ssh.FingerprintSHA256(key1))
	}

	// 6. Overwrite / trust the new key
	err = hkm.TrustHostKey("192.168.1.100", 22, key2)
	if err != nil {
		t.Fatalf("re-trust failed: %v", err)
	}

	entriesAfterReTrust, err := hkm.ListKnownHosts()
	if err != nil {
		t.Fatalf("ListKnownHosts failed: %v", err)
	}
	if len(entriesAfterReTrust) != 1 {
		t.Fatalf("expected 1 entry after re-trust (no duplicate), got %d", len(entriesAfterReTrust))
	}
	if entriesAfterReTrust[0].Fingerprint != ssh.FingerprintSHA256(key2) {
		t.Errorf("expected updated fingerprint, got %s", entriesAfterReTrust[0].Fingerprint)
	}

	// 7. Remove host
	err = hkm.RemoveKnownHost("termlet", "192.168.1.100:22")
	if err != nil {
		t.Fatalf("RemoveKnownHost failed: %v", err)
	}

	entriesAfterRemove, err := hkm.ListKnownHosts()
	if err != nil {
		t.Fatalf("ListKnownHosts failed: %v", err)
	}
	if len(entriesAfterRemove) != 0 {
		t.Fatalf("expected 0 entries after remove, got %d", len(entriesAfterRemove))
	}
}

func TestClearKnownHosts(t *testing.T) {
	tempDir := t.TempDir()
	appKH := filepath.Join(tempDir, "termlet_known_hosts")
	userKH := filepath.Join(tempDir, "user_known_hosts")

	_ = os.WriteFile(appKH, []byte("# termlet known_hosts\n"), 0600)
	_ = os.WriteFile(userKH, []byte("# user known_hosts\n"), 0600)

	hkm, err := NewHostKeyManagerWithPaths(appKH, userKH)
	if err != nil {
		t.Fatalf("NewHostKeyManagerWithPaths failed: %v", err)
	}

	key := generateTestKey(t)
	_ = hkm.TrustHostKey("myserver.test", 22, key)

	entries, _ := hkm.ListKnownHosts()
	if len(entries) != 1 {
		t.Fatalf("expected 1 entry, got %d", len(entries))
	}

	if err := hkm.ClearKnownHosts("termlet"); err != nil {
		t.Fatalf("ClearKnownHosts failed: %v", err)
	}

	entriesCleared, _ := hkm.ListKnownHosts()
	if len(entriesCleared) != 0 {
		t.Fatalf("expected 0 entries after clear, got %d", len(entriesCleared))
	}
}
