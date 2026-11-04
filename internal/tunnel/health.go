package tunnel

import (
	"fmt"
	"net"
	"sync"
	"time"
)

// PortHealthStatus represents the live health check result of a local forwarded port.
type PortHealthStatus struct {
	TunnelID   string `json:"tunnelId"`
	LocalPort  int    `json:"localPort"`
	Status     string `json:"status"` // "healthy", "warning", "unreachable", "stopped"
	StatusCode int    `json:"statusCode,omitempty"`
	StatusText string `json:"statusText,omitempty"`
	Protocol   string `json:"protocol"` // "http", "tcp", "none"
	LatencyMs  int64  `json:"latencyMs"`
	Error      string `json:"error,omitempty"`
}

// CheckHealth probes an individual local port forward to determine if the service is responsive.
func (m *Manager) CheckHealth(tunnelID string) PortHealthStatus {
	m.mu.RLock()
	f, exists := m.forwarders[tunnelID]
	m.mu.RUnlock()

	if !exists || f == nil {
		return PortHealthStatus{
			TunnelID: tunnelID,
			Status:   "stopped",
			Protocol: "none",
			Error:    "tunnel not found",
		}
	}

	f.mu.Lock()
	status := f.info.Status
	localPort := f.info.LocalPort
	errorMsg := f.info.ErrorMsg
	f.mu.Unlock()

	if status != StatusActive {
		return PortHealthStatus{
			TunnelID:  tunnelID,
			LocalPort: localPort,
			Status:    "stopped",
			Protocol:  "none",
		}
	}

	if errorMsg != "" {
		return PortHealthStatus{
			TunnelID:   tunnelID,
			LocalPort:  localPort,
			Status:     "warning",
			StatusText: errorMsg,
			Protocol:   "tcp",
		}
	}

	return PortHealthStatus{
		TunnelID:   tunnelID,
		LocalPort:  localPort,
		Status:     "healthy",
		StatusText: "Ready",
		Protocol:   "tcp",
	}
}

// CheckAllHealth probes multiple tunnels concurrently with a short timeout.
func (m *Manager) CheckAllHealth(tunnelIDs []string) []PortHealthStatus {
	if len(tunnelIDs) == 0 {
		return []PortHealthStatus{}
	}

	results := make([]PortHealthStatus, len(tunnelIDs))
	var wg sync.WaitGroup

	for i, id := range tunnelIDs {
		wg.Add(1)
		go func(idx int, tID string) {
			defer wg.Done()
			results[idx] = m.CheckHealth(tID)
		}(i, id)
	}

	wg.Wait()
	return results
}

// ProbePort performs a fast TCP connectivity probe against 127.0.0.1:localPort.
// It verifies TCP socket readiness without sending unsolicited application-layer (HTTP) data.
func ProbePort(tunnelID string, localPort int) PortHealthStatus {
	addr := fmt.Sprintf("127.0.0.1:%d", localPort)
	start := time.Now()

	conn, err := net.DialTimeout("tcp", addr, 1500*time.Millisecond)
	if err != nil {
		return PortHealthStatus{
			TunnelID:  tunnelID,
			LocalPort: localPort,
			Status:    "unreachable",
			Protocol:  "none",
			Error:     err.Error(),
		}
	}
	_ = conn.Close()

	tcpLatency := time.Since(start).Milliseconds()
	return PortHealthStatus{
		TunnelID:   tunnelID,
		LocalPort:  localPort,
		Status:     "healthy",
		StatusText: "Ready",
		Protocol:   "tcp",
		LatencyMs:  tcpLatency,
	}
}
