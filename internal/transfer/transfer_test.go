package transfer

import (
	"bytes"
	"context"
	"errors"
	"io"
	"testing"
	"time"
)

func TestTransferLifecycle(t *testing.T) {
	var emittedEvents []string
	emitFn := func(eventName string, data ...interface{}) {
		emittedEvents = append(emittedEvents, eventName)
	}

	mgr := NewManager(emitFn)

	// 1. Start Transfer
	item, ctx, cancel := mgr.StartTransfer("sess_1", "test.zip", TypeDownload, "/remote/test.zip", "/local/test.zip", 1000)
	if item.ID == "" {
		t.Fatal("expected non-empty transfer ID")
	}
	if item.Status != StatusInProgress {
		t.Fatalf("expected StatusInProgress, got %s", item.Status)
	}

	// 2. Progress writing
	var buf bytes.Buffer
	writer := mgr.WrapWriter(&buf, item.ID, ctx)

	data := make([]byte, 500)
	n, err := writer.Write(data)
	if err != nil || n != 500 {
		t.Fatalf("write failed: %v, written: %d", err, n)
	}

	// Check items
	list := mgr.ListTransfers()
	if len(list) != 1 {
		t.Fatalf("expected 1 item in list, got %d", len(list))
	}
	if list[0].BytesTransferred != 500 {
		t.Fatalf("expected 500 bytes transferred, got %d", list[0].BytesTransferred)
	}

	// 3. Complete
	mgr.SetCompleted(item.ID, 1000)
	completedList := mgr.ListTransfers()
	if completedList[0].Status != StatusCompleted {
		t.Fatalf("expected StatusCompleted, got %s", completedList[0].Status)
	}
	if completedList[0].Percentage != 100 {
		t.Fatalf("expected 100%%, got %f", completedList[0].Percentage)
	}

	// 4. Clear Finished
	mgr.ClearFinished()
	if len(mgr.ListTransfers()) != 0 {
		t.Fatal("expected empty transfer list after ClearFinished")
	}

	cancel()
}

func TestTransferCancellation(t *testing.T) {
	mgr := NewManager(nil)

	item, ctx, _ := mgr.StartTransfer("sess_1", "large.iso", TypeDownload, "/remote/large.iso", "/local/large.iso", 100000)

	err := mgr.CancelTransfer(item.ID)
	if err != nil {
		t.Fatalf("cancel failed: %v", err)
	}

	list := mgr.ListTransfers()
	if list[0].Status != StatusCancelled {
		t.Fatalf("expected StatusCancelled, got %s", list[0].Status)
	}

	// Context should be cancelled
	select {
	case <-ctx.Done():
		// OK
	case <-time.After(100 * time.Millisecond):
		t.Fatal("expected context to be cancelled")
	}

	// Writing should now fail with context error
	var buf bytes.Buffer
	w := mgr.WrapWriter(&buf, item.ID, ctx)
	_, err = w.Write([]byte("hello"))
	if !errors.Is(err, context.Canceled) {
		t.Fatalf("expected context.Canceled, got %v", err)
	}
}

func TestTransferReaderProgress(t *testing.T) {
	mgr := NewManager(nil)

	item, ctx, cancel := mgr.StartTransfer("sess_1", "upload.bin", TypeUpload, "/local/upload.bin", "/remote/upload.bin", 200)
	defer cancel()

	payload := make([]byte, 200)
	rawReader := bytes.NewReader(payload)
	reader := mgr.WrapReader(rawReader, item.ID, ctx)

	out, err := io.ReadAll(reader)
	if err != nil {
		t.Fatalf("read failed: %v", err)
	}
	if len(out) != 200 {
		t.Fatalf("expected 200 bytes, got %d", len(out))
	}

	mgr.SetCompleted(item.ID, 200)
	list := mgr.ListTransfers()
	if list[0].Status != StatusCompleted {
		t.Fatalf("expected completed status, got %s", list[0].Status)
	}
}
