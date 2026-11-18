package tunnel

import (
	"bytes"
	"net"
	"testing"
	"time"
)

func TestAddConfiguredTunnelDynamic(t *testing.T) {
	mgr := NewManager()
	info := mgr.AddConfiguredTunnel("dyn-1", "sess-1", 1080, "dynamic", 0, "My SOCKS Proxy", TypeDynamic)

	if info == nil {
		t.Fatal("expected non-nil TunnelInfo")
	}
	if info.Type != TypeDynamic {
		t.Errorf("expected type %s, got %s", TypeDynamic, info.Type)
	}
	if info.LocalPort != 1080 {
		t.Errorf("expected local port 1080, got %d", info.LocalPort)
	}
	if info.Status != StatusStopped {
		t.Errorf("expected status stopped, got %s", info.Status)
	}

	// Health check on stopped dynamic tunnel
	health := mgr.CheckHealth("dyn-1")
	if health.Status != "stopped" {
		t.Errorf("expected health stopped, got %s", health.Status)
	}
}

func TestSocks5HandshakeNegotiationNoAuth(t *testing.T) {
	mgr := NewManager()

	f := &forwarder{
		info: TunnelInfo{
			ID:        "test-dyn",
			SessionID: "sess-1",
			LocalPort: 1080,
			Type:      TypeDynamic,
			Status:    StatusActive,
		},
		sshClient: nil, // will trigger general failure upon dial attempt
	}

	clientConn, serverConn := net.Pipe()
	defer clientConn.Close()

	done := make(chan struct{})
	go func() {
		defer close(done)
		mgr.handleSocks5Connection(f, serverConn)
	}()

	// 1. Client sends greeting: VER 5, 1 method: 0x00 (NO AUTH)
	_, err := clientConn.Write([]byte{0x05, 0x01, 0x00})
	if err != nil {
		t.Fatalf("failed to send greeting: %v", err)
	}

	reply := make([]byte, 2)
	_ = clientConn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, err := clientConn.Read(reply); err != nil {
		t.Fatalf("failed to read greeting response: %v", err)
	}

	if !bytes.Equal(reply, []byte{0x05, 0x00}) {
		t.Errorf("expected greeting reply [0x05, 0x00], got %v", reply)
	}

	// 2. Client sends CONNECT request to 127.0.0.1:80
	// VER=5, CMD=1, RSV=0, ATYP=1 (IPv4), IP=127.0.0.1, PORT=80 (0x00, 0x50)
	req := []byte{0x05, 0x01, 0x00, 0x01, 127, 0, 0, 1, 0x00, 0x50}
	if _, err := clientConn.Write(req); err != nil {
		t.Fatalf("failed to send request: %v", err)
	}

	resp := make([]byte, 10)
	if _, err := clientConn.Read(resp); err != nil {
		t.Fatalf("failed to read request response: %v", err)
	}

	// Because sshClient is nil, it should reply REP=0x01 (general SOCKS server failure)
	if resp[0] != 0x05 || resp[1] != 0x01 {
		t.Errorf("expected response [0x05, 0x01, ...], got %v", resp)
	}

	<-done
}

func TestSocks5UnsupportedAuthMethod(t *testing.T) {
	mgr := NewManager()

	f := &forwarder{
		info: TunnelInfo{
			ID:        "test-dyn-no-auth",
			SessionID: "sess-1",
			LocalPort: 1080,
			Type:      TypeDynamic,
			Status:    StatusActive,
		},
	}

	clientConn, serverConn := net.Pipe()
	defer clientConn.Close()

	done := make(chan struct{})
	go func() {
		defer close(done)
		mgr.handleSocks5Connection(f, serverConn)
	}()

	// Client sends greeting with only GSSAPI (0x01) and USER/PASS (0x02) - no NO_AUTH (0x00)
	_, _ = clientConn.Write([]byte{0x05, 0x02, 0x01, 0x02})

	reply := make([]byte, 2)
	_ = clientConn.SetReadDeadline(time.Now().Add(2 * time.Second))
	if _, err := clientConn.Read(reply); err != nil {
		t.Fatalf("failed to read response: %v", err)
	}

	// SOCKS5 reply 0xFF (No acceptable methods)
	if !bytes.Equal(reply, []byte{0x05, 0xFF}) {
		t.Errorf("expected [0x05, 0xFF], got %v", reply)
	}

	<-done
}
