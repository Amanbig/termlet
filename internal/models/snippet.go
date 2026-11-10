package models

import "time"

// Snippet represents a reusable terminal command or script snippet.
type Snippet struct {
	ID          string    `json:"id"`
	Title       string    `json:"title"`
	Command     string    `json:"command"`
	Description string    `json:"description,omitempty"`
	Category    string    `json:"category,omitempty"` // e.g. "System", "Docker", "Network", "Logs", "Git"
	Tags        []string  `json:"tags,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}
