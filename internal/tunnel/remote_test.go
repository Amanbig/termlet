package tunnel

import (
	"fmt"
	"io"
	"net"
	"testing"
	"time"
)

func TestAddConfiguredTunnelRemote(t *testing.T) {
	mgr := NewManager()
	info := mgr.AddConfiguredTunnel("rem-1", "sess-1", 3000, "127.0.0.1", 8080, "Remote Dev", TypeRemote)

	if info == nil {
		t.Fatal("expected non-nil TunnelInfo")
	}
	if info.Type != TypeRemote {
		t.Errorf("expected type %s, got %s", TypeRemote, info.Type)
	}
	if info.LocalPort != 3000 {
		t.Errorf("expected local port 3000, got %d", info.LocalPort)
	}
	if info.RemotePort != 8080 {
		t.Errorf("expected remote port 8080, got %d", info.RemotePort)
	}
	if info.Status != StatusStopped {
		t.Errorf("expected status stopped, got %s", info.Status)
	}

	// Health check on stopped remote tunnel
	health := mgr.CheckHealth("rem-1")
	if health.Status != "stopped" {
		t.Errorf("expected health stopped, got %s", health.Status)
	}
}

func TestHandleRemoteConnection(t *testing.T) {
	// Start a local echo server representing the user's local web service (e.g. localhost:3000)
	localLn, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start local test listener: %v", err)
	}
	defer localLn.Close()

	_, portStr, _ := net.SplitHostPort(localLn.Addr().String())
	var localPort int
	_, _ = fmt.Sscanf(portStr, "%d", &localPort)

	// Echo server logic
	go func() {
		conn, err := localLn.Accept()
		if err != nil {
			return
		}
		defer conn.Close()
		_, _ = io.Copy(conn, conn)
	}()

	mgr := NewManager()
	f := &forwarder{
		info: TunnelInfo{
			ID:         "test-rem",
			SessionID:  "sess-1",
			LocalHost:  "127.0.0.1",
			LocalPort:  localPort,
			RemotePort: 8080,
			Type:       TypeRemote,
			Status:     StatusActive,
		},
	}

	// Simulate incoming connection from remote SSH server
	remoteClient, remoteServer := net.Pipe()
	defer remoteClient.Close()

	done := make(chan struct{})
	go func() {
		defer close(done)
		mgr.handleRemoteConnection(f, remoteServer)
	}()

	// Send data through remote connection
	testMsg := []byte("hello from remote reverse tunnel!")
	_ = remoteClient.SetDeadline(time.Now().Add(2 * time.Second))
	if _, err := remoteClient.Write(testMsg); err != nil {
		t.Fatalf("failed to write to remote client: %v", err)
	}

	buf := make([]byte, len(testMsg))
	if _, err := io.ReadFull(remoteClient, buf); err != nil {
		t.Fatalf("failed to read echoed data: %v", err)
	}

	if string(buf) != string(testMsg) {
		t.Errorf("expected echo %q, got %q", string(testMsg), string(buf))
	}

	_ = remoteClient.Close()
	<-done
}
