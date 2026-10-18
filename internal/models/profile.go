package models

import "time"

// AuthMethod represents the authentication mechanism for SSH.
type AuthMethod string

const (
	AuthMethodPassword   AuthMethod = "password"
	AuthMethodPrivateKey AuthMethod = "private_key"
	AuthMethodAgent      AuthMethod = "agent"
)

// Profile holds saved configuration for an SSH/SFTP connection.
type Profile struct {
	ID             string     `json:"id"`
	Name           string     `json:"name"`
	Host           string     `json:"host"`
	Port           int        `json:"port"`
	Username       string     `json:"username"`
	AuthMethod     AuthMethod `json:"auth_method"`
	KeyPath        string     `json:"key_path,omitempty"`
	StartDirectory string     `json:"start_directory,omitempty"`
	CreatedAt      int64      `json:"created_at"`
	UpdatedAt      int64      `json:"updated_at"`
}

// Normalize ensures reasonable defaults like standard SSH port.
func (p *Profile) Normalize() {
	if p.Port <= 0 {
		p.Port = 22
	}
	if p.AuthMethod == "" {
		p.AuthMethod = AuthMethodPassword
	}
	if p.StartDirectory == "" {
		p.StartDirectory = "."
	}
	now := time.Now().Unix()
	if p.CreatedAt == 0 {
		p.CreatedAt = now
	}
	p.UpdatedAt = now
}
