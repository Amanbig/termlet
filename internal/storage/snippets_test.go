package storage

import (
	"os"
	"path/filepath"
	"testing"
	"termlet/internal/models"
)

func TestSnippetStorageLifecycle(t *testing.T) {
	tempDir, err := os.MkdirTemp("", "snippets-test-*")
	if err != nil {
		t.Fatalf("failed to create temp dir: %v", err)
	}
	defer os.RemoveAll(tempDir)

	filePath := filepath.Join(tempDir, "snippets.json")

	// 1. Initialize store: should automatically seed defaults
	store, err := NewSnippetStorageWithPath(filePath)
	if err != nil {
		t.Fatalf("failed to create snippet storage: %v", err)
	}

	snippets, err := store.List()
	if err != nil {
		t.Fatalf("failed to list snippets: %v", err)
	}
	if len(snippets) == 0 {
		t.Fatalf("expected seeded default snippets, got 0")
	}

	initialCount := len(snippets)

	// 2. Add a new custom snippet
	newSnippet := models.Snippet{
		Title:       "Test Docker Clean",
		Command:     "docker system prune -f",
		Description: "Remove unused Docker data",
		Category:    "Docker",
		Tags:        []string{"cleanup", "docker"},
	}

	saved, err := store.Save(newSnippet)
	if err != nil {
		t.Fatalf("failed to save snippet: %v", err)
	}
	if saved.ID == "" {
		t.Fatalf("expected non-empty ID for saved snippet")
	}

	// 3. Verify it is returned in List
	snippets, err = store.List()
	if err != nil {
		t.Fatalf("failed to list snippets after save: %v", err)
	}
	if len(snippets) != initialCount+1 {
		t.Fatalf("expected %d snippets, got %d", initialCount+1, len(snippets))
	}

	// 4. Get by ID
	found, err := store.Get(saved.ID)
	if err != nil {
		t.Fatalf("failed to get snippet by ID: %v", err)
	}
	if found.Title != "Test Docker Clean" {
		t.Fatalf("expected title %q, got %q", "Test Docker Clean", found.Title)
	}

	// 5. Update snippet
	found.Title = "Test Docker Clean Updated"
	updated, err := store.Save(*found)
	if err != nil {
		t.Fatalf("failed to update snippet: %v", err)
	}
	if updated.Title != "Test Docker Clean Updated" {
		t.Fatalf("expected updated title %q, got %q", "Test Docker Clean Updated", updated.Title)
	}

	// Count should still be initialCount + 1
	snippets, err = store.List()
	if err != nil || len(snippets) != initialCount+1 {
		t.Fatalf("expected count %d after update, got %d", initialCount+1, len(snippets))
	}

	// 6. Delete snippet
	if err := store.Delete(saved.ID); err != nil {
		t.Fatalf("failed to delete snippet: %v", err)
	}
	snippets, err = store.List()
	if err != nil || len(snippets) != initialCount {
		t.Fatalf("expected count %d after delete, got %d", initialCount, len(snippets))
	}

	// 7. Reset defaults
	resetList, err := store.ResetDefaults()
	if err != nil {
		t.Fatalf("failed to reset defaults: %v", err)
	}
	if len(resetList) != initialCount {
		t.Fatalf("expected reset defaults count %d, got %d", initialCount, len(resetList))
	}
}
