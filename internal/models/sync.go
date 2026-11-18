package models

const (
	SyncStatusMatch      = "match"
	SyncStatusModified   = "modified"
	SyncStatusRemoteOnly = "remote_only"
	SyncStatusLocalOnly  = "local_only"
)

// FileDiffItem represents comparison details for a single file or directory.
type FileDiffItem struct {
	Path          string `json:"path"`   // relative path
	Status        string `json:"status"` // match, modified, remote_only, local_only
	LocalSize     int64  `json:"local_size"`
	RemoteSize    int64  `json:"remote_size"`
	LocalModTime  int64  `json:"local_mod_time"`  // unix timestamp
	RemoteModTime int64  `json:"remote_mod_time"` // unix timestamp
	IsDir         bool   `json:"is_dir"`
}

// DirectoryCompareResult holds the complete result of comparing local and remote directories.
type DirectoryCompareResult struct {
	RemoteDir   string         `json:"remote_dir"`
	LocalDir    string         `json:"local_dir"`
	TotalFiles  int            `json:"total_files"`
	Matches     int            `json:"matches"`
	Differences int            `json:"differences"`
	RemoteOnly  int            `json:"remote_only"`
	LocalOnly   int            `json:"local_only"`
	Items       []FileDiffItem `json:"items"`
}

// SyncAction defines an individual file copy operation between local and remote.
type SyncAction struct {
	Path      string `json:"path"`      // relative path
	Direction string `json:"direction"` // "to_local" (download) or "to_remote" (upload)
	IsDir     bool   `json:"is_dir"`
}

// SyncResult summarizes the outcome of a batch synchronization.
type SyncResult struct {
	TransferredFiles int      `json:"transferred_files"`
	TransferredBytes int64    `json:"transferred_bytes"`
	Errors           []string `json:"errors,omitempty"`
	Success          bool     `json:"success"`
}
