package connections

import "termlet/internal/models"

// Re-export model types for convenience
type AuthMethod = models.AuthMethod

const (
	AuthMethodPassword   = models.AuthMethodPassword
	AuthMethodPrivateKey = models.AuthMethodPrivateKey
	AuthMethodAgent      = models.AuthMethodAgent
)

type Profile = models.Profile
