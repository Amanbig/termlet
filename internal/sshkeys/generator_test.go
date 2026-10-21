package sshkeys

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
	"termlet/internal/models"
)

func TestGenerateSSHKeyEd25519(t *testing.T) {
	req := models.GenerateSSHKeyRequest{
		Type:       "ed25519",
		Comment:    "test@termlet",
		SaveToDisk: false,
	}

	key, err := GenerateSSHKey(req)
	if err != nil {
		t.Fatalf("GenerateSSHKey ed25519 failed: %v", err)
	}

	if !strings.HasPrefix(key.PublicKey, "ssh-ed25519 ") {
		t.Errorf("expected public key to start with ssh-ed25519, got: %s", key.PublicKey)
	}
	if !strings.Contains(key.PublicKey, "test@termlet") {
		t.Errorf("expected public key to contain comment, got: %s", key.PublicKey)
	}
	if !strings.HasPrefix(key.PrivateKey, "-----BEGIN OPENSSH PRIVATE KEY-----") {
		t.Errorf("expected private key to be OpenSSH format, got: %s", key.PrivateKey)
	}
	if !strings.HasPrefix(key.Fingerprint, "SHA256:") {
		t.Errorf("expected SHA256 fingerprint, got: %s", key.Fingerprint)
	}
	if len(key.Randomart) == 0 {
		t.Errorf("expected randomart to be generated")
	}
	if key.Bits != 256 {
		t.Errorf("expected bits 256, got: %d", key.Bits)
	}
}

func TestGenerateSSHKeyWithPassphrase(t *testing.T) {
	req := models.GenerateSSHKeyRequest{
		Type:       "ed25519",
		Comment:    "encrypted@termlet",
		Passphrase: "secret-passphrase-123",
		SaveToDisk: false,
	}

	key, err := GenerateSSHKey(req)
	if err != nil {
		t.Fatalf("GenerateSSHKey with passphrase failed: %v", err)
	}

	// Verify that the private key is encrypted
	if !isPrivateKeyEncrypted([]byte(key.PrivateKey)) {
		t.Errorf("expected private key to be marked as encrypted")
	}
}

func TestGenerateSSHKeyRSA(t *testing.T) {
	req := models.GenerateSSHKeyRequest{
		Type:       "rsa",
		Bits:       2048,
		Comment:    "rsa-test@termlet",
		SaveToDisk: false,
	}

	key, err := GenerateSSHKey(req)
	if err != nil {
		t.Fatalf("GenerateSSHKey rsa failed: %v", err)
	}

	if !strings.HasPrefix(key.PublicKey, "ssh-rsa ") {
		t.Errorf("expected public key to start with ssh-rsa, got: %s", key.PublicKey)
	}
	if key.Bits != 2048 {
		t.Errorf("expected 2048 bits, got: %d", key.Bits)
	}
}

func TestGenerateSSHKeyECDSA(t *testing.T) {
	req := models.GenerateSSHKeyRequest{
		Type:       "ecdsa",
		Bits:       256,
		Comment:    "ecdsa-test@termlet",
		SaveToDisk: false,
	}

	key, err := GenerateSSHKey(req)
	if err != nil {
		t.Fatalf("GenerateSSHKey ecdsa failed: %v", err)
	}

	if !strings.HasPrefix(key.PublicKey, "ecdsa-sha2-nistp256 ") {
		t.Errorf("expected public key to start with ecdsa-sha2-nistp256, got: %s", key.PublicKey)
	}
}

func TestSaveAndListLocalKeys(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "termlet_sshkeys_test")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	targetFile := filepath.Join(tempDir, "id_test_ed25519")

	req := models.GenerateSSHKeyRequest{
		Type:           "ed25519",
		Comment:        "tester@localhost",
		SaveToDisk:     true,
		TargetFilename: targetFile,
	}

	key, err := GenerateSSHKey(req)
	if err != nil {
		t.Fatalf("GenerateSSHKey save failed: %v", err)
	}

	if key.SavedPath != targetFile {
		t.Errorf("expected saved path %s, got: %s", targetFile, key.SavedPath)
	}

	// List keys in tempDir
	keys, err := ListLocalKeys(tempDir)
	if err != nil {
		t.Fatalf("ListLocalKeys failed: %v", err)
	}

	if len(keys) != 1 {
		t.Fatalf("expected 1 key in temp dir, got: %d", len(keys))
	}

	k := keys[0]
	if k.Name != "id_test_ed25519" {
		t.Errorf("expected key name id_test_ed25519, got: %s", k.Name)
	}
	if !k.HasPrivateKey {
		t.Errorf("expected HasPrivateKey=true")
	}
	if k.IsEncrypted {
		t.Errorf("expected IsEncrypted=false")
	}

	// Delete key
	if err := DeleteLocalKey(targetFile); err != nil {
		t.Fatalf("DeleteLocalKey failed: %v", err)
	}

	// List again
	keysAfter, err := ListLocalKeys(tempDir)
	if err != nil {
		t.Fatalf("ListLocalKeys after delete failed: %v", err)
	}
	if len(keysAfter) != 0 {
		t.Errorf("expected 0 keys after delete, got: %d", len(keysAfter))
	}
}
