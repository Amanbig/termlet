package connections

import (
	"errors"
	"sync/atomic"
	"testing"
)

func TestManagerDroppedHandler(t *testing.T) {
	mgr := &Manager{
		sessions: make(map[string]*Session),
	}

	profile := Profile{
		ID:       "prof-test",
		Name:     "Test Drop Host",
		Host:     "192.168.1.50",
		Port:     22,
		Username: "ubuntu",
	}

	session := NewSession("test-sess-1", profile, nil, nil)
	mgr.sessions["test-sess-1"] = session

	var droppedCalled int32
	var reportedSID string
	var reportedErr error

	mgr.SetDroppedHandler(func(sessionID string, prof Profile, reason error) {
		atomic.AddInt32(&droppedCalled, 1)
		reportedSID = sessionID
		reportedErr = reason
	})

	testErr := errors.New("broken pipe")
	mgr.handleDropped("test-sess-1", testErr)

	if atomic.LoadInt32(&droppedCalled) != 1 {
		t.Fatalf("expected dropped handler to be called once, got %d", droppedCalled)
	}
	if reportedSID != "test-sess-1" {
		t.Fatalf("expected reported SID 'test-sess-1', got '%s'", reportedSID)
	}
	if reportedErr == nil || reportedErr.Error() != "broken pipe" {
		t.Fatalf("expected reported err 'broken pipe', got '%v'", reportedErr)
	}

	// Verify Disconnect cleans up
	if err := mgr.Disconnect("test-sess-1"); err != nil {
		t.Fatalf("unexpected error disconnecting: %v", err)
	}

	if len(mgr.ListSessions()) != 0 {
		t.Fatalf("expected 0 sessions after Disconnect, got %d", len(mgr.ListSessions()))
	}
}
