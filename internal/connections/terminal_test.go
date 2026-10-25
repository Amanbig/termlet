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

func TestMultipleTerminalTabs(t *testing.T) {
	profile := Profile{
		ID:             "prof-multi",
		Name:           "Multi-Terminal Server",
		Host:           "127.0.0.1",
		Port:           22,
		Username:       "root",
		StartDirectory: "/home/root",
	}

	session := NewSession("sess-multi", profile, nil, nil)

	// 1. Default terminal should start at /home/root
	if cwd := session.GetRemoteCwd("term-1"); cwd != "/home/root" {
		t.Fatalf("expected initial cwd '/home/root', got '%s'", cwd)
	}

	// 2. Setting CWD on term-1 should not affect term-2
	session.SetRemoteCwd("/var/log", "term-1")
	session.SetRemoteCwd("/etc/nginx", "term-2")

	if cwd1 := session.GetRemoteCwd("term-1"); cwd1 != "/var/log" {
		t.Fatalf("expected term-1 cwd '/var/log', got '%s'", cwd1)
	}
	if cwd2 := session.GetRemoteCwd("term-2"); cwd2 != "/etc/nginx" {
		t.Fatalf("expected term-2 cwd '/etc/nginx', got '%s'", cwd2)
	}

	// 3. Closing term-2 and re-checking
	session.CloseTerminal("term-2")
	// Re-accessing closed term-2 should re-initialize to StartDirectory
	if cwd2Reopened := session.GetRemoteCwd("term-2"); cwd2Reopened != "/home/root" {
		t.Fatalf("expected re-opened term-2 cwd to reset to startDir '/home/root', got '%s'", cwd2Reopened)
	}

	// term-1 should still have /var/log
	if cwd1 := session.GetRemoteCwd("term-1"); cwd1 != "/var/log" {
		t.Fatalf("expected term-1 cwd to remain '/var/log', got '%s'", cwd1)
	}
}
