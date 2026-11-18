package syncdir

import (
	"os"
	"path/filepath"
	"testing"

	"termlet/internal/models"
)

func TestCompareMaps(t *testing.T) {
	localMap := map[string]models.FileDiffItem{
		"index.html": {
			Path:         "index.html",
			LocalSize:    1024,
			LocalModTime: 1000,
		},
		"style.css": {
			Path:         "style.css",
			LocalSize:    500,
			LocalModTime: 1000,
		},
		"local-only.txt": {
			Path:         "local-only.txt",
			LocalSize:    100,
			LocalModTime: 1000,
		},
	}

	remoteMap := map[string]models.FileDiffItem{
		"index.html": {
			Path:          "index.html",
			RemoteSize:    1024,
			RemoteModTime: 1001, // within 2s tolerance
		},
		"style.css": {
			Path:          "style.css",
			RemoteSize:    750, // different size
			RemoteModTime: 1500,
		},
		"remote-only.txt": {
			Path:          "remote-only.txt",
			RemoteSize:    200,
			RemoteModTime: 1000,
		},
	}

	res := CompareMaps("/local", "/remote", localMap, remoteMap)
	if res.TotalFiles != 4 {
		t.Fatalf("expected 4 files total, got %d", res.TotalFiles)
	}
	if res.Matches != 1 {
		t.Errorf("expected 1 match (index.html), got %d", res.Matches)
	}
	if res.Differences != 1 {
		t.Errorf("expected 1 difference (style.css), got %d", res.Differences)
	}
	if res.LocalOnly != 1 {
		t.Errorf("expected 1 local-only, got %d", res.LocalOnly)
	}
	if res.RemoteOnly != 1 {
		t.Errorf("expected 1 remote-only, got %d", res.RemoteOnly)
	}
}

func TestScanLocalDirectory(t *testing.T) {
	tmpDir := t.TempDir()

	// Create test files
	_ = os.WriteFile(filepath.Join(tmpDir, "file1.txt"), []byte("hello"), 0644)
	subDir := filepath.Join(tmpDir, "sub")
	_ = os.Mkdir(subDir, 0755)
	_ = os.WriteFile(filepath.Join(subDir, "file2.txt"), []byte("world"), 0644)

	// Create ignored dir
	gitDir := filepath.Join(tmpDir, ".git")
	_ = os.Mkdir(gitDir, 0755)
	_ = os.WriteFile(filepath.Join(gitDir, "HEAD"), []byte("ref"), 0644)

	items, err := ScanLocalDirectory(tmpDir)
	if err != nil {
		t.Fatalf("failed to scan local directory: %v", err)
	}

	if _, ok := items["file1.txt"]; !ok {
		t.Errorf("expected file1.txt to be found")
	}
	if _, ok := items["sub/file2.txt"]; !ok {
		t.Errorf("expected sub/file2.txt to be found")
	}
	if _, ok := items[".git/HEAD"]; ok {
		t.Errorf("expected .git directory to be ignored")
	}
}
