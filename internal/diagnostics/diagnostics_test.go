package diagnostics

import (
	"testing"
)

func TestBuildDiagnosticCommand(t *testing.T) {
	// Ping
	cmd, err := BuildDiagnosticCommand("ping", "8.8.8.8")
	if err != nil || cmd == "" {
		t.Fatalf("unexpected error for ping: %v", err)
	}

	// DNS
	cmd, err = BuildDiagnosticCommand("dns", "google.com")
	if err != nil || cmd == "" {
		t.Fatalf("unexpected error for dns: %v", err)
	}

	// Port check
	cmd, err = BuildDiagnosticCommand("port_check", "localhost:8080")
	if err != nil || cmd == "" {
		t.Fatalf("unexpected error for port_check: %v", err)
	}

	// Listening ports
	cmd, err = BuildDiagnosticCommand("listening_ports", "")
	if err != nil || cmd == "" {
		t.Fatalf("unexpected error for listening_ports: %v", err)
	}

	// Shell injection attempt rejection
	_, err = BuildDiagnosticCommand("ping", "8.8.8.8; rm -rf /")
	if err == nil {
		t.Fatalf("expected error for invalid characters in target")
	}
}

func TestParseSystemStats(t *testing.T) {
	raw := `
===HOSTNAME===
prod-server-01
===UNAME===
Linux 5.15.0-100-generic x86_64
===UPTIME===
 14:15:20 up 45 days,  2:30,  1 user,  load average: 0.12, 0.08, 0.05
===FREE===
               total        used        free      shared  buff/cache   available
Mem:           16000        4200        9000         200        2800       11200
Swap:           2048         512        1536
===DF===
Filesystem     Size  Used Avail Use% Mounted on
/dev/sda1       50G   20G   30G  40% /
===TOP===
USER       PID %CPU %MEM    VSZ   RSS TTY      STAT START   TIME COMMAND
root         1  0.0  0.1 169344 13580 ?        Ss   Oct01   0:15 /sbin/init
postgres  1234  1.2  4.5 543200 73400 ?        S    Oct01  12:30 /usr/lib/postgresql/bin/postgres
`
	stats := ParseSystemStats(raw)
	if stats.Hostname != "prod-server-01" {
		t.Errorf("expected hostname prod-server-01, got %s", stats.Hostname)
	}
	if stats.OS != "Linux" {
		t.Errorf("expected OS Linux, got %s", stats.OS)
	}
	if stats.MemTotalMB != 16000 || stats.MemUsedMB != 4200 {
		t.Errorf("expected 16000 total and 4200 used, got %d and %d", stats.MemTotalMB, stats.MemUsedMB)
	}
	if stats.DiskTotal != "50G" || stats.DiskUsagePercent != "40%" {
		t.Errorf("expected 50G total and 40%%, got %s and %s", stats.DiskTotal, stats.DiskUsagePercent)
	}
	if len(stats.TopProcesses) != 2 {
		t.Errorf("expected 2 processes, got %d", len(stats.TopProcesses))
	}
	if stats.TopProcesses[1].Command != "/usr/lib/postgresql/bin/postgres" {
		t.Errorf("unexpected command: %s", stats.TopProcesses[1].Command)
	}
}
