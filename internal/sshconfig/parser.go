package sshconfig

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"termlet/internal/models"
	"time"

	"github.com/google/uuid"
)

// DefaultSSHConfigPath returns the standard ~/.ssh/config location on the current system.
func DefaultSSHConfigPath() string {
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".ssh", "config")
}

// ParseSSHConfig parses an OpenSSH client configuration file into Termlet connection profiles.
func ParseSSHConfig(filePath string) ([]models.Profile, error) {
	if filePath == "" {
		filePath = DefaultSSHConfigPath()
	} else if strings.HasPrefix(filePath, "~") {
		home, err := os.UserHomeDir()
		if err == nil {
			filePath = filepath.Join(home, strings.TrimPrefix(filePath, "~"))
		}
	}

	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("could not open ssh config at %s: %w", filePath, err)
	}
	defer file.Close()

	homeDir, _ := os.UserHomeDir()

	scanner := bufio.NewScanner(file)
	var profiles []models.Profile

	type rawHostEntry struct {
		hosts        []string
		hostName     string
		user         string
		port         int
		identityFile string
		forwards     []models.ForwardedPortConfig
	}

	var current *rawHostEntry
	var globalDefaults rawHostEntry

	flushCurrent := func() {
		if current == nil {
			return
		}

		for _, hostAlias := range current.hosts {
			hostAlias = strings.TrimSpace(hostAlias)
			// Skip wildcards and negation patterns
			if hostAlias == "" || strings.ContainsAny(hostAlias, "*?!") {
				continue
			}

			targetHost := current.hostName
			if targetHost == "" {
				targetHost = hostAlias
			}

			user := current.user
			if user == "" {
				user = globalDefaults.user
			}

			port := current.port
			if port <= 0 {
				port = globalDefaults.port
			}
			if port <= 0 {
				port = 22
			}

			keyPath := current.identityFile
			if keyPath == "" {
				keyPath = globalDefaults.identityFile
			}

			authMethod := models.AuthMethodPassword
			if keyPath != "" {
				authMethod = models.AuthMethodPrivateKey
			}

			now := time.Now().Unix()
			profile := models.Profile{
				ID:             uuid.New().String(),
				Name:           hostAlias,
				Host:           targetHost,
				Port:           port,
				Username:       user,
				AuthMethod:     authMethod,
				KeyPath:        keyPath,
				StartDirectory: ".",
				PortForwards:   current.forwards,
				CreatedAt:      now,
				UpdatedAt:      now,
			}
			profile.Normalize()
			profiles = append(profiles, profile)
		}
		current = nil
	}

	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Split on either whitespace or '='
		var directive, value string
		if eqIdx := strings.Index(line, "="); eqIdx != -1 && (eqIdx < strings.Index(line, " ") || !strings.Contains(line, " ")) {
			directive = strings.TrimSpace(line[:eqIdx])
			value = strings.TrimSpace(line[eqIdx+1:])
		} else {
			parts := strings.Fields(line)
			if len(parts) == 0 {
				continue
			}
			directive = parts[0]
			if len(parts) > 1 {
				value = strings.TrimSpace(line[len(directive):])
			}
		}

		// Strip surrounding quotes if present
		value = strings.Trim(value, `"'`)
		directiveLower := strings.ToLower(directive)

		if directiveLower == "host" {
			flushCurrent()
			hostAliases := strings.Fields(value)
			if len(hostAliases) == 1 && hostAliases[0] == "*" {
				// Global default block
				current = &globalDefaults
			} else {
				current = &rawHostEntry{
					hosts: hostAliases,
				}
			}
			continue
		}

		if current == nil {
			// Lines before any Host directive apply as global defaults
			current = &globalDefaults
		}

		switch directiveLower {
		case "hostname":
			current.hostName = value
		case "user":
			current.user = value
		case "port":
			if p, err := strconv.Atoi(value); err == nil && p > 0 {
				current.port = p
			}
		case "identityfile":
			expanded := value
			if strings.HasPrefix(expanded, "~/") && homeDir != "" {
				expanded = filepath.Join(homeDir, expanded[2:])
			}
			current.identityFile = expanded
		case "localforward":
			// Parse LocalForward: [bind_address:]port host:hostport
			fParts := strings.Fields(value)
			if len(fParts) >= 2 {
				localPortStr := fParts[0]
				remoteEndpoint := fParts[1]

				// If localPortStr is in bind_address:port format, extract port
				if colon := strings.LastIndex(localPortStr, ":"); colon != -1 {
					localPortStr = localPortStr[colon+1:]
				}

				localP, err1 := strconv.Atoi(localPortStr)
				remoteParts := strings.Split(remoteEndpoint, ":")
				if err1 == nil && len(remoteParts) == 2 {
					remoteHost := remoteParts[0]
					remoteP, err2 := strconv.Atoi(remoteParts[1])
					if err2 == nil {
						current.forwards = append(current.forwards, models.ForwardedPortConfig{
							ID:         uuid.New().String(),
							LocalPort:  localP,
							RemoteHost: remoteHost,
							RemotePort: remoteP,
							Name:       fmt.Sprintf("Forward %d -> %s:%d", localP, remoteHost, remoteP),
						})
					}
				}
			}
		}
	}

	flushCurrent()

	if err := scanner.Err(); err != nil {
		return nil, fmt.Errorf("error reading ssh config: %w", err)
	}

	return profiles, nil
}
