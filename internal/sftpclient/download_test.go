package sftpclient

import (
	"testing"
)

func TestFormatPermissions(t *testing.T) {
	tests := []struct {
		mode     uint32
		isDir    bool
		expected string
	}{
		{0755, true, "drwxr-xr-x"},
		{0644, false, "-rw-r--r--"},
		{0600, false, "-rw-------"},
		{0777, false, "-rwxrwxrwx"},
		{0700, true, "drwx------"},
	}

	for _, tt := range tests {
		got := FormatPermissions(tt.mode, tt.isDir)
		if got != tt.expected {
			t.Errorf("FormatPermissions(%o, %v) = %s, expected %s", tt.mode, tt.isDir, got, tt.expected)
		}
	}
}

func TestNilClientChmod(t *testing.T) {
	var c *Client
	err := c.Chmod("/some/path", 0755, false)
	if err == nil {
		t.Fatal("expected error with nil client, got nil")
	}
}

func TestNilClientDownload(t *testing.T) {
	var c *Client
	err := c.DownloadFile("/remote/path", "/local/path")
	if err == nil {
		t.Fatal("expected error with nil client, got nil")
	}

	err = c.DownloadDirectoryAsZip("/remote/dir", "/local/zip")
	if err == nil {
		t.Fatal("expected error with nil client, got nil")
	}
}
