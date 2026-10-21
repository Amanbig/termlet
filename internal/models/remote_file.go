package models

// RemoteFile represents a file or directory on the remote SFTP server.
type RemoteFile struct {
	Name        string `json:"name"`
	Path        string `json:"path"`
	IsDir       bool   `json:"is_dir"`
	Size        int64  `json:"size"`
	ModTime     int64  `json:"mod_time"` // Unix timestamp in seconds
	Permissions uint32 `json:"permissions"`
}

// FileContent holds file data and metadata for the editor.
type FileContent struct {
	Path        string `json:"path"`
	Content     string `json:"content"`
	Size        int64  `json:"size"`
	ModTime     int64  `json:"mod_time"`
	Permissions uint32 `json:"permissions"`
	IsBinary    bool   `json:"is_binary"`
}

// HostKeyPrompt contains information when an SSH host key needs user approval.
type HostKeyPrompt struct {
	Hostname    string `json:"hostname"`
	Address     string `json:"address"`
	KeyType     string `json:"key_type"`
	Fingerprint string `json:"fingerprint"`
	Status      string `json:"status"` // "unknown", "changed", "trusted"
	Message     string `json:"message"`
}

// KnownHostEntry represents a stored SSH host public key record.
type KnownHostEntry struct {
	Host        string `json:"host"`
	KeyType     string `json:"key_type"`
	Fingerprint string `json:"fingerprint"`
	PublicKey   string `json:"public_key"`
	Comment     string `json:"comment"`
	Source      string `json:"source"` // "termlet" or "system"
	LineNumber  int    `json:"line_number"`
}
