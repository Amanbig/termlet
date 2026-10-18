package sshclient

import (
	"fmt"
	"net"
	"os"

	"golang.org/x/crypto/ssh"
	"golang.org/x/crypto/ssh/agent"
)

// CreatePasswordAuth returns an ssh.AuthMethod using password.
func CreatePasswordAuth(password string) ssh.AuthMethod {
	return ssh.Password(password)
}

// CreatePrivateKeyAuth returns an ssh.AuthMethod from a private key file.
func CreatePrivateKeyAuth(keyPath string, passphrase string) (ssh.AuthMethod, error) {
	keyBytes, err := os.ReadFile(keyPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read private key file: %w", err)
	}

	var signer ssh.Signer
	if passphrase != "" {
		signer, err = ssh.ParsePrivateKeyWithPassphrase(keyBytes, []byte(passphrase))
		if err != nil {
			return nil, fmt.Errorf("failed to parse encrypted private key: %w", err)
		}
	} else {
		signer, err = ssh.ParsePrivateKey(keyBytes)
		if err != nil {
			// If key is encrypted, it asks for passphrase
			return nil, fmt.Errorf("failed to parse private key (may require passphrase): %w", err)
		}
	}

	return ssh.PublicKeys(signer), nil
}

// CreateAgentAuth returns an ssh.AuthMethod using the system SSH agent if available.
func CreateAgentAuth() (ssh.AuthMethod, error) {
	socket := os.Getenv("SSH_AUTH_SOCK")
	if socket == "" {
		return nil, fmt.Errorf("SSH_AUTH_SOCK is not set")
	}

	conn, err := net.Dial("unix", socket)
	if err != nil {
		return nil, fmt.Errorf("failed to connect to SSH agent: %w", err)
	}

	agentClient := agent.NewClient(conn)
	signers, err := agentClient.Signers()
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("failed to get signers from SSH agent: %w", err)
	}

	if len(signers) == 0 {
		_ = conn.Close()
		return nil, fmt.Errorf("no identities in SSH agent")
	}

	return ssh.PublicKeysCallback(agentClient.Signers), nil
}

// BuildAuthMethods constructs the appropriate slice of ssh.AuthMethod.
func BuildAuthMethods(authMethod string, keyPath string, password string, passphrase string) ([]ssh.AuthMethod, error) {
	var methods []ssh.AuthMethod

	switch authMethod {
	case "password":
		if password == "" {
			return nil, fmt.Errorf("password is required")
		}
		methods = append(methods, CreatePasswordAuth(password))

	case "private_key":
		if keyPath == "" {
			return nil, fmt.Errorf("private key path is required")
		}
		auth, err := CreatePrivateKeyAuth(keyPath, passphrase)
		if err != nil {
			return nil, err
		}
		methods = append(methods, auth)

	case "agent":
		auth, err := CreateAgentAuth()
		if err != nil {
			return nil, err
		}
		methods = append(methods, auth)

	default:
		// Try password if present, or agent
		if password != "" {
			methods = append(methods, CreatePasswordAuth(password))
		}
	}

	if len(methods) == 0 {
		return nil, fmt.Errorf("no valid authentication method available")
	}

	return methods, nil
}
