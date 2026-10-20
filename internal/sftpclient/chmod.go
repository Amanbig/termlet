package sftpclient

import (
	"fmt"
	"os"
	"path"
)

// Chmod updates the permissions of a remote file or directory.
// If recursive is true and targetPath is a directory, permissions are applied to all sub-items.
func (c *Client) Chmod(remotePath string, mode uint32, recursive bool) error {
	if c == nil || c.sftpClient == nil {
		return fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("sftp client is closed")
	}

	fileMode := os.FileMode(mode & 0777)

	if !recursive {
		if err := c.sftpClient.Chmod(remotePath, fileMode); err != nil {
			return fmt.Errorf("failed to chmod %s: %w", remotePath, err)
		}
		return nil
	}

	// Recursive chmod
	stat, err := c.sftpClient.Stat(remotePath)
	if err != nil {
		return fmt.Errorf("failed to stat %s: %w", remotePath, err)
	}

	if !stat.IsDir() {
		return c.sftpClient.Chmod(remotePath, fileMode)
	}

	// Apply to root directory first
	if err := c.sftpClient.Chmod(remotePath, fileMode); err != nil {
		return fmt.Errorf("failed to chmod directory %s: %w", remotePath, err)
	}

	// BFS traversal for recursive application
	queue := []string{remotePath}
	for len(queue) > 0 {
		curr := queue[0]
		queue = queue[1:]

		entries, err := c.sftpClient.ReadDir(curr)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			entryPath := path.Join(curr, entry.Name())
			_ = c.sftpClient.Chmod(entryPath, fileMode)

			if entry.IsDir() {
				queue = append(queue, entryPath)
			}
		}
	}

	return nil
}

// FormatPermissions formats a unix permission mode into a standard symbolic string (e.g. -rwxr-xr-x or drwxr-xr-x).
func FormatPermissions(mode uint32, isDir bool) string {
	res := make([]byte, 10)
	if isDir {
		res[0] = 'd'
	} else {
		res[0] = '-'
	}

	rwx := []byte{'r', 'w', 'x'}
	perm := mode & 0777

	for i := 0; i < 9; i++ {
		shift := uint(8 - i)
		if (perm>>shift)&1 == 1 {
			res[1+i] = rwx[i%3]
		} else {
			res[1+i] = '-'
		}
	}
	return string(res)
}
