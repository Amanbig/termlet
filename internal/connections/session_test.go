package connections

import (
	"errors"
	"sync/atomic"
	"testing"
	"time"
)

func TestSessionLifecycleAndSummary(t *testing.T) {
	profile := Profile{
		ID:             "prof-1",
		Name:           "Test Server",
		Host:           "127.0.0.1",
		Port:           2222,
		Username:       "termlet",
		StartDirectory: "/home/termlet",
		AutoReconnect:  true,
	}

	session := NewSession("sess-1", profile, nil, nil)
	session.SetCachedSecret("supersecret")

	if session.GetCachedSecret() != "supersecret" {
		t.Fatalf("expected cached secret 'supersecret', got %s", session.GetCachedSecret())
	}

	summary := session.Summary()
	if summary.ID != "sess-1" || summary.ProfileName != "Test Server" || summary.Host != "127.0.0.1" {
		t.Fatalf("unexpected summary: %+v", summary)
	}
	if !summary.AutoReconnect {
		t.Fatalf("expected AutoReconnect to be true")
	}

	// Clean close
	if err := session.Close(); err != nil {
		t.Fatalf("unexpected error closing session: %v", err)
	}

	// Double close should be idempotent
	if err := session.Close(); err != nil {
		t.Fatalf("unexpected error on second close: %v", err)
	}
}

func TestSessionMarkDropped(t *testing.T) {
	profile := Profile{
		ID:       "prof-2",
		Name:     "Dropped Server",
		Host:     "10.0.0.1",
		Port:     22,
		Username: "admin",
	}

	session := NewSession("sess-drop", profile, nil, nil)

	var callbackCalled int32
	var droppedReason error

	session.StartKeepAlive(10*time.Millisecond, 5*time.Millisecond, func(sessionID string, reason error) {
		atomic.AddInt32(&callbackCalled, 1)
		droppedReason = reason
	})

	expectedErr := errors.New("network connection reset by peer")
	session.MarkDropped(expectedErr)

	if atomic.LoadInt32(&callbackCalled) != 1 {
		t.Fatalf("expected callback to be called once, got %d", callbackCalled)
	}
	if droppedReason == nil || droppedReason.Error() != expectedErr.Error() {
		t.Fatalf("expected dropped reason '%v', got '%v'", expectedErr, droppedReason)
	}

	if !session.IsDropped() {
		t.Fatalf("expected session.IsDropped() to be true")
	}

	summary := session.Summary()
	if summary.Status != "dropped" {
		t.Fatalf("expected summary status 'dropped', got '%s'", summary.Status)
	}

	// Updating connection should reset dropped state
	session.UpdateConnection(nil, nil)
	if session.IsDropped() {
		t.Fatalf("expected session.IsDropped() to be false after UpdateConnection")
	}
}

func TestSessionCleanCloseNoCallback(t *testing.T) {
	profile := Profile{
		ID:       "prof-3",
		Name:     "Clean Server",
		Host:     "10.0.0.2",
		Port:     22,
		Username: "user",
	}

	session := NewSession("sess-clean", profile, nil, nil)

	var callbackCalled int32
	session.StartKeepAlive(100*time.Millisecond, 20*time.Millisecond, func(sessionID string, reason error) {
		atomic.AddInt32(&callbackCalled, 1)
	})

	// Clean close before any drop
	if err := session.Close(); err != nil {
		t.Fatalf("unexpected error closing: %v", err)
	}

	time.Sleep(30 * time.Millisecond)

	if atomic.LoadInt32(&callbackCalled) != 0 {
		t.Fatalf("callback should NOT be called on clean Close()")
	}

	if session.IsDropped() {
		t.Fatalf("clean close should not mark session as dropped")
	}
}
