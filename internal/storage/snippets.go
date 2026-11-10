package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"time"

	"github.com/google/uuid"
	"termlet/internal/models"
)

// SnippetStorage manages persisting command snippets to disk.
type SnippetStorage struct {
	mu       sync.RWMutex
	filePath string
}

// DefaultSnippets returns a curated set of helpful everyday server commands.
func DefaultSnippets() []models.Snippet {
	now := time.Now()
	return []models.Snippet{
		{
			ID:          "default-sys-info",
			Title:       "System & OS Release Info",
			Command:     "uname -a && cat /etc/os-release | head -n 8",
			Description: "Displays kernel version and Linux distribution details",
			Category:    "System",
			Tags:        []string{"os", "kernel", "info"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-disk-mem",
			Title:       "Disk Space & Memory Usage",
			Command:     "df -h / && echo '' && free -h",
			Description: "Quick summary of root filesystem storage and RAM usage",
			Category:    "System",
			Tags:        []string{"disk", "ram", "memory", "storage"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-top-mem-proc",
			Title:       "Top 10 Memory Consuming Processes",
			Command:     "ps aux --sort=-%mem | head -n 11",
			Description: "Lists processes consuming the highest amount of physical RAM",
			Category:    "System",
			Tags:        []string{"process", "ram", "top"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-top-cpu-proc",
			Title:       "Top 10 CPU Consuming Processes",
			Command:     "ps aux --sort=-%cpu | head -n 11",
			Description: "Lists processes consuming the most CPU time",
			Category:    "System",
			Tags:        []string{"process", "cpu", "top"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-listening-ports",
			Title:       "Listening TCP/UDP Ports",
			Command:     "ss -tulpn",
			Description: "Shows open listening sockets and their associated process names",
			Category:    "Network",
			Tags:        []string{"ports", "network", "ss", "tcp"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-ip-brief",
			Title:       "Network Interfaces & IP Addresses",
			Command:     "ip -br a",
			Description: "Displays network interfaces and assigned IPs in concise tabular format",
			Category:    "Network",
			Tags:        []string{"ip", "interfaces", "network"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-docker-containers",
			Title:       "Docker Containers Overview",
			Command:     `docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}\t{{.Image}}"`,
			Description: "Clean table view of all running and stopped Docker containers",
			Category:    "Docker",
			Tags:        []string{"docker", "containers"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-docker-stats",
			Title:       "Docker Resource Usage Snapshot",
			Command:     "docker stats --no-stream",
			Description: "Non-streaming snapshot of CPU, RAM, and network I/O per container",
			Category:    "Docker",
			Tags:        []string{"docker", "stats", "metrics"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-journal-errors",
			Title:       "Recent Systemd Error Logs",
			Command:     "journalctl -p 3 -xb -n 30 --no-pager",
			Description: "Shows the 30 most recent error-priority logs from current boot",
			Category:    "Logs",
			Tags:        []string{"journalctl", "systemd", "errors", "logs"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-active-services",
			Title:       "Running Systemd Services",
			Command:     "systemctl list-units --type=service --state=running",
			Description: "Lists all actively running system services",
			Category:    "System",
			Tags:        []string{"systemctl", "services", "systemd"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
		{
			ID:          "default-git-status",
			Title:       "Git Short Status & Branch",
			Command:     "git status -s -b",
			Description: "Shows concise git status and tracking branch",
			Category:    "Git",
			Tags:        []string{"git", "repo", "vcs"},
			CreatedAt:   now,
			UpdatedAt:   now,
		},
	}
}

// NewSnippetStorage creates a new SnippetStorage in ~/.config/termlet/snippets.json.
func NewSnippetStorage() (*SnippetStorage, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}

	appDir := filepath.Join(homeDir, ".config", "termlet")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create app config dir: %w", err)
	}

	filePath := filepath.Join(appDir, "snippets.json")
	return NewSnippetStorageWithPath(filePath)
}

// NewSnippetStorageWithPath creates a SnippetStorage using a specific file path.
func NewSnippetStorageWithPath(filePath string) (*SnippetStorage, error) {
	store := &SnippetStorage{
		filePath: filePath,
	}

	// Seed defaults if the file does not exist
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		defaults := DefaultSnippets()
		data, err := json.MarshalIndent(defaults, "", "  ")
		if err == nil {
			_ = os.WriteFile(filePath, data, 0600)
		}
	}

	return store, nil
}

// List returns all stored snippets.
func (s *SnippetStorage) List() ([]models.Snippet, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return []models.Snippet{}, nil
	}

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read snippets file: %w", err)
	}

	if len(data) == 0 {
		return []models.Snippet{}, nil
	}

	var snippets []models.Snippet
	if err := json.Unmarshal(data, &snippets); err != nil {
		return nil, fmt.Errorf("failed to parse snippets: %w", err)
	}

	return snippets, nil
}

// Get finds a snippet by its ID.
func (s *SnippetStorage) Get(id string) (*models.Snippet, error) {
	snippets, err := s.List()
	if err != nil {
		return nil, err
	}

	for _, snip := range snippets {
		if snip.ID == id {
			return &snip, nil
		}
	}
	return nil, fmt.Errorf("snippet not found: %s", id)
}

// Save inserts or updates a snippet.
func (s *SnippetStorage) Save(snippet models.Snippet) (*models.Snippet, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	var snippets []models.Snippet
	if _, err := os.Stat(s.filePath); err == nil {
		data, err := os.ReadFile(s.filePath)
		if err == nil && len(data) > 0 {
			_ = json.Unmarshal(data, &snippets)
		}
	}

	now := time.Now()
	if snippet.ID == "" {
		snippet.ID = uuid.New().String()
		snippet.CreatedAt = now
	}
	snippet.UpdatedAt = now

	found := false
	for i, existing := range snippets {
		if existing.ID == snippet.ID {
			if snippet.CreatedAt.IsZero() {
				snippet.CreatedAt = existing.CreatedAt
			}
			snippets[i] = snippet
			found = true
			break
		}
	}

	if !found {
		if snippet.CreatedAt.IsZero() {
			snippet.CreatedAt = now
		}
		snippets = append(snippets, snippet)
	}

	data, err := json.MarshalIndent(snippets, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to serialize snippets: %w", err)
	}

	if err := os.WriteFile(s.filePath, data, 0600); err != nil {
		return nil, fmt.Errorf("failed to write snippets file: %w", err)
	}

	return &snippet, nil
}

// Delete removes a snippet by ID.
func (s *SnippetStorage) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return nil
	}

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return fmt.Errorf("failed to read snippets: %w", err)
	}

	var snippets []models.Snippet
	if err := json.Unmarshal(data, &snippets); err != nil {
		return fmt.Errorf("failed to parse snippets: %w", err)
	}

	var filtered []models.Snippet
	for _, snip := range snippets {
		if snip.ID != id {
			filtered = append(filtered, snip)
		}
	}

	updatedData, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize snippets: %w", err)
	}

	return os.WriteFile(s.filePath, updatedData, 0600)
}

// ResetDefaults restores the default snippet list.
func (s *SnippetStorage) ResetDefaults() ([]models.Snippet, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	defaults := DefaultSnippets()
	data, err := json.MarshalIndent(defaults, "", "  ")
	if err != nil {
		return nil, fmt.Errorf("failed to serialize default snippets: %w", err)
	}

	if err := os.WriteFile(s.filePath, data, 0600); err != nil {
		return nil, fmt.Errorf("failed to write default snippets: %w", err)
	}

	return defaults, nil
}
