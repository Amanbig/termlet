package tunnel

import (
	"fmt"
	"net"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestCheckHealthNonExistent(t *testing.T) {
	mgr := NewManager()
	res := mgr.CheckHealth("invalid-id")
	if res.Status != "stopped" {
		t.Errorf("expected status stopped, got %s", res.Status)
	}
}

func TestProbePortHTTP(t *testing.T) {
	// Start a local test HTTP server
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte("OK"))
	}))
	defer server.Close()

	// Extract local port
	_, portStr, err := net.SplitHostPort(server.Listener.Addr().String())
	if err != nil {
		t.Fatalf("failed to split host port: %v", err)
	}

	var port int
	_, _ = fmt.Sscanf(portStr, "%d", &port)

	res := ProbePort("test-tunnel", port)
	if res.Status != "healthy" {
		t.Errorf("expected status healthy, got %s", res.Status)
	}
	if res.Protocol != "http" {
		t.Errorf("expected protocol http, got %s", res.Protocol)
	}
	if res.StatusCode != 200 {
		t.Errorf("expected status code 200, got %d", res.StatusCode)
	}
}

func TestProbePortUnreachable(t *testing.T) {
	// Probe a random closed local port (e.g. 59999)
	res := ProbePort("unreachable-tunnel", 59999)
	if res.Status != "unreachable" {
		t.Errorf("expected status unreachable, got %s", res.Status)
	}
}
