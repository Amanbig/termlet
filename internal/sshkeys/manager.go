package sshkeys

import (
	"bytes"
	"encoding/pem"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"strings"
	"termlet/internal/models"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// ListLocalKeys inspects the user's ~/.ssh directory and returns info on all discovered SSH keys.
func ListLocalKeys(customDir string) ([]models.SSHKeyInfo, error) {
	dir := customDir
	if dir == "" {
		home, err := os.UserHomeDir()
		if err != nil {
			return nil, fmt.Errorf("failed to get user home dir: %w", err)
		}
		dir = filepath.Join(home, ".ssh")
	}

	entries, err := os.ReadDir(dir)
	if err != nil {
		if os.IsNotExist(err) {
			return []models.SSHKeyInfo{}, nil
		}
		return nil, fmt.Errorf("failed to read ssh directory: %w", err)
	}

	var results []models.SSHKeyInfo

	for _, entry := range entries {
		if entry.IsDir() {
			continue
		}

		name := entry.Name()
		// Only process .pub files to discover key pairs
		if !strings.HasSuffix(name, ".pub") {
			continue
		}

		baseName := strings.TrimSuffix(name, ".pub")
		pubPath := filepath.Join(dir, name)
		privPath := filepath.Join(dir, baseName)

		pubBytes, err := os.ReadFile(pubPath)
		if err != nil {
			continue
		}

		parsedPub, comment, _, _, err := ssh.ParseAuthorizedKey(pubBytes)
		if err != nil {
			continue
		}

		keyType := parsedPub.Type()
		fingerprint := ssh.FingerprintSHA256(parsedPub)

		hasPriv := false
		isEncrypted := false
		var modTime int64
		var size int64

		if info, err := os.Stat(pubPath); err == nil {
			modTime = info.ModTime().Unix()
			size = info.Size()
		}

		if privInfo, err := os.Stat(privPath); err == nil && !privInfo.IsDir() {
			hasPriv = true
			if privBytes, err := os.ReadFile(privPath); err == nil {
				isEncrypted = isPrivateKeyEncrypted(privBytes)
			}
		}

		results = append(results, models.SSHKeyInfo{
			Name:          baseName,
			Path:          privPath,
			PublicKeyPath: pubPath,
			PublicKey:     strings.TrimSpace(string(pubBytes)),
			Fingerprint:   fingerprint,
			KeyType:       keyType,
			Comment:       comment,
			HasPrivateKey: hasPriv,
			IsEncrypted:   isEncrypted,
			ModTime:       modTime,
			Size:          size,
		})
	}

	return results, nil
}

// isPrivateKeyEncrypted checks if a PEM private key block is passphrase protected.
func isPrivateKeyEncrypted(data []byte) bool {
	// Standard OpenSSH format: "bcrypt" or "aes256-ctr" or "cipher" != "none"
	// Parse raw private key without passphrase; if error is PassphraseMissing, it's encrypted.
	_, err := ssh.ParseRawPrivateKey(data)
	if err != nil {
		if strings.Contains(err.Error(), "passphrase") || strings.Contains(err.Error(), "encrypted") {
			return true
		}
	}

	// Also check traditional PEM Proc-Type: 4,ENCRYPTED
	block, _ := pem.Decode(data)
	if block != nil {
		if _, ok := block.Headers["Proc-Type"]; ok {
			return true
		}
	}

	return false
}

// DeleteLocalKey removes both the private key and public key (.pub) files for the given path.
func DeleteLocalKey(keyPath string) error {
	if keyPath == "" {
		return fmt.Errorf("invalid empty key path")
	}

	var pubPath string
	var privPath string

	if strings.HasSuffix(keyPath, ".pub") {
		pubPath = keyPath
		privPath = strings.TrimSuffix(keyPath, ".pub")
	} else {
		privPath = keyPath
		pubPath = keyPath + ".pub"
	}

	var firstErr error
	if err := os.Remove(privPath); err != nil && !os.IsNotExist(err) {
		firstErr = err
	}

	if err := os.Remove(pubPath); err != nil && !os.IsNotExist(err) {
		if firstErr == nil {
			firstErr = err
		}
	}

	return firstErr
}

// InstallPublicKeyToRemote installs a public key onto the remote server's ~/.ssh/authorized_keys file.
func InstallPublicKeyToRemote(sftpClient *sftp.Client, publicKey string) error {
	if sftpClient == nil {
		return fmt.Errorf("sftp client is not connected")
	}

	trimmedKey := strings.TrimSpace(publicKey)
	if trimmedKey == "" {
		return fmt.Errorf("public key is empty")
	}

	// 1. Ensure ~/.ssh directory exists with 0700 permissions
	_ = sftpClient.Mkdir(".ssh")
	_ = sftpClient.Chmod(".ssh", 0700)

	authKeysPath := ".ssh/authorized_keys"

	// 2. Check if authorized_keys exists and if key is already present
	var existingContent string
	if f, err := sftpClient.Open(authKeysPath); err == nil {
		buf, _ := io.ReadAll(f)
		_ = f.Close()
		existingContent = string(buf)
	}

	if strings.Contains(existingContent, trimmedKey) {
		// Key already installed! Ensure proper 0600 permissions
		_ = sftpClient.Chmod(authKeysPath, 0600)
		return nil
	}

	// 3. Append key with newline
	f, err := sftpClient.OpenFile(authKeysPath, os.O_CREATE|os.O_WRONLY|os.O_APPEND)
	if err != nil {
		return fmt.Errorf("failed to open remote %s: %w", authKeysPath, err)
	}
	defer f.Close()

	var appendBuf bytes.Buffer
	if len(existingContent) > 0 && !strings.HasSuffix(existingContent, "\n") {
		appendBuf.WriteString("\n")
	}
	appendBuf.WriteString(trimmedKey)
	appendBuf.WriteString("\n")

	if _, err := f.Write(appendBuf.Bytes()); err != nil {
		return fmt.Errorf("failed to write key to remote %s: %w", authKeysPath, err)
	}

	// 4. Secure authorized_keys with 0600 permissions
	_ = sftpClient.Chmod(authKeysPath, 0600)

	return nil
}
