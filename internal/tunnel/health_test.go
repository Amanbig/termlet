package tunnel

import (
	"fmt"
	"net"
	"testing"
)

func TestCheckHealthNonExistent(t *testing.T) {
	mgr := NewManager()
	res := mgr.CheckHealth("invalid-id")
	if res.Status != "stopped" {
		t.Errorf("expected status stopped, got %s", res.Status)
	}
}

func TestProbePortTCP(t *testing.T) {
	// Start a local test TCP listener (simulating an open forwarded port)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("failed to start listener: %v", err)
	}
	defer ln.Close()

	// Extract local port
	_, portStr, err := net.SplitHostPort(ln.Addr().String())
	if err != nil {
		t.Fatalf("failed to split host port: %v", err)
	}

	var port int
	_, _ = fmt.Sscanf(portStr, "%d", &port)

	res := ProbePort("test-tunnel", port)
	if res.Status != "healthy" {
		t.Errorf("expected status healthy, got %s", res.Status)
	}
	if res.Protocol != "tcp" {
		t.Errorf("expected protocol tcp, got %s", res.Protocol)
	}
}

func TestProbePortUnreachable(t *testing.T) {
	// Probe a random closed local port (e.g. 59999)
	res := ProbePort("unreachable-tunnel", 59999)
	if res.Status != "unreachable" {
		t.Errorf("expected status unreachable, got %s", res.Status)
	}
}
