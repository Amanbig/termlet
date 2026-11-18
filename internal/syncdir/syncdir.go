package syncdir

import (
	"fmt"
	"math"
	"os"
	"path"
	"path/filepath"
	"sort"
	"strings"

	"termlet/internal/models"
	"termlet/internal/sftpclient"
)

const MaxScanFiles = 5000

var ignoredDirNames = map[string]bool{
	".git":         true,
	"node_modules": true,
	".DS_Store":    true,
	"Thumbs.db":    true,
}

// CompareMaps compares two normalized relative-path maps and returns a DirectoryCompareResult.
func CompareMaps(localDir, remoteDir string, localMap, remoteMap map[string]models.FileDiffItem) *models.DirectoryCompareResult {
	allPaths := make(map[string]bool)
	for p := range localMap {
		allPaths[p] = true
	}
	for p := range remoteMap {
		allPaths[p] = true
	}

	result := &models.DirectoryCompareResult{
		LocalDir:  localDir,
		RemoteDir: remoteDir,
		Items:     make([]models.FileDiffItem, 0, len(allPaths)),
	}

	for p := range allPaths {
		localItem, hasLocal := localMap[p]
		remoteItem, hasRemote := remoteMap[p]

		var item models.FileDiffItem
		item.Path = p

		if hasLocal && hasRemote {
			item.IsDir = localItem.IsDir
			item.LocalSize = localItem.LocalSize
			item.RemoteSize = remoteItem.RemoteSize
			item.LocalModTime = localItem.LocalModTime
			item.RemoteModTime = remoteItem.RemoteModTime

			if item.IsDir {
				item.Status = models.SyncStatusMatch
				result.Matches++
			} else {
				// Compare size and timestamps (within 2s tolerance for filesystem time variations)
				timeDiff := math.Abs(float64(item.LocalModTime - item.RemoteModTime))
				if item.LocalSize == item.RemoteSize && timeDiff <= 2 {
					item.Status = models.SyncStatusMatch
					result.Matches++
				} else {
					item.Status = models.SyncStatusModified
					result.Differences++
				}
			}
		} else if hasLocal {
			item = localItem
			item.Status = models.SyncStatusLocalOnly
			result.LocalOnly++
		} else {
			item = remoteItem
			item.Status = models.SyncStatusRemoteOnly
			result.RemoteOnly++
		}

		result.Items = append(result.Items, item)
	}

	result.TotalFiles = len(result.Items)

	// Sort stably by path
	sort.Slice(result.Items, func(i, j int) bool {
		return result.Items[i].Path < result.Items[j].Path
	})

	return result
}

// ScanLocalDirectory scans a local path recursively up to MaxScanFiles.
func ScanLocalDirectory(root string) (map[string]models.FileDiffItem, error) {
	result := make(map[string]models.FileDiffItem)
	count := 0

	err := filepath.Walk(root, func(currentPath string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // skip inaccessible files
		}
		if currentPath == root {
			return nil
		}

		base := info.Name()
		if ignoredDirNames[base] {
			if info.IsDir() {
				return filepath.SkipDir
			}
			return nil
		}

		rel, err := filepath.Rel(root, currentPath)
		if err != nil {
			return nil
		}
		rel = filepath.ToSlash(rel)

		result[rel] = models.FileDiffItem{
			Path:         rel,
			IsDir:        info.IsDir(),
			LocalSize:    info.Size(),
			LocalModTime: info.ModTime().Unix(),
		}

		count++
		if count >= MaxScanFiles {
			return fmt.Errorf("reached maximum file scan limit of %d files", MaxScanFiles)
		}
		return nil
	})

	if err != nil && count < MaxScanFiles {
		return nil, err
	}
	return result, nil
}

// ScanRemoteDirectory scans a remote SFTP path recursively up to MaxScanFiles.
func ScanRemoteDirectory(client *sftpclient.Client, root string) (map[string]models.FileDiffItem, error) {
	if client == nil {
		return nil, fmt.Errorf("sftp client not initialized")
	}
	sftpCl := client.SFTP()
	if sftpCl == nil {
		return nil, fmt.Errorf("sftp connection closed")
	}

	result := make(map[string]models.FileDiffItem)
	count := 0

	cleanRoot := path.Clean(root)
	walker := sftpCl.Walk(cleanRoot)
	for walker.Step() {
		if walker.Err() != nil {
			continue
		}
		currentPath := walker.Path()
		if currentPath == cleanRoot {
			continue
		}

		info := walker.Stat()
		if info == nil {
			continue
		}

		base := info.Name()
		if ignoredDirNames[base] {
			if info.IsDir() {
				// SFTP walker doesn't have SkipDir, continue
			}
			continue
		}

		rel := strings.TrimPrefix(currentPath, cleanRoot)
		rel = strings.TrimPrefix(rel, "/")
		if rel == "" {
			continue
		}

		result[rel] = models.FileDiffItem{
			Path:          rel,
			IsDir:         info.IsDir(),
			RemoteSize:    info.Size(),
			RemoteModTime: info.ModTime().Unix(),
		}

		count++
		if count >= MaxScanFiles {
			break
		}
	}

	return result, nil
}

// ExecuteSync executes the list of sync actions between local and remote directories.
func ExecuteSync(client *sftpclient.Client, localRoot, remoteRoot string, actions []models.SyncAction) *models.SyncResult {
	res := &models.SyncResult{
		Success: true,
	}

	for _, act := range actions {
		rel := filepath.ToSlash(act.Path)
		localPath := filepath.Join(localRoot, filepath.FromSlash(rel))
		remotePath := path.Join(remoteRoot, rel)

		if act.Direction == "to_local" {
			// Download remote file to local
			if act.IsDir {
				if err := os.MkdirAll(localPath, 0755); err != nil {
					res.Errors = append(res.Errors, fmt.Sprintf("failed to create local dir %s: %v", rel, err))
					res.Success = false
				}
				continue
			}

			// Ensure local parent dir exists
			if err := os.MkdirAll(filepath.Dir(localPath), 0755); err != nil {
				res.Errors = append(res.Errors, fmt.Sprintf("failed to create local dir for %s: %v", rel, err))
				res.Success = false
				continue
			}

			if err := client.DownloadFile(remotePath, localPath); err != nil {
				res.Errors = append(res.Errors, fmt.Sprintf("failed to download %s: %v", rel, err))
				res.Success = false
				continue
			}

			if stat, err := os.Stat(localPath); err == nil {
				res.TransferredBytes += stat.Size()
			}
			res.TransferredFiles++

		} else if act.Direction == "to_remote" {
			// Upload local file to remote
			if act.IsDir {
				if err := client.CreateDirectory(remotePath); err != nil && !strings.Contains(err.Error(), "already exists") {
					res.Errors = append(res.Errors, fmt.Sprintf("failed to create remote dir %s: %v", rel, err))
					res.Success = false
				}
				continue
			}

			// Ensure remote parent dir exists
			remoteParent := path.Dir(remotePath)
			_ = client.CreateDirectory(remoteParent)

			f, err := os.Open(localPath)
			if err != nil {
				res.Errors = append(res.Errors, fmt.Sprintf("failed to open local file %s: %v", rel, err))
				res.Success = false
				continue
			}

			stat, _ := f.Stat()
			err = client.UploadStream(remotePath, f)
			f.Close()

			if err != nil {
				res.Errors = append(res.Errors, fmt.Sprintf("failed to upload %s: %v", rel, err))
				res.Success = false
				continue
			}

			if stat != nil {
				res.TransferredBytes += stat.Size()
			}
			res.TransferredFiles++
		}
	}

	return res
}
