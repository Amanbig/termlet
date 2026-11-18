package diagnostics

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"

	"termlet/internal/models"
)

var safeTargetRegex = regexp.MustCompile(`^[a-zA-Z0-9.\-_:]+$`)

// GetSystemStatsScript returns the shell command used to gather server metrics in one round-trip.
func GetSystemStatsScript() string {
	return `
echo "===HOSTNAME==="
hostname 2>/dev/null || cat /etc/hostname 2>/dev/null
echo "===UNAME==="
uname -srm 2>/dev/null
echo "===UPTIME==="
uptime 2>/dev/null
echo "===FREE==="
free -m 2>/dev/null || vmstat -s 2>/dev/null
echo "===DF==="
df -h / 2>/dev/null || df -h . 2>/dev/null
echo "===TOP==="
ps aux --sort=-%cpu 2>/dev/null | head -n 6 || ps -ef 2>/dev/null | head -n 6
`
}

// BuildDiagnosticCommand constructs a sanitized command line for the requested diagnostic tool.
func BuildDiagnosticCommand(tool string, target string) (string, error) {
	tool = strings.ToLower(strings.TrimSpace(tool))
	target = strings.TrimSpace(target)

	// listening_ports does not need a target
	if tool == "listening_ports" {
		return `(ss -tulpn 2>/dev/null || netstat -tulpn 2>/dev/null || lsof -i -P -n 2>/dev/null || echo "Unable to query listening sockets") | head -n 40`, nil
	}

	if target == "" {
		return "", fmt.Errorf("target host or port cannot be empty")
	}

	if !safeTargetRegex.MatchString(target) {
		return "", fmt.Errorf("invalid characters in target '%s'", target)
	}

	switch tool {
	case "ping":
		return fmt.Sprintf(`ping -c 4 %s 2>&1 || ping -c 4 %s 2>&1`, target, target), nil
	case "dns":
		return fmt.Sprintf(`(nslookup %s 2>&1 || host %s 2>&1 || dig %s 2>&1 || getent hosts %s 2>&1)`, target, target, target, target), nil
	case "port_check":
		// Format: host:port or just port (defaulting to 127.0.0.1)
		host := "127.0.0.1"
		port := target
		if strings.Contains(target, ":") {
			parts := strings.SplitN(target, ":", 2)
			host = parts[0]
			port = parts[1]
		}
		return fmt.Sprintf(`
(nc -zv -w 3 %s %s 2>&1 || timeout 3 bash -c "</dev/tcp/%s/%s" 2>&1 && echo "Port %s:%s is OPEN") || echo "Port %s:%s is CLOSED or FILTERED"
`, host, port, host, port, host, port, host, port), nil
	case "traceroute":
		return fmt.Sprintf(`(traceroute -m 15 -w 2 %s 2>&1 || tracepath %s 2>&1 || mtr -r -c 1 %s 2>&1 || echo "Traceroute tool not installed on remote server")`, target, target, target), nil
	default:
		return "", fmt.Errorf("unsupported diagnostic tool: %s", tool)
	}
}

// ParseSystemStats parses the output of GetSystemStatsScript into structured models.SystemStats.
func ParseSystemStats(raw string) *models.SystemStats {
	stats := &models.SystemStats{
		RawOutput: raw,
		Hostname:  "Unknown",
		OS:        "Linux",
		Kernel:    "",
		Uptime:    "",
		LoadAvg:   "",
	}

	sections := splitSections(raw)

	// 1. Hostname
	if val, ok := sections["HOSTNAME"]; ok && len(val) > 0 {
		stats.Hostname = strings.TrimSpace(val[0])
	}

	// 2. Kernel / OS
	if val, ok := sections["UNAME"]; ok && len(val) > 0 {
		stats.Kernel = strings.TrimSpace(val[0])
		if strings.Contains(strings.ToLower(stats.Kernel), "darwin") {
			stats.OS = "macOS"
		} else if strings.Contains(strings.ToLower(stats.Kernel), "bsd") {
			stats.OS = "BSD"
		} else {
			stats.OS = "Linux"
		}
	}

	// 3. Uptime & Load
	if val, ok := sections["UPTIME"]; ok && len(val) > 0 {
		line := strings.TrimSpace(val[0])
		stats.Uptime = parseUptime(line)
		stats.LoadAvg = parseLoadAvg(line)
	}

	// 4. Memory (from free -m)
	if val, ok := sections["FREE"]; ok {
		parseMemory(val, stats)
	}

	// 5. Disk (from df -h)
	if val, ok := sections["DF"]; ok {
		parseDisk(val, stats)
	}

	// 6. Top Processes (from ps aux)
	if val, ok := sections["TOP"]; ok {
		stats.TopProcesses = parseProcesses(val)
	}

	return stats
}

func splitSections(raw string) map[string][]string {
	result := make(map[string][]string)
	lines := strings.Split(raw, "\n")
	var currentSection string

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "===") && strings.HasSuffix(trimmed, "===") {
			currentSection = strings.Trim(trimmed, "=")
			continue
		}
		if currentSection != "" && trimmed != "" {
			result[currentSection] = append(result[currentSection], trimmed)
		}
	}
	return result
}

func parseUptime(line string) string {
	// e.g. " 14:20:15 up 12 days,  3:45,  2 users,  load average: 0.15, 0.20, 0.18"
	if idx := strings.Index(line, "up "); idx != -1 {
		rest := line[idx+3:]
		if commaIdx := strings.Index(rest, ",  "); commaIdx != -1 {
			// check if days included
			nextPart := rest[commaIdx+3:]
			if usersIdx := strings.Index(nextPart, "user"); usersIdx != -1 {
				// return up to users
				parts := strings.Split(rest, ",")
				if len(parts) >= 2 {
					return strings.TrimSpace(parts[0] + "," + parts[1])
				}
			}
			return strings.TrimSpace(rest[:commaIdx])
		}
	}
	return line
}

func parseLoadAvg(line string) string {
	if idx := strings.Index(line, "load average:"); idx != -1 {
		return strings.TrimSpace(line[idx+13:])
	}
	if idx := strings.Index(line, "load averages:"); idx != -1 {
		return strings.TrimSpace(line[idx+14:])
	}
	return ""
}

func parseMemory(lines []string, stats *models.SystemStats) {
	for _, l := range lines {
		fields := strings.Fields(l)
		if len(fields) >= 3 && strings.HasPrefix(strings.ToLower(fields[0]), "mem") {
			// Mem: total used free shared buff/cache available
			if total, err := strconv.ParseInt(fields[1], 10, 64); err == nil {
				stats.MemTotalMB = total
			}
			if used, err := strconv.ParseInt(fields[2], 10, 64); err == nil {
				stats.MemUsedMB = used
			}
			if len(fields) >= 4 {
				if free, err := strconv.ParseInt(fields[3], 10, 64); err == nil {
					stats.MemFreeMB = free
				}
			}
		} else if len(fields) >= 3 && strings.HasPrefix(strings.ToLower(fields[0]), "swap") {
			if total, err := strconv.ParseInt(fields[1], 10, 64); err == nil {
				stats.SwapTotalMB = total
			}
			if used, err := strconv.ParseInt(fields[2], 10, 64); err == nil {
				stats.SwapUsedMB = used
			}
		}
	}
}

func parseDisk(lines []string, stats *models.SystemStats) {
	// Usually line 0 is Header: Filesystem Size Used Avail Use% Mounted on
	// line 1 is the root filesystem /
	for i, l := range lines {
		if i == 0 && strings.Contains(strings.ToLower(l), "filesystem") {
			continue
		}
		fields := strings.Fields(l)
		if len(fields) >= 5 {
			stats.DiskTotal = fields[1]
			stats.DiskUsed = fields[2]
			stats.DiskFree = fields[3]
			stats.DiskUsagePercent = fields[4]
			break
		}
	}
}

func parseProcesses(lines []string) []models.ProcessInfo {
	var procs []models.ProcessInfo
	for i, l := range lines {
		if i == 0 && (strings.Contains(l, "PID") || strings.Contains(l, "USER")) {
			continue
		}
		fields := strings.Fields(l)
		if len(fields) >= 11 {
			// USER PID %CPU %MEM VSZ RSS TTY STAT START TIME COMMAND
			cmd := strings.Join(fields[10:], " ")
			procs = append(procs, models.ProcessInfo{
				User:    fields[0],
				PID:     fields[1],
				CPU:     fields[2] + "%",
				Mem:     fields[3] + "%",
				Command: cmd,
			})
		}
	}
	return procs
}
