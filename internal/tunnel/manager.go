package tunnel

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/google/uuid"
	"golang.org/x/crypto/ssh"
)

// TunnelStatus represents the state of a port forward tunnel.
type TunnelStatus string

const (
	StatusActive  TunnelStatus = "active"
	StatusStopped TunnelStatus = "stopped"
	StatusError   TunnelStatus = "error"
)

// TunnelInfo represents public tunnel metadata exposed to the UI.
type TunnelInfo struct {
	ID          string       `json:"id"`
	SessionID   string       `json:"sessionId"`
	LocalPort   int          `json:"localPort"`
	RemoteHost  string       `json:"remoteHost"`
	RemotePort  int          `json:"remotePort"`
	Name        string       `json:"name"`
	Status      TunnelStatus `json:"status"`
	ErrorMsg    string       `json:"errorMsg,omitempty"`
	CreatedAt   int64        `json:"createdAt"`
	Connections int64        `json:"connections"`
}

// forwarder manages an individual listening socket and forwarding pipeline.
type forwarder struct {
	mu          sync.Mutex
	info        TunnelInfo
	listener    net.Listener
	sshClient   *ssh.Client
	ctx         context.Context
	cancel      context.CancelFunc
	activeConns int64
}

// Manager coordinates all active and configured port forwarding tunnels.
type Manager struct {
	mu         sync.RWMutex
	forwarders map[string]*forwarder
}

// NewManager creates a new port forwarding Manager.
func NewManager() *Manager {
	return &Manager{
		forwarders: make(map[string]*forwarder),
	}
}

// StartForwarding launches a local TCP listener on 127.0.0.1:localPort and routes traffic to remoteHost:remotePort via the SSH client.
func (m *Manager) StartForwarding(sessionID string, sshClient *ssh.Client, localPort int, remoteHost string, remotePort int, name string) (*TunnelInfo, error) {
	if sshClient == nil {
		return nil, errors.New("cannot start port forwarding: SSH client is disconnected")
	}
	if localPort < 1 || localPort > 65535 {
		return nil, fmt.Errorf("invalid local port %d: must be between 1 and 65535", localPort)
	}
	if remotePort < 1 || remotePort > 65535 {
		return nil, fmt.Errorf("invalid remote port %d: must be between 1 and 65535", remotePort)
	}
	if strings.TrimSpace(remoteHost) == "" {
		remoteHost = "127.0.0.1"
	}
	if strings.TrimSpace(name) == "" {
		name = fmt.Sprintf("Port %d ➔ %s:%d", localPort, remoteHost, remotePort)
	}

	m.mu.Lock()
	var stoppedF *forwarder
	// Check if this local port is already being forwarded by our manager
	for _, f := range m.forwarders {
		f.mu.Lock()
		if f.info.LocalPort == localPort {
			if f.info.Status == StatusActive {
				f.mu.Unlock()
				m.mu.Unlock()
				return nil, fmt.Errorf("local port %d is already active in Termlet (%s)", localPort, f.info.Name)
			}
			if f.info.SessionID == sessionID {
				stoppedF = f
			}
		}
		f.mu.Unlock()
	}
	m.mu.Unlock()

	// Attempt to bind the local listener on 127.0.0.1
	localAddr := fmt.Sprintf("127.0.0.1:%d", localPort)
	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		return nil, fmt.Errorf("failed to bind local port %d: %w (is another program using it?)", localPort, err)
	}

	ctx, cancel := context.WithCancel(context.Background())

	if stoppedF != nil {
		stoppedF.mu.Lock()
		stoppedF.listener = listener
		stoppedF.sshClient = sshClient
		stoppedF.ctx = ctx
		stoppedF.cancel = cancel
		stoppedF.info.Name = name
		stoppedF.info.RemoteHost = remoteHost
		stoppedF.info.RemotePort = remotePort
		stoppedF.info.Status = StatusActive
		stoppedF.info.ErrorMsg = ""
		stoppedF.mu.Unlock()

		go m.acceptLoop(stoppedF)
		infoCopy := stoppedF.getInfo()
		return &infoCopy, nil
	}

	tunnelID := uuid.New().String()

	f := &forwarder{
		info: TunnelInfo{
			ID:          tunnelID,
			SessionID:   sessionID,
			LocalPort:   localPort,
			RemoteHost:  remoteHost,
			RemotePort:  remotePort,
			Name:        name,
			Status:      StatusActive,
			CreatedAt:   time.Now().Unix(),
			Connections: 0,
		},
		listener:  listener,
		sshClient: sshClient,
		ctx:       ctx,
		cancel:    cancel,
	}

	m.mu.Lock()
	m.forwarders[tunnelID] = f
	m.mu.Unlock()

	// Launch accept loop in background goroutine
	go m.acceptLoop(f)

	infoCopy := f.getInfo()
	return &infoCopy, nil
}

// acceptLoop handles incoming local connections and dials the remote SSH host.
func (m *Manager) acceptLoop(f *forwarder) {
	for {
		localConn, err := f.listener.Accept()
		if err != nil {
			select {
			case <-f.ctx.Done():
				// Normal shutdown
				return
			default:
				// Unexpected listener failure
				f.mu.Lock()
				f.info.Status = StatusError
				f.info.ErrorMsg = fmt.Sprintf("Listener error: %v", err)
				f.mu.Unlock()
				return
			}
		}

		atomic.AddInt64(&f.activeConns, 1)
		go m.handleConnection(f, localConn)
	}
}

// handleConnection pipes a local client connection to the remote target via SSH channel.
func (m *Manager) handleConnection(f *forwarder, localConn net.Conn) {
	defer func() {
		_ = localConn.Close()
		atomic.AddInt64(&f.activeConns, -1)
	}()

	f.mu.Lock()
	sshCl := f.sshClient
	remoteTarget := net.JoinHostPort(f.info.RemoteHost, fmt.Sprintf("%d", f.info.RemotePort))
	f.mu.Unlock()

	if sshCl == nil {
		f.mu.Lock()
		f.info.ErrorMsg = "SSH client is disconnected"
		f.mu.Unlock()
		return
	}

	remoteConn, err := sshCl.Dial("tcp", remoteTarget)
	if err != nil {
		f.mu.Lock()
		f.info.ErrorMsg = fmt.Sprintf("Failed to reach %s on server: %v", remoteTarget, err)
		f.mu.Unlock()
		return
	}
	defer remoteConn.Close()

	// Clear previous dial error upon successful connection
	f.mu.Lock()
	if f.info.ErrorMsg != "" && strings.HasPrefix(f.info.ErrorMsg, "Failed to reach") {
		f.info.ErrorMsg = ""
	}
	f.mu.Unlock()

	// Bidirectional data streaming with immediate teardown on EOF/error
	var once sync.Once
	closeBoth := func() {
		_ = localConn.Close()
		_ = remoteConn.Close()
	}

	go func() {
		_, _ = io.Copy(remoteConn, localConn)
		once.Do(closeBoth)
	}()

	_, _ = io.Copy(localConn, remoteConn)
	once.Do(closeBoth)
}

// StopForwarding closes the listener and sets the tunnel to stopped.
func (m *Manager) StopForwarding(tunnelID string) error {
	m.mu.RLock()
	f, exists := m.forwarders[tunnelID]
	m.mu.RUnlock()

	if !exists {
		return fmt.Errorf("tunnel not found: %s", tunnelID)
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	if f.info.Status != StatusActive {
		return nil
	}

	if f.cancel != nil {
		f.cancel()
	}
	if f.listener != nil {
		_ = f.listener.Close()
	}

	atomic.StoreInt64(&f.activeConns, 0)
	f.info.Status = StatusStopped
	f.info.ErrorMsg = ""
	return nil
}

// RestartForwarding re-opens the listener for a stopped tunnel.
func (m *Manager) RestartForwarding(tunnelID string, sshClient *ssh.Client) (*TunnelInfo, error) {
	if sshClient == nil {
		return nil, errors.New("cannot restart port forwarding: SSH client is disconnected")
	}

	m.mu.RLock()
	f, exists := m.forwarders[tunnelID]
	m.mu.RUnlock()

	if !exists {
		return nil, fmt.Errorf("tunnel not found: %s", tunnelID)
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	if f.info.Status == StatusActive {
		info := f.info
		info.Connections = atomic.LoadInt64(&f.activeConns)
		return &info, nil
	}

	localAddr := fmt.Sprintf("127.0.0.1:%d", f.info.LocalPort)
	listener, err := net.Listen("tcp", localAddr)
	if err != nil {
		f.info.Status = StatusError
		f.info.ErrorMsg = err.Error()
		info := f.info
		return &info, fmt.Errorf("failed to re-bind port %d: %w", f.info.LocalPort, err)
	}

	ctx, cancel := context.WithCancel(context.Background())
	f.listener = listener
	f.sshClient = sshClient
	f.ctx = ctx
	f.cancel = cancel
	f.info.Status = StatusActive
	f.info.ErrorMsg = ""

	go m.acceptLoop(f)

	info := f.info
	info.Connections = atomic.LoadInt64(&f.activeConns)
	return &info, nil
}

// DeleteForwarding stops and completely removes a tunnel.
func (m *Manager) DeleteForwarding(tunnelID string) error {
	m.mu.Lock()
	f, exists := m.forwarders[tunnelID]
	if exists {
		delete(m.forwarders, tunnelID)
	}
	m.mu.Unlock()

	if !exists {
		return nil
	}

	f.mu.Lock()
	defer f.mu.Unlock()

	if f.cancel != nil {
		f.cancel()
	}
	if f.listener != nil {
		_ = f.listener.Close()
	}

	return nil
}

// ListTunnels returns all tunnels for a specific session, or all tunnels if sessionID is empty.
func (m *Manager) ListTunnels(sessionID string) []*TunnelInfo {
	m.mu.RLock()
	defer m.mu.RUnlock()

	var result []*TunnelInfo
	for _, f := range m.forwarders {
		info := f.getInfo()
		if sessionID == "" || info.SessionID == sessionID {
			result = append(result, &info)
		}
	}
	return result
}

// CloseSessionTunnels terminates and clears all port forwards belonging to a closed session.
func (m *Manager) CloseSessionTunnels(sessionID string) {
	m.mu.Lock()
	var toClose []*forwarder
	for id, f := range m.forwarders {
		if f.info.SessionID == sessionID {
			toClose = append(toClose, f)
			delete(m.forwarders, id)
		}
	}
	m.mu.Unlock()

	for _, f := range toClose {
		f.mu.Lock()
		if f.cancel != nil {
			f.cancel()
		}
		if f.listener != nil {
			_ = f.listener.Close()
		}
		f.mu.Unlock()
	}
}

// CloseAll shuts down all listeners and cancels all active forwarding routines.
func (m *Manager) CloseAll() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, f := range m.forwarders {
		f.mu.Lock()
		if f.cancel != nil {
			f.cancel()
		}
		if f.listener != nil {
			_ = f.listener.Close()
		}
		f.mu.Unlock()
		delete(m.forwarders, id)
	}
}

func (f *forwarder) getInfo() TunnelInfo {
	f.mu.Lock()
	defer f.mu.Unlock()
	info := f.info
	info.Connections = atomic.LoadInt64(&f.activeConns)
	return info
}

// AddConfiguredTunnel registers a saved port forward in stopped state without opening a socket.
func (m *Manager) AddConfiguredTunnel(id string, sessionID string, localPort int, remoteHost string, remotePort int, name string) *TunnelInfo {
	if strings.TrimSpace(id) == "" {
		id = uuid.New().String()
	}
	if strings.TrimSpace(remoteHost) == "" {
		remoteHost = "127.0.0.1"
	}
	if strings.TrimSpace(name) == "" {
		name = fmt.Sprintf("Port %d ➔ %s:%d", localPort, remoteHost, remotePort)
	}

	m.mu.Lock()
	defer m.mu.Unlock()

	// If this ID already exists, return existing info
	if existing, found := m.forwarders[id]; found {
		info := existing.getInfo()
		return &info
	}

	// Also check if another forwarder has the exact same localPort and remote for this session
	for _, existing := range m.forwarders {
		if existing.info.SessionID == sessionID &&
			existing.info.LocalPort == localPort &&
			existing.info.RemotePort == remotePort &&
			existing.info.RemoteHost == remoteHost {
			info := existing.getInfo()
			return &info
		}
	}

	f := &forwarder{
		info: TunnelInfo{
			ID:          id,
			SessionID:   sessionID,
			LocalPort:   localPort,
			RemoteHost:  remoteHost,
			RemotePort:  remotePort,
			Name:        name,
			Status:      StatusStopped,
			CreatedAt:   time.Now().Unix(),
			Connections: 0,
		},
	}
	m.forwarders[id] = f
	infoCopy := f.info
	return &infoCopy
}

// GetTunnel returns public metadata for a specific tunnel ID if present.
func (m *Manager) GetTunnel(tunnelID string) (*TunnelInfo, bool) {
	m.mu.RLock()
	f, exists := m.forwarders[tunnelID]
	m.mu.RUnlock()

	if !exists {
		return nil, false
	}
	info := f.getInfo()
	return &info, true
}

