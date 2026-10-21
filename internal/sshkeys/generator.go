package sshkeys

import (
	"crypto"
	"crypto/ecdsa"
	"crypto/ed25519"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/rsa"
	"encoding/pem"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"termlet/internal/models"

	"golang.org/x/crypto/ssh"
)

// GenerateSSHKey creates a new SSH key pair according to the request parameters.
func GenerateSSHKey(req models.GenerateSSHKeyRequest) (*models.GeneratedSSHKey, error) {
	var privKey crypto.PrivateKey
	var pubKey crypto.PublicKey
	var keyType string
	var bits int

	reqType := strings.ToLower(strings.TrimSpace(req.Type))
	if reqType == "" {
		reqType = "ed25519"
	}

	switch reqType {
	case "ed25519":
		pub, priv, err := ed25519.GenerateKey(rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("failed to generate ed25519 key: %w", err)
		}
		privKey = priv
		pubKey = pub
		keyType = "ssh-ed25519"
		bits = 256

	case "rsa":
		b := req.Bits
		if b < 2048 {
			b = 4096
		}
		priv, err := rsa.GenerateKey(rand.Reader, b)
		if err != nil {
			return nil, fmt.Errorf("failed to generate rsa key: %w", err)
		}
		privKey = priv
		pubKey = &priv.PublicKey
		keyType = "ssh-rsa"
		bits = b

	case "ecdsa":
		var curve elliptic.Curve
		switch req.Bits {
		case 384:
			curve = elliptic.P384()
			bits = 384
		case 521:
			curve = elliptic.P521()
			bits = 521
		default:
			curve = elliptic.P256()
			bits = 256
		}

		priv, err := ecdsa.GenerateKey(curve, rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("failed to generate ecdsa key: %w", err)
		}
		privKey = priv
		pubKey = &priv.PublicKey
		keyType = "ecdsa-sha2-nistp" + fmt.Sprintf("%d", bits)

	default:
		return nil, fmt.Errorf("unsupported key type: %s (supported: ed25519, rsa, ecdsa)", req.Type)
	}

	// Build comment
	comment := strings.TrimSpace(req.Comment)
	if comment == "" {
		comment = "termlet"
	}

	// Marshal private key (with or without passphrase)
	var privBlock *pem.Block
	var err error
	if req.Passphrase != "" {
		privBlock, err = ssh.MarshalPrivateKeyWithPassphrase(privKey, comment, []byte(req.Passphrase))
		if err != nil {
			return nil, fmt.Errorf("failed to encrypt private key with passphrase: %w", err)
		}
	} else {
		privBlock, err = ssh.MarshalPrivateKey(privKey, comment)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal private key: %w", err)
		}
	}

	privPEM := string(pem.EncodeToMemory(privBlock))

	// Convert public key to OpenSSH format
	sshPub, err := ssh.NewPublicKey(pubKey)
	if err != nil {
		return nil, fmt.Errorf("failed to create ssh public key: %w", err)
	}

	pubBytes := ssh.MarshalAuthorizedKey(sshPub)
	pubAuthorized := strings.TrimSpace(string(pubBytes))
	if comment != "" {
		pubAuthorized += " " + comment
	}
	pubAuthorized += "\n"

	fingerprint := ssh.FingerprintSHA256(sshPub)
	artTitle := fmt.Sprintf("%s %d", strings.ToUpper(reqType), bits)
	randomart := GenerateRandomart(sshPub, artTitle)

	result := &models.GeneratedSSHKey{
		PublicKey:   pubAuthorized,
		PrivateKey:  privPEM,
		Fingerprint: fingerprint,
		KeyType:     keyType,
		Bits:        bits,
		Comment:     comment,
		Randomart:   randomart,
	}

	// Save to disk if requested
	if req.SaveToDisk {
		privPath, pubPath, err := saveKeyPair(result, req.TargetFilename, reqType, req.Overwrite)
		if err != nil {
			return nil, err
		}
		result.SavedPath = privPath
		result.PublicKeyPath = pubPath
	}

	return result, nil
}

// saveKeyPair saves the private and public key files to ~/.ssh/ or a specified path.
func saveKeyPair(key *models.GeneratedSSHKey, targetFilename, keyType string, overwrite bool) (string, string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", "", fmt.Errorf("failed to determine user home directory: %w", err)
	}

	sshDir := filepath.Join(home, ".ssh")
	if err := os.MkdirAll(sshDir, 0700); err != nil {
		return "", "", fmt.Errorf("failed to create ~/.ssh directory: %w", err)
	}

	filename := strings.TrimSpace(targetFilename)
	if filename == "" {
		switch keyType {
		case "ed25519":
			filename = "id_ed25519"
		case "rsa":
			filename = "id_rsa"
		case "ecdsa":
			filename = "id_ecdsa"
		default:
			filename = "id_termlet"
		}
	}

	var privPath string
	if filepath.IsAbs(filename) {
		privPath = filename
	} else {
		privPath = filepath.Join(sshDir, filename)
	}

	pubPath := privPath + ".pub"

	// Check if already exists
	if !overwrite {
		if _, err := os.Stat(privPath); err == nil {
			return "", "", fmt.Errorf("private key file already exists: %s", privPath)
		}
		if _, err := os.Stat(pubPath); err == nil {
			return "", "", fmt.Errorf("public key file already exists: %s", pubPath)
		}
	}

	// Write private key with strict 0600 permissions
	if err := os.WriteFile(privPath, []byte(key.PrivateKey), 0600); err != nil {
		return "", "", fmt.Errorf("failed to write private key to %s: %w", privPath, err)
	}

	// Write public key with standard 0644 permissions
	if err := os.WriteFile(pubPath, []byte(key.PublicKey), 0644); err != nil {
		return "", "", fmt.Errorf("failed to write public key to %s: %w", pubPath, err)
	}

	return privPath, pubPath, nil
}
