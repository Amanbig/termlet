package storage

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"sync"
	"termlet/internal/models"
)

// ProfileStorage manages persisting connection profiles to disk.
type ProfileStorage struct {
	mu       sync.RWMutex
	filePath string
}

// NewProfileStorage creates a new ProfileStorage in ~/.config/termlet/profiles.json.
func NewProfileStorage() (*ProfileStorage, error) {
	homeDir, err := os.UserHomeDir()
	if err != nil {
		homeDir = "."
	}

	appDir := filepath.Join(homeDir, ".config", "termlet")
	if err := os.MkdirAll(appDir, 0700); err != nil {
		return nil, fmt.Errorf("failed to create app config dir: %w", err)
	}

	filePath := filepath.Join(appDir, "profiles.json")
	return &ProfileStorage{
		filePath: filePath,
	}, nil
}

// List returns all stored profiles.
func (s *ProfileStorage) List() ([]models.Profile, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return []models.Profile{}, nil
	}

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to read profiles file: %w", err)
	}

	if len(data) == 0 {
		return []models.Profile{}, nil
	}

	var profiles []models.Profile
	if err := json.Unmarshal(data, &profiles); err != nil {
		return nil, fmt.Errorf("failed to parse profiles: %w", err)
	}

	return profiles, nil
}

// Get finds a profile by its ID.
func (s *ProfileStorage) Get(id string) (*models.Profile, error) {
	profiles, err := s.List()
	if err != nil {
		return nil, err
	}

	for _, p := range profiles {
		if p.ID == id {
			return &p, nil
		}
	}
	return nil, fmt.Errorf("profile not found: %s", id)
}

// Save inserts or updates a profile.
func (s *ProfileStorage) Save(profile models.Profile) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	var profiles []models.Profile
	if _, err := os.Stat(s.filePath); err == nil {
		data, err := os.ReadFile(s.filePath)
		if err == nil && len(data) > 0 {
			_ = json.Unmarshal(data, &profiles)
		}
	}

	profile.Normalize()

	found := false
	for i, p := range profiles {
		if p.ID == profile.ID {
			profiles[i] = profile
			found = true
			break
		}
	}

	if !found {
		profiles = append(profiles, profile)
	}

	data, err := json.MarshalIndent(profiles, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize profiles: %w", err)
	}

	if err := os.WriteFile(s.filePath, data, 0600); err != nil {
		return fmt.Errorf("failed to write profiles file: %w", err)
	}

	return nil
}

// Delete removes a profile by ID.
func (s *ProfileStorage) Delete(id string) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, err := os.Stat(s.filePath); os.IsNotExist(err) {
		return nil
	}

	data, err := os.ReadFile(s.filePath)
	if err != nil {
		return fmt.Errorf("failed to read profiles: %w", err)
	}

	var profiles []models.Profile
	if err := json.Unmarshal(data, &profiles); err != nil {
		return fmt.Errorf("failed to parse profiles: %w", err)
	}

	var filtered []models.Profile
	for _, p := range profiles {
		if p.ID != id {
			filtered = append(filtered, p)
		}
	}

	updatedData, err := json.MarshalIndent(filtered, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to serialize profiles: %w", err)
	}

	return os.WriteFile(s.filePath, updatedData, 0600)
}
