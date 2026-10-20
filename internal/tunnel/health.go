package tunnel

import (
	"context"
	"fmt"
	"net"
	"net/http"
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
	f.mu.Unlock()

	if status != StatusActive {
		return PortHealthStatus{
			TunnelID:  tunnelID,
			LocalPort: localPort,
			Status:    "stopped",
			Protocol:  "none",
		}
	}

	return ProbePort(tunnelID, localPort)
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

// ProbePort performs a fast HTTP or TCP probe against 127.0.0.1:localPort.
func ProbePort(tunnelID string, localPort int) PortHealthStatus {
	addr := fmt.Sprintf("127.0.0.1:%d", localPort)
	start := time.Now()

	// 1. Try HTTP request first (GET with redirect suppression)
	client := &http.Client{
		Timeout: 2 * time.Second,
		CheckRedirect: func(req *http.Request, via []*http.Request) error {
			return http.ErrUseLastResponse
		},
	}

	req, err := http.NewRequestWithContext(context.Background(), "GET", fmt.Sprintf("http://%s/", addr), nil)
	if err == nil {
		req.Header.Set("User-Agent", "Termlet-HealthCheck/1.0")
		resp, err := client.Do(req)
		if err == nil {
			_ = resp.Body.Close()
			latency := time.Since(start).Milliseconds()

			healthStatus := "healthy"
			if resp.StatusCode >= 500 {
				healthStatus = "warning"
			}

			return PortHealthStatus{
				TunnelID:   tunnelID,
				LocalPort:  localPort,
				Status:     healthStatus,
				StatusCode: resp.StatusCode,
				StatusText: fmt.Sprintf("%d %s", resp.StatusCode, http.StatusText(resp.StatusCode)),
				Protocol:   "http",
				LatencyMs:  latency,
			}
		}
	}

	// 2. If HTTP probe failed, test TCP connectivity directly
	tcpStart := time.Now()
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

	tcpLatency := time.Since(tcpStart).Milliseconds()
	return PortHealthStatus{
		TunnelID:   tunnelID,
		LocalPort:  localPort,
		Status:     "healthy",
		StatusText: "TCP Ready",
		Protocol:   "tcp",
		LatencyMs:  tcpLatency,
	}
}
