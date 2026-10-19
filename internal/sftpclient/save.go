package sftpclient

import (
	"fmt"
	"io"
	"os"
	"path"
	"strings"
	"termlet/internal/models"
	"time"
)

// ConflictError indicates that a file was modified remotely since it was loaded.
type ConflictError struct {
	Path            string `json:"path"`
	ExpectedModTime int64  `json:"expected_mod_time"`
	ActualModTime   int64  `json:"actual_mod_time"`
}

func (e *ConflictError) Error() string {
	return fmt.Sprintf("file %s was modified on remote server (expected %d, found %d)", e.Path, e.ExpectedModTime, e.ActualModTime)
}

// SaveResult contains metadata of the saved file.
type SaveResult struct {
	Path    string `json:"path"`
	Size    int64  `json:"size"`
	ModTime int64  `json:"mod_time"`
}

// SaveFile safely saves content to a remote file.
// If checkModTime > 0, it validates that the remote file hasn't changed since checkModTime.
func (c *Client) SaveFile(filePath string, content string, checkModTime int64) (*SaveResult, error) {
	if c == nil || c.sftpClient == nil {
		return nil, fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, fmt.Errorf("sftp client is closed")
	}

	// 1. Conflict check if file exists and checkModTime was provided
	var existingMode uint32 = 0644
	stat, err := c.sftpClient.Stat(filePath)
	if err == nil {
		if stat.IsDir() {
			return nil, fmt.Errorf("cannot overwrite directory %s with file", filePath)
		}
		existingMode = uint32(stat.Mode().Perm())

		if checkModTime > 0 && stat.ModTime().Unix() > checkModTime {
			return nil, &ConflictError{
				Path:            filePath,
				ExpectedModTime: checkModTime,
				ActualModTime:   stat.ModTime().Unix(),
			}
		}
	}

	// 2. Safe upload strategy using temporary file
	dir := path.Dir(filePath)
	base := path.Base(filePath)
	tmpPath := path.Join(dir, fmt.Sprintf(".%s.%d.termlet.tmp", strings.TrimPrefix(base, "."), time.Now().UnixNano()))

	data := []byte(content)

	// Write to temp file
	tmpFile, err := c.sftpClient.Create(tmpPath)
	if err != nil {
		// Fallback to direct overwrite if temp file creation fails (e.g. restricted permissions)
		return c.directSave(filePath, data, existingMode)
	}

	_, writeErr := tmpFile.Write(data)
	closeErr := tmpFile.Close()

	if writeErr != nil {
		_ = c.sftpClient.Remove(tmpPath)
		return nil, fmt.Errorf("failed to write data: %w", writeErr)
	}
	if closeErr != nil {
		_ = c.sftpClient.Remove(tmpPath)
		return nil, fmt.Errorf("failed to flush file: %w", closeErr)
	}

	// Atomically replace target file
	// Note: on POSIX SFTP, PosixRename or Rename will replace
	if err := c.sftpClient.PosixRename(tmpPath, filePath); err != nil {
		// Fallback to standard Rename or direct overwrite
		if err := c.sftpClient.Rename(tmpPath, filePath); err != nil {
			_ = c.sftpClient.Remove(tmpPath)
			return c.directSave(filePath, data, existingMode)
		}
	}

	// 3. Stat the final file to return current metadata
	newStat, err := c.sftpClient.Stat(filePath)
	if err != nil {
		return &SaveResult{
			Path:    filePath,
			Size:    int64(len(data)),
			ModTime: time.Now().Unix(),
		}, nil
	}

	return &SaveResult{
		Path:    filePath,
		Size:    newStat.Size(),
		ModTime: newStat.ModTime().Unix(),
	}, nil
}

// directSave writes directly to the destination path if atomic rename is not possible.
func (c *Client) directSave(filePath string, data []byte, mode uint32) (*SaveResult, error) {
	file, err := c.sftpClient.OpenFile(filePath, osOFlagsCreate())
	if err != nil {
		return nil, fmt.Errorf("failed to open destination file %s: %w", filePath, err)
	}
	defer file.Close()

	if _, err := file.Write(data); err != nil {
		return nil, fmt.Errorf("failed to write directly to %s: %w", filePath, err)
	}

	_ = c.sftpClient.Chmod(filePath, os.FileMode(mode))

	newStat, err := c.sftpClient.Stat(filePath)
	if err != nil {
		return &SaveResult{
			Path:    filePath,
			Size:    int64(len(data)),
			ModTime: time.Now().Unix(),
		}, nil
	}

	return &SaveResult{
		Path:    filePath,
		Size:    newStat.Size(),
		ModTime: newStat.ModTime().Unix(),
	}, nil
}

// UploadStream writes an io.Reader stream directly to destination.
func (c *Client) UploadStream(remotePath string, r io.Reader) error {
	if c == nil || c.sftpClient == nil {
		return fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return fmt.Errorf("sftp client is closed")
	}

	dest, err := c.sftpClient.OpenFile(remotePath, osOFlagsCreate())
	if err != nil {
		return fmt.Errorf("failed to open destination file %s: %w", remotePath, err)
	}
	defer dest.Close()

	if _, err := io.Copy(dest, r); err != nil {
		return fmt.Errorf("failed to stream upload data: %w", err)
	}

	return nil
}

// OpenReadStream opens a file for reading stream.
func (c *Client) OpenReadStream(remotePath string) (io.ReadCloser, *models.RemoteFile, error) {
	if c == nil || c.sftpClient == nil {
		return nil, nil, fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil, nil, fmt.Errorf("sftp client is closed")
	}

	fi, err := c.sftpClient.Stat(remotePath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to stat file: %w", err)
	}

	f, err := c.sftpClient.Open(remotePath)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to open file: %w", err)
	}

	rf := &models.RemoteFile{
		Name:        fi.Name(),
		Path:        remotePath,
		IsDir:       fi.IsDir(),
		Size:        fi.Size(),
		ModTime:     fi.ModTime().Unix(),
		Permissions: uint32(fi.Mode().Perm()),
	}

	return f, rf, nil
}
