package storage

import (
	"errors"
	"fmt"

	"github.com/zalando/go-keyring"
)

const ServiceName = "termlet"

// ErrKeyringUnavailable is returned when OS credential storage is not accessible.
var ErrKeyringUnavailable = errors.New("OS secure credential storage is unavailable")

// SecretStorage manages saving and retrieving sensitive credentials like passwords and passphrases.
type SecretStorage struct {
	service string
}

// NewSecretStorage creates a new SecretStorage.
func NewSecretStorage() *SecretStorage {
	return &SecretStorage{
		service: ServiceName,
	}
}

// IsAvailable checks if the secure credential store responds without critical DBus/OS failure.
func (s *SecretStorage) IsAvailable() bool {
	// Probe with a dummy read
	_, err := keyring.Get(s.service, "__probe_test__")
	if errors.Is(err, keyring.ErrNotFound) {
		return true // Keyring responded normally (item just doesn't exist)
	}
	return err == nil
}

// SaveSecret stores a password or passphrase for the given profile ID.
func (s *SecretStorage) SaveSecret(profileID string, secret string) error {
	if profileID == "" {
		return fmt.Errorf("profile ID cannot be empty")
	}

	if secret == "" {
		// If empty, delete any existing secret
		_ = keyring.Delete(s.service, profileID)
		return nil
	}

	if err := keyring.Set(s.service, profileID, secret); err != nil {
		return fmt.Errorf("%w: failed to save secret: %v", ErrKeyringUnavailable, err)
	}
	return nil
}

// GetSecret retrieves the stored password or passphrase for a profile ID.
func (s *SecretStorage) GetSecret(profileID string) (string, error) {
	if profileID == "" {
		return "", fmt.Errorf("profile ID cannot be empty")
	}

	secret, err := keyring.Get(s.service, profileID)
	if err != nil {
		if errors.Is(err, keyring.ErrNotFound) {
			return "", nil // No secret saved, not an error
		}
		return "", fmt.Errorf("%w: failed to get secret: %v", ErrKeyringUnavailable, err)
	}
	return secret, nil
}

// DeleteSecret removes a stored password or passphrase.
func (s *SecretStorage) DeleteSecret(profileID string) error {
	if profileID == "" {
		return nil
	}

	err := keyring.Delete(s.service, profileID)
	if err != nil && !errors.Is(err, keyring.ErrNotFound) {
		return fmt.Errorf("failed to delete secret: %w", err)
	}
	return nil
}
