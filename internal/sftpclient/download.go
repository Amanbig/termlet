package sftpclient

import (
	"archive/zip"
	"context"
	"fmt"
	"io"
	"os"
	"path"
	"path/filepath"
	"strings"
)

// GetFileSize returns the byte size of a remote file.
func (c *Client) GetFileSize(remotePath string) (int64, error) {
	if c == nil || c.sftpClient == nil {
		return 0, fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return 0, fmt.Errorf("sftp client is closed")
	}

	stat, err := c.sftpClient.Stat(remotePath)
	if err != nil {
		return 0, err
	}
	return stat.Size(), nil
}

// DownloadFile streams a remote file from the server into a local file path.
func (c *Client) DownloadFile(remotePath string, localPath string) error {
	return c.DownloadFileWithProgress(context.Background(), remotePath, localPath, nil)
}

// DownloadFileWithProgress streams a remote file with optional progress wrapping and context cancellation.
func (c *Client) DownloadFileWithProgress(ctx context.Context, remotePath string, localPath string, wrapWriter func(io.Writer) io.Writer) error {
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

	var w io.Writer = localFile
	if wrapWriter != nil {
		w = wrapWriter(localFile)
	}

	// Copy data while checking context
	var copyErr error
	if ctx != nil && ctx.Done() != nil {
		buf := make([]byte, 32*1024)
		for {
			if ctx.Err() != nil {
				copyErr = ctx.Err()
				break
			}
			nr, er := remoteFile.Read(buf)
			if nr > 0 {
				nw, ew := w.Write(buf[0:nr])
				if ew != nil {
					copyErr = ew
					break
				}
				if nr != nw {
					copyErr = io.ErrShortWrite
					break
				}
			}
			if er != nil {
				if er != io.EOF {
					copyErr = er
				}
				break
			}
		}
	} else {
		_, copyErr = io.Copy(w, remoteFile)
	}

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
	return c.DownloadDirectoryAsZipWithProgress(context.Background(), remotePath, localZipPath, nil)
}

// DownloadDirectoryAsZipWithProgress archives a remote directory with optional progress monitoring and context cancellation.
func (c *Client) DownloadDirectoryAsZipWithProgress(ctx context.Context, remotePath string, localZipPath string, wrapWriter func(io.Writer) io.Writer) error {
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

	var underlyingWriter io.Writer = localZipFile
	if wrapWriter != nil {
		underlyingWriter = wrapWriter(localZipFile)
	}

	zipWriter := zip.NewWriter(underlyingWriter)
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
		if ctx != nil && ctx.Err() != nil {
			_ = os.Remove(localZipPath)
			return ctx.Err()
		}

		curr := queue[0]
		queue = queue[1:]

		entries, err := c.sftpClient.ReadDir(curr.remotePath)
		if err != nil {
			continue
		}

		for _, entry := range entries {
			if ctx != nil && ctx.Err() != nil {
				_ = os.Remove(localZipPath)
				return ctx.Err()
			}

			entryName := entry.Name()
			entryRemotePath := path.Join(curr.remotePath, entryName)
			entryRelPath := path.Join(curr.relPath, entryName)

			if entry.IsDir() {
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

	if err := zipWriter.Close(); err != nil {
		_ = os.Remove(localZipPath)
		return fmt.Errorf("failed to finalize zip archive: %w", err)
	}

	return nil
}

// sanitizeFilename replaces characters that are invalid in Windows or Unix file paths.
func sanitizeFilename(name string) string {
	invalidChars := []string{"/", "\\", ":", "*", "?", "\"", "<", ">", "|"}
	res := name
	for _, char := range invalidChars {
		res = strings.ReplaceAll(res, char, "_")
	}
	return res
}
