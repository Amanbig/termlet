package sftpclient

import (
	"fmt"
	"sync"

	"github.com/pkg/sftp"
	"golang.org/x/crypto/ssh"
)

// Client wraps an SFTP client with thread-safety and helper methods.
type Client struct {
	mu         sync.Mutex
	sftpClient *sftp.Client
	sshClient  *ssh.Client
	closed     bool
}

// NewClient initializes an SFTP client over an established SSH connection.
func NewClient(sshClient *ssh.Client) (*Client, error) {
	if sshClient == nil {
		return nil, fmt.Errorf("ssh client cannot be nil")
	}

	sc, err := sftp.NewClient(sshClient)
	if err != nil {
		return nil, fmt.Errorf("failed to initialize SFTP subsystem: %w", err)
	}

	return &Client{
		sftpClient: sc,
		sshClient:  sshClient,
	}, nil
}

// Close gracefully terminates the SFTP session.
func (c *Client) Close() error {
	if c == nil {
		return nil
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return nil
	}
	c.closed = true

	var sftpErr error
	if c.sftpClient != nil {
		sftpErr = c.sftpClient.Close()
	}
	return sftpErr
}

// IsAlive checks if the SFTP client is still active.
func (c *Client) IsAlive() bool {
	if c == nil {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed || c.sftpClient == nil {
		return false
	}

	_, err := c.sftpClient.Getwd()
	return err == nil
}

// GetWorkingDirectory returns the current working directory.
func (c *Client) GetWorkingDirectory() (string, error) {
	if c == nil || c.sftpClient == nil {
		return "", fmt.Errorf("sftp client is not initialized")
	}
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.closed {
		return "", fmt.Errorf("sftp client is closed")
	}

	wd, err := c.sftpClient.Getwd()
	if err != nil {
		return "/", nil
	}
	return wd, nil
}

// SFTP returns the underlying *sftp.Client.
func (c *Client) SFTP() *sftp.Client {
	if c == nil {
		return nil
	}
	return c.sftpClient
}
