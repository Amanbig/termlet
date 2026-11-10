package sshclient

import (
	"context"
	"fmt"
	"net"
	"sync"
	"termlet/internal/models"
	"time"

	"golang.org/x/crypto/ssh"
)

// ConnectResult holds the outcome of an SSH connection attempt.
type ConnectResult struct {
	Client        *ssh.Client
	HostKeyPrompt *models.HostKeyPrompt
}

// ClientManager handles establishing SSH connections.
type ClientManager struct {
	hostKeyMgr *HostKeyManager
}

// NewClientManager creates a new ClientManager.
func NewClientManager() (*ClientManager, error) {
	hkm, err := NewHostKeyManager()
	if err != nil {
		return nil, err
	}
	return &ClientManager{
		hostKeyMgr: hkm,
	}, nil
}

// GetHostKeyManager returns the underlying host key manager.
func (cm *ClientManager) GetHostKeyManager() *HostKeyManager {
	return cm.hostKeyMgr
}

// Connect attempts to establish an SSH connection to the server directly over TCP.
// If trustUnknown is false and the host key is unverified or changed, it returns
// a HostKeyPrompt so the user can inspect it and decide.
func (cm *ClientManager) Connect(ctx context.Context, host string, port int, username string, authMethods []ssh.AuthMethod, trustUnknown bool, timeout time.Duration) (*ConnectResult, error) {
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	addr := net.JoinHostPort(host, fmt.Sprintf("%d", port))

	// Dial with context and timeout
	dialer := net.Dialer{Timeout: timeout}
	netConn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("failed to reach %s: %w", addr, err)
	}

	return cm.handshakeConn(ctx, netConn, host, port, addr, username, authMethods, trustUnknown, timeout)
}

// ConnectViaBastion establishes an SSH connection to a target server through an active bastion SSH client.
func (cm *ClientManager) ConnectViaBastion(ctx context.Context, bastion *ssh.Client, host string, port int, username string, authMethods []ssh.AuthMethod, trustUnknown bool, timeout time.Duration) (*ConnectResult, error) {
	if bastion == nil {
		return nil, fmt.Errorf("bastion SSH client is nil")
	}
	if timeout <= 0 {
		timeout = 15 * time.Second
	}

	addr := net.JoinHostPort(host, fmt.Sprintf("%d", port))

	type dialResult struct {
		conn net.Conn
		err  error
	}
	dialChan := make(chan dialResult, 1)
	go func() {
		c, err := bastion.Dial("tcp", addr)
		dialChan <- dialResult{conn: c, err: err}
	}()

	var netConn net.Conn
	select {
	case <-ctx.Done():
		return nil, ctx.Err()
	case <-time.After(timeout):
		return nil, fmt.Errorf("timeout connecting to %s through bastion", addr)
	case res := <-dialChan:
		if res.err != nil {
			return nil, fmt.Errorf("bastion failed to forward to %s: %w", addr, res.err)
		}
		netConn = res.conn
	}

	return cm.handshakeConn(ctx, netConn, host, port, addr, username, authMethods, trustUnknown, timeout)
}

func (cm *ClientManager) handshakeConn(ctx context.Context, netConn net.Conn, host string, port int, addr string, username string, authMethods []ssh.AuthMethod, trustUnknown bool, timeout time.Duration) (*ConnectResult, error) {
	var promptMu sync.Mutex
	var detectedPrompt *models.HostKeyPrompt

	hostKeyCallback := func(hostname string, remote net.Addr, key ssh.PublicKey) error {
		prompt, err := cm.hostKeyMgr.VerifyHostKey(host, port, remote, key)
		if err != nil {
			// Changed or revoked key
			promptMu.Lock()
			detectedPrompt = prompt
			promptMu.Unlock()
			return err
		}

		if prompt != nil {
			// Unknown key
			if trustUnknown {
				// User explicitly approved or requested trust
				_ = cm.hostKeyMgr.TrustHostKey(host, port, key)
				return nil
			}
			promptMu.Lock()
			detectedPrompt = prompt
			promptMu.Unlock()
			return fmt.Errorf("host key not yet trusted")
		}

		return nil
	}

	config := &ssh.ClientConfig{
		User:            username,
		Auth:            authMethods,
		HostKeyCallback: hostKeyCallback,
		Timeout:         timeout,
	}

	sshConn, chans, reqs, err := ssh.NewClientConn(netConn, addr, config)
	if err != nil {
		_ = netConn.Close()
		promptMu.Lock()
		p := detectedPrompt
		promptMu.Unlock()

		if p != nil {
			return &ConnectResult{
				Client:        nil,
				HostKeyPrompt: p,
			}, nil
		}

		return nil, fmt.Errorf("SSH handshake failed: %w", err)
	}

	client := ssh.NewClient(sshConn, chans, reqs)
	return &ConnectResult{
		Client:        client,
		HostKeyPrompt: nil,
	}, nil
}
