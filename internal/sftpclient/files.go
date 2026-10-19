package sftpclient

import (
	"bytes"
	"fmt"
	"io"
	"path"
	"sort"
	"termlet/internal/models"
	"unicode/utf8"
)

const DefaultMaxFileSize = 10 * 1024 * 1024 // 10MB default editor limit

// ListDirectory lists files and folders at the remote path.
func (c *Client) ListDirectory(dirPath string) ([]models.RemoteFile, error) {
	if c == nil || c.sftpClient == nil {
		return nil, fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, fmt.Errorf("sftp client is closed")
	}

	if dirPath == "" || dirPath == "." {
		wd, err := c.sftpClient.Getwd()
		if err == nil && wd != "" {
			dirPath = wd
		} else {
			dirPath = "/"
		}
	}

	fileInfos, err := c.sftpClient.ReadDir(dirPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read directory %s: %w", dirPath, err)
	}

	var results []models.RemoteFile
	for _, fi := range fileInfos {
		fullPath := path.Join(dirPath, fi.Name())
		results = append(results, models.RemoteFile{
			Name:        fi.Name(),
			Path:        fullPath,
			IsDir:       fi.IsDir(),
			Size:        fi.Size(),
			ModTime:     fi.ModTime().Unix(),
			Permissions: uint32(fi.Mode().Perm()),
		})
	}

	// Sort folders first, then files alphabetically
	sort.Slice(results, func(i, j int) bool {
		if results[i].IsDir != results[j].IsDir {
			return results[i].IsDir
		}
		return results[i].Name < results[j].Name
	})

	return results, nil
}

// ReadFile reads content and metadata of a remote file.
func (c *Client) ReadFile(filePath string, maxBytes int64) (*models.FileContent, error) {
	if c == nil || c.sftpClient == nil {
		return nil, fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, fmt.Errorf("sftp client is closed")
	}

	if maxBytes <= 0 {
		maxBytes = DefaultMaxFileSize
	}

	fi, err := c.sftpClient.Stat(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat file %s: %w", filePath, err)
	}

	if fi.IsDir() {
		return nil, fmt.Errorf("path is a directory: %s", filePath)
	}

	if fi.Size() > maxBytes {
		return nil, fmt.Errorf("file size (%d bytes) exceeds maximum limit (%d bytes)", fi.Size(), maxBytes)
	}

	remoteFile, err := c.sftpClient.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file %s: %w", filePath, err)
	}
	defer remoteFile.Close()

	buf := make([]byte, fi.Size())
	_, err = io.ReadFull(remoteFile, buf)
	if err != nil && err != io.EOF && err != io.ErrUnexpectedEOF {
		return nil, fmt.Errorf("failed to read file content: %w", err)
	}

	// Check if binary
	isBinary := !utf8.Valid(buf) || bytes.IndexByte(buf, 0) != -1

	return &models.FileContent{
		Path:        filePath,
		Content:     string(buf),
		Size:        fi.Size(),
		ModTime:     fi.ModTime().Unix(),
		Permissions: uint32(fi.Mode().Perm()),
		IsBinary:    isBinary,
	}, nil
}

// CreateFile creates an empty file at the specified path.
func (c *Client) CreateFile(filePath string) error {
	if c == nil || c.sftpClient == nil {
		return fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("sftp client is closed")
	}

	f, err := c.sftpClient.OpenFile(filePath, osOFlagsCreate())
	if err != nil {
		return fmt.Errorf("failed to create file %s: %w", filePath, err)
	}
	_ = f.Close()
	return nil
}

// CreateDirectory creates a new remote directory.
func (c *Client) CreateDirectory(dirPath string) error {
	if c == nil || c.sftpClient == nil {
		return fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("sftp client is closed")
	}

	if err := c.sftpClient.MkdirAll(dirPath); err != nil {
		return fmt.Errorf("failed to create directory %s: %w", dirPath, err)
	}
	return nil
}

// DeletePath deletes a file or directory.
func (c *Client) DeletePath(targetPath string, isDir bool) error {
	if c == nil || c.sftpClient == nil {
		return fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("sftp client is closed")
	}

	if isDir {
		// Try RemoveAll for directories
		if err := c.sftpClient.RemoveAll(targetPath); err != nil {
			return fmt.Errorf("failed to delete directory %s: %w", targetPath, err)
		}
		return nil
	}

	if err := c.sftpClient.Remove(targetPath); err != nil {
		return fmt.Errorf("failed to delete file %s: %w", targetPath, err)
	}
	return nil
}

// Rename renames or moves a remote file/directory.
func (c *Client) Rename(oldPath, newPath string) error {
	if c == nil || c.sftpClient == nil {
		return fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("sftp client is closed")
	}

	if err := c.sftpClient.Rename(oldPath, newPath); err != nil {
		return fmt.Errorf("failed to rename %s to %s: %w", oldPath, newPath, err)
	}
	return nil
}

// Stat retrieves metadata for a remote path.
func (c *Client) Stat(remotePath string) (*models.RemoteFile, error) {
	if c == nil || c.sftpClient == nil {
		return nil, fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, fmt.Errorf("sftp client is closed")
	}

	fi, err := c.sftpClient.Stat(remotePath)
	if err != nil {
		return nil, fmt.Errorf("failed to stat %s: %w", remotePath, err)
	}

	return &models.RemoteFile{
		Name:        fi.Name(),
		Path:        remotePath,
		IsDir:       fi.IsDir(),
		Size:        fi.Size(),
		ModTime:     fi.ModTime().Unix(),
		Permissions: uint32(fi.Mode().Perm()),
	}, nil
}

func osOFlagsCreate() int {
	return 0x0001 | 0x0040 | 0x0200 // O_WRONLY | O_CREAT | O_TRUNC
}
