package transfer

import (
	"context"
	"fmt"
	"io"
	"sync"
	"time"
)

// TransferType indicates whether the operation is a download or upload.
type TransferType string

const (
	TypeDownload TransferType = "download"
	TypeUpload   TransferType = "upload"
)

// TransferStatus indicates current lifecycle of the transfer.
type TransferStatus string

const (
	StatusQueued     TransferStatus = "queued"
	StatusInProgress TransferStatus = "in_progress"
	StatusCompleted  TransferStatus = "completed"
	StatusFailed     TransferStatus = "failed"
	StatusCancelled  TransferStatus = "cancelled"
)

// Item represents a single file transfer record with live progress metrics.
type Item struct {
	ID               string         `json:"id"`
	SessionID        string         `json:"sessionId"`
	Name             string         `json:"name"`
	Type             TransferType   `json:"type"`
	Status           TransferStatus `json:"status"`
	SourcePath       string         `json:"sourcePath"`
	DestPath         string         `json:"destPath"`
	BytesTransferred int64          `json:"bytesTransferred"`
	TotalBytes       int64          `json:"totalBytes"`
	Percentage       float64        `json:"percentage"`
	SpeedBytesPerSec float64        `json:"speedBytesPerSec"`
	Error            string         `json:"error,omitempty"`
	StartTime        int64          `json:"startTime"`
	EndTime          int64          `json:"endTime,omitempty"`
}

// Manager coordinates file transfers, computes speed/progress, and emits update events.
type Manager struct {
	mu        sync.RWMutex
	items     map[string]*Item
	cancels   map[string]context.CancelFunc
	emitEvent func(eventName string, data ...interface{})
}

// NewManager creates a new Transfer Manager.
func NewManager(emitFn func(eventName string, data ...interface{})) *Manager {
	return &Manager{
		items:     make(map[string]*Item),
		cancels:   make(map[string]context.CancelFunc),
		emitEvent: emitFn,
	}
}

// StartTransfer registers and returns a new transfer item and cancellable context.
func (m *Manager) StartTransfer(sessionID, name string, tType TransferType, sourcePath, destPath string, totalBytes int64) (*Item, context.Context, context.CancelFunc) {
	m.mu.Lock()
	defer m.mu.Unlock()

	id := fmt.Sprintf("transfer_%d_%s", time.Now().UnixNano(), name)
	ctx, cancel := context.WithCancel(context.Background())

	item := &Item{
		ID:               id,
		SessionID:        sessionID,
		Name:             name,
		Type:             tType,
		Status:           StatusInProgress,
		SourcePath:       sourcePath,
		DestPath:         destPath,
		BytesTransferred: 0,
		TotalBytes:       totalBytes,
		Percentage:       0,
		SpeedBytesPerSec: 0,
		StartTime:        time.Now().Unix(),
	}

	m.items[id] = item
	m.cancels[id] = cancel

	m.notify(item)

	wrappedCancel := func() {
		cancel()
		m.SetCancelled(id)
	}

	return item, ctx, wrappedCancel
}

// SetCompleted marks a transfer as successfully completed.
func (m *Manager) SetCompleted(id string, totalBytes int64) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, exists := m.items[id]
	if !exists {
		return
	}

	item.Status = StatusCompleted
	item.Percentage = 100
	if totalBytes > 0 {
		item.TotalBytes = totalBytes
		item.BytesTransferred = totalBytes
	} else if item.TotalBytes > 0 {
		item.BytesTransferred = item.TotalBytes
	}
	item.SpeedBytesPerSec = 0
	item.EndTime = time.Now().Unix()
	delete(m.cancels, id)

	m.notify(item)
}

// SetFailed marks a transfer as failed with an error message.
func (m *Manager) SetFailed(id string, err error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, exists := m.items[id]
	if !exists {
		return
	}

	item.Status = StatusFailed
	if err != nil {
		item.Error = err.Error()
	}
	item.SpeedBytesPerSec = 0
	item.EndTime = time.Now().Unix()
	delete(m.cancels, id)

	m.notify(item)
}

// SetCancelled marks a transfer as cancelled by the user.
func (m *Manager) SetCancelled(id string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	item, exists := m.items[id]
	if !exists {
		return
	}

	if item.Status == StatusInProgress || item.Status == StatusQueued {
		item.Status = StatusCancelled
		item.SpeedBytesPerSec = 0
		item.EndTime = time.Now().Unix()
		delete(m.cancels, id)
		m.notify(item)
	}
}

// CancelTransfer cancels an ongoing transfer by ID.
func (m *Manager) CancelTransfer(id string) error {
	m.mu.Lock()
	cancel, exists := m.cancels[id]
	m.mu.Unlock()

	if !exists {
		return fmt.Errorf("transfer not found or already finished")
	}

	cancel()
	m.SetCancelled(id)
	return nil
}

// ListTransfers returns a snapshot copy of all transfer items ordered by newest first.
func (m *Manager) ListTransfers() []Item {
	m.mu.RLock()
	defer m.mu.RUnlock()

	result := make([]Item, 0, len(m.items))
	for _, item := range m.items {
		result = append(result, *item)
	}

	// Sort descending by start time
	for i := 0; i < len(result)-1; i++ {
		for j := i + 1; j < len(result); j++ {
			if result[i].StartTime < result[j].StartTime {
				result[i], result[j] = result[j], result[i]
			}
		}
	}

	return result
}

// ClearFinished removes completed, failed, and cancelled transfers from the list.
func (m *Manager) ClearFinished() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for id, item := range m.items {
		if item.Status == StatusCompleted || item.Status == StatusFailed || item.Status == StatusCancelled {
			delete(m.items, id)
			delete(m.cancels, id)
		}
	}

	if m.emitEvent != nil {
		m.emitEvent("transfer:cleared")
	}
}

// WrapWriter wraps a writer to monitor transfer progress and emit periodic updates.
func (m *Manager) WrapWriter(w io.Writer, id string, ctx context.Context) io.Writer {
	return &progressWriter{
		writer:    w,
		id:        id,
		mgr:       m,
		ctx:       ctx,
		lastEmit:  time.Now(),
		lastBytes: 0,
	}
}

// WrapReader wraps a reader to monitor transfer progress and emit periodic updates.
func (m *Manager) WrapReader(r io.Reader, id string, ctx context.Context) io.Reader {
	return &progressReader{
		reader:    r,
		id:        id,
		mgr:       m,
		ctx:       ctx,
		lastEmit:  time.Now(),
		lastBytes: 0,
	}
}

func (m *Manager) notify(item *Item) {
	if m.emitEvent != nil && item != nil {
		m.emitEvent("transfer:update", *item)
	}
}

type progressWriter struct {
	writer    io.Writer
	id        string
	mgr       *Manager
	ctx       context.Context
	lastEmit  time.Time
	lastBytes int64
}

func (pw *progressWriter) Write(p []byte) (int, error) {
	if pw.ctx != nil && pw.ctx.Err() != nil {
		return 0, pw.ctx.Err()
	}

	n, err := pw.writer.Write(p)
	if n > 0 {
		pw.updateProgress(int64(n))
	}
	return n, err
}

func (pw *progressWriter) updateProgress(n int64) {
	pw.mgr.mu.Lock()
	defer pw.mgr.mu.Unlock()

	item, exists := pw.mgr.items[pw.id]
	if !exists || item.Status != StatusInProgress {
		return
	}

	item.BytesTransferred += n
	now := time.Now()
	elapsed := now.Sub(pw.lastEmit)

	if elapsed >= 150*time.Millisecond {
		bytesDiff := item.BytesTransferred - pw.lastBytes
		if elapsed.Seconds() > 0 {
			item.SpeedBytesPerSec = float64(bytesDiff) / elapsed.Seconds()
		}
		if item.TotalBytes > 0 {
			item.Percentage = float64(item.BytesTransferred) / float64(item.TotalBytes) * 100.0
			if item.Percentage > 100 {
				item.Percentage = 100
			}
		}
		pw.lastEmit = now
		pw.lastBytes = item.BytesTransferred
		pw.mgr.notify(item)
	}
}

type progressReader struct {
	reader    io.Reader
	id        string
	mgr       *Manager
	ctx       context.Context
	lastEmit  time.Time
	lastBytes int64
}

func (pr *progressReader) Read(p []byte) (int, error) {
	if pr.ctx != nil && pr.ctx.Err() != nil {
		return 0, pr.ctx.Err()
	}

	n, err := pr.reader.Read(p)
	if n > 0 {
		pr.updateProgress(int64(n))
	}
	return n, err
}

func (pr *progressReader) updateProgress(n int64) {
	pr.mgr.mu.Lock()
	defer pr.mgr.mu.Unlock()

	item, exists := pr.mgr.items[pr.id]
	if !exists || item.Status != StatusInProgress {
		return
	}

	item.BytesTransferred += n
	now := time.Now()
	elapsed := now.Sub(pr.lastEmit)

	if elapsed >= 150*time.Millisecond {
		bytesDiff := item.BytesTransferred - pr.lastBytes
		if elapsed.Seconds() > 0 {
			item.SpeedBytesPerSec = float64(bytesDiff) / elapsed.Seconds()
		}
		if item.TotalBytes > 0 {
			item.Percentage = float64(item.BytesTransferred) / float64(item.TotalBytes) * 100.0
			if item.Percentage > 100 {
				item.Percentage = 100
			}
		}
		pr.lastEmit = now
		pr.lastBytes = item.BytesTransferred
		pr.mgr.notify(item)
	}
}
