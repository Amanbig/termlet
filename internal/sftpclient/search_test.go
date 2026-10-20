package sftpclient

import (
	"testing"
)

func TestIgnoredDirectories(t *testing.T) {
	expectedIgnored := []string{
		".git",
		"node_modules",
		".next",
		"vendor",
		"dist",
		"build",
		"__pycache__",
		".venv",
	}

	for _, dir := range expectedIgnored {
		if !ignoredDirNames[dir] {
			t.Errorf("expected %s to be in ignoredDirNames, but it was not", dir)
		}
	}
}

func TestSearchFilesNilClient(t *testing.T) {
	var c *Client
	_, err := c.SearchFiles(".", "test", 100)
	if err == nil {
		t.Fatal("expected error with nil client, got nil")
	}
}
