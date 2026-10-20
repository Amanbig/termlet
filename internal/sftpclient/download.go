package sftpclient

import (
	"archive/zip"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// DownloadFile streams a remote file from the server into a local file path.
func (c *Client) DownloadFile(remotePath string, localPath string) error {
	if c == nil || c.sftpClient == nil {
		return fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("sftp client is closed")
	}

	remoteFile, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return fmt.Errorf("failed to open remote file %s: %w", remotePath, err)
	}
	defer remoteFile.Close()

	// Ensure local parent directory exists
	localDir := filepath.Dir(localPath)
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return fmt.Errorf("failed to create local directory %s: %w", localDir, err)
	}

	localFile, err := os.OpenFile(localPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("failed to create local file %s: %w", localPath, err)
	}

	_, copyErr := io.Copy(localFile, remoteFile)
	closeErr := localFile.Close()

	if copyErr != nil {
		_ = os.Remove(localPath)
		return fmt.Errorf("failed to download file: %w", copyErr)
	}
	if closeErr != nil {
		_ = os.Remove(localPath)
		return fmt.Errorf("failed to finalize local file: %w", closeErr)
	}

	return nil
}

// DownloadDirectoryAsZip archives a remote directory into a local .zip archive.
func (c *Client) DownloadDirectoryAsZip(remotePath string, localZipPath string) error {
	if c == nil || c.sftpClient == nil {
		return fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("sftp client is closed")
	}

	// Ensure local parent directory exists
	localDir := filepath.Dir(localZipPath)
	if err := os.MkdirAll(localDir, 0755); err != nil {
		return fmt.Errorf("failed to create local directory %s: %w", localDir, err)
	}

	localZipFile, err := os.OpenFile(localZipPath, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return fmt.Errorf("failed to create local zip file: %w", err)
	}
	defer localZipFile.Close()

	zipWriter := zip.NewWriter(localZipFile)
	defer zipWriter.Close()

	// Clean remote root
	remoteRoot := path.Clean(remotePath)
	rootBase := path.Base(remoteRoot)

	type walkItem struct {
		remotePath string
		relPath    string
	}

	queue := []walkItem{{remotePath: remoteRoot, relPath: rootBase}}

	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		entries, err := c.sftpClient.ReadDir(curr.remotePath)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			entryName := entry.Name()
			entryRemotePath := path.Join(curr.remotePath, entryName)
			entryRelPath := path.Join(curr.relPath, entryName)

			if entry.IsDir() {
				// Write directory entry to zip
				header := &zip.FileHeader{
					Name:     entryRelPath + "/",
					Method:   zip.Deflate,
					Modified: entry.ModTime(),
				}
				header.SetMode(entry.Mode())
				if _, err := zipWriter.CreateHeader(header); err != nil {
					continue
				}
				queue = append(queue, walkItem{remotePath: entryRemotePath, relPath: entryRelPath})
			} else {
				// Stream file content into zip
				header := &zip.FileHeader{
					Name:     entryRelPath,
					Method:   zip.Deflate,
					Modified: entry.ModTime(),
				}
				header.SetMode(entry.Mode())
				writer, err := zipWriter.CreateHeader(header)
				if err != nil {
					continue
				}

				rf, err := c.sftpClient.Open(entryRemotePath)
				if err != nil {
					continue
				}
				_, _ = io.Copy(writer, rf)
				_ = rf.Close()
			}
		}
	}

	return nil
}

// FormatPermissions formats a unix permission mode into symbolic format (e.g. -rwxr-xr-x or drwxr-xr-x).
func FormatPermissions(mode uint32, isDir bool) string {
	var sb strings.Builder
	if isDir {
		sb.WriteByte('d')
	} else {
		sb.WriteByte('-')
	}

	perms := []struct {
		mask uint32
		char byte
	}{
		{0400, 'r'}, {0200, 'w'}, {0100, 'x'},
		{0040, 'r'}, {0020, 'w'}, {0010, 'x'},
		{0004, 'r'}, {0002, 'w'}, {0001, 'x'},
	}

	for _, p := range perms {
		if mode&p.mask != 0 {
			sb.WriteByte(p.char)
		} else {
			sb.WriteByte('-')
		}
	}

	return sb.String()
}
