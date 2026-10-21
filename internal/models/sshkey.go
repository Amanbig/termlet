package models

// GenerateSSHKeyRequest holds parameters for generating a new SSH key pair.
type GenerateSSHKeyRequest struct {
	Type           string `json:"type"`           // "ed25519", "rsa", "ecdsa"
	Bits           int    `json:"bits"`           // 2048, 3072, 4096 (for RSA) or 256, 384, 521 (for ECDSA)
	Comment        string `json:"comment"`        // Key comment (e.g., user@termlet)
	Passphrase     string `json:"passphrase"`     // Optional passphrase for private key
	SaveToDisk     bool   `json:"saveToDisk"`     // Whether to save to ~/.ssh/ automatically
	TargetFilename string `json:"targetFilename"` // Filename or full path (defaults to standard name)
	Overwrite      bool   `json:"overwrite"`      // Whether to overwrite existing file if present
}

// GeneratedSSHKey holds the result of generating a new SSH key pair.
type GeneratedSSHKey struct {
	PublicKey     string `json:"publicKey"`     // OpenSSH format: "ssh-ed25519 AAAAC3... comment\n"
	PrivateKey    string `json:"privateKey"`    // OpenSSH PEM block
	Fingerprint   string `json:"fingerprint"`   // "SHA256:..."
	KeyType       string `json:"keyType"`       // "ssh-ed25519", "ssh-rsa", etc.
	Bits          int    `json:"bits"`          // 256, 4096, etc.
	Comment       string `json:"comment"`       // Comment embedded in key
	SavedPath     string `json:"savedPath"`     // Private key path if saved to disk
	PublicKeyPath string `json:"publicKeyPath"` // Public key path if saved to disk
	Randomart     string `json:"randomart"`     // OpenSSH visual ASCII art
}

// SSHKeyInfo describes an existing local SSH key found on disk.
type SSHKeyInfo struct {
	Name          string `json:"name"`          // e.g., "id_ed25519"
	Path          string `json:"path"`          // Private key path
	PublicKeyPath string `json:"publicKeyPath"` // Public key path (.pub)
	PublicKey     string `json:"publicKey"`     // Content of public key
	Fingerprint   string `json:"fingerprint"`   // SHA256 fingerprint
	KeyType       string `json:"keyType"`       // "ssh-ed25519", "ssh-rsa", etc.
	Comment       string `json:"comment"`       // Comment in .pub
	HasPrivateKey bool   `json:"hasPrivateKey"` // True if private key file exists
	IsEncrypted   bool   `json:"isEncrypted"`   // True if private key has passphrase
	ModTime       int64  `json:"modTime"`       // Unix timestamp of modification
	Size          int64  `json:"size"`          // Size in bytes
}

// InstallSSHKeyRequest parameters for installing public key to a remote host.
type InstallSSHKeyRequest struct {
	SessionID string `json:"sessionId"` // Active connection session ID
	PublicKey string `json:"publicKey"` // The public key string to append to authorized_keys
}
