package models

// ProcessInfo holds information about a single system process.
type ProcessInfo struct {
	PID     string `json:"pid"`
	User    string `json:"user"`
	CPU     string `json:"cpu"`
	Mem     string `json:"mem"`
	Command string `json:"command"`
}

// SystemStats contains parsed system performance and health metrics.
type SystemStats struct {
	Hostname         string        `json:"hostname"`
	OS               string        `json:"os"`
	Kernel           string        `json:"kernel"`
	Uptime           string        `json:"uptime"`
	LoadAvg          string        `json:"load_avg"`
	CPUUsage         float64       `json:"cpu_usage"`
	MemTotalMB       int64         `json:"mem_total_mb"`
	MemUsedMB        int64         `json:"mem_used_mb"`
	MemFreeMB        int64         `json:"mem_free_mb"`
	SwapTotalMB      int64         `json:"swap_total_mb"`
	SwapUsedMB       int64         `json:"swap_used_mb"`
	DiskTotal        string        `json:"disk_total"`
	DiskUsed         string        `json:"disk_used"`
	DiskFree         string        `json:"disk_free"`
	DiskUsagePercent string        `json:"disk_usage_percent"`
	TopProcesses     []ProcessInfo `json:"top_processes"`
	RawOutput        string        `json:"raw_output,omitempty"`
}

// NetworkDiagResult contains the result of a network diagnostic probe.
type NetworkDiagResult struct {
	Tool       string `json:"tool"`
	Target     string `json:"target"`
	Output     string `json:"output"`
	ExitCode   int    `json:"exit_code"`
	DurationMs int64  `json:"duration_ms"`
	Error      string `json:"error,omitempty"`
}
