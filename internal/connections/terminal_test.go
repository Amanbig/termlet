package connections

import (
	"context"
	"strings"
	"testing"
)

func TestSessionTerminalCwdAndInteractive(t *testing.T) {
	profile := Profile{
		ID:             "prof-term",
		Name:           "Terminal Test Server",
		Host:           "127.0.0.1",
		Port:           22,
		Username:       "ubuntu",
		StartDirectory: "/var/www",
	}

	session := NewSession("sess-term", profile, nil, nil)

	// 1. Initial CWD should match profile's StartDirectory
	if cwd := session.GetRemoteCwd(); cwd != "/var/www" {
		t.Fatalf("expected initial cwd '/var/www', got '%s'", cwd)
	}

	// 2. SetRemoteCwd
	session.SetRemoteCwd("/opt/app")
	if cwd := session.GetRemoteCwd(); cwd != "/opt/app" {
		t.Fatalf("expected updated cwd '/opt/app', got '%s'", cwd)
	}

	ctx := context.Background()

	// 3. Empty command
	res, err := session.ExecCommand(ctx, "   ")
	if err != nil {
		t.Fatalf("unexpected error on empty command: %v", err)
	}
	if res.Cwd != "/opt/app" || res.Output != "" {
		t.Fatalf("unexpected result on empty command: %+v", res)
	}

	// 4. Clear command
	res, err = session.ExecCommand(ctx, "clear")
	if err != nil {
		t.Fatalf("unexpected error on clear: %v", err)
	}
	if res.Cwd != "/opt/app" {
		t.Fatalf("unexpected cwd on clear: %+v", res)
	}

	// 5. Interactive command interception (nano / vim / htop)
	res, err = session.ExecCommand(ctx, "nano /etc/nginx/nginx.conf")
	if err != nil {
		t.Fatalf("unexpected error on interactive command: %v", err)
	}
	if res.Error == "" || !strings.Contains(res.Error, "requiring an interactive TTY") {
		t.Fatalf("expected interactive TTY error notice, got: %v", res.Error)
	}
	if !strings.Contains(res.Error, "built-in graphical code editor") {
		t.Fatalf("expected tip about Termlet graphical editor, got: %v", res.Error)
	}

	res, err = session.ExecCommand(ctx, "htop")
	if err != nil {
		t.Fatalf("unexpected error on htop command: %v", err)
	}
	if !strings.Contains(res.Error, "ps aux") {
		t.Fatalf("expected ps aux tip, got: %v", res.Error)
	}

	// 6. Cancel command when none active
	if session.CancelCommand() {
		t.Fatalf("expected CancelCommand to return false when no command is active")
	}

	// 7. Non-interactive command with nil SSH client should fail gracefully
	_, err = session.ExecCommand(ctx, "ls -la")
	if err == nil {
		t.Fatalf("expected error executing without SSH connection")
	}
}
