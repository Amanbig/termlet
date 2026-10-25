package main

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/base64"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"runtime"
	"strings"
	"termlet/internal/connections"
	"termlet/internal/models"
	"termlet/internal/sftpclient"
	"termlet/internal/sshconfig"
	"termlet/internal/sshkeys"
	"termlet/internal/storage"
	"termlet/internal/transfer"
	"termlet/internal/tunnel"
	"termlet/internal/updater"
	"termlet/internal/version"

	wailsRuntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

//go:embed RELEASE_NOTES.md
var embeddedReleaseNotes string

// App is the main application bridge between Wails frontend and Go backend.
type App struct {
	ctx              context.Context
	initialProfileID string
	connMgr          *connections.Manager
	profileStore     *storage.ProfileStorage
	secretStore      *storage.SecretStorage
	updater          *updater.Updater
	tunnelMgr        *tunnel.Manager
	transferMgr      *transfer.Manager
}

// ConnectResponse wraps the outcome of a Connect request.
type ConnectResponse struct {
	Success       bool                        `json:"success"`
	Session       *connections.SessionSummary `json:"session,omitempty"`
	HostKeyPrompt *models.HostKeyPrompt       `json:"host_key_prompt,omitempty"`
	Error         string                      `json:"error,omitempty"`
}

// NewApp creates a new App application struct.
func NewApp(initialProfileID string) *App {
	profileStore, err := storage.NewProfileStorage()
	if err != nil {
		fmt.Printf("warning: failed to init profile storage: %v\n", err)
	}

	secretStore := storage.NewSecretStorage()

	connMgr, err := connections.NewManager(profileStore, secretStore)
	if err != nil {
		fmt.Printf("warning: failed to init connection manager: %v\n", err)
	}

	upd := updater.NewUpdater()
	tunnelMgr := tunnel.NewManager()

	app := &App{
		initialProfileID: initialProfileID,
		profileStore:     profileStore,
		secretStore:      secretStore,
		connMgr:          connMgr,
		updater:          upd,
		tunnelMgr:        tunnelMgr,
	}

	app.transferMgr = transfer.NewManager(func(eventName string, data ...interface{}) {
		if app.ctx != nil {
			wailsRuntime.EventsEmit(app.ctx, eventName, data...)
		}
	})

	return app
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.connMgr != nil {
		a.connMgr.SetDroppedHandler(func(sessionID string, profile connections.Profile, reason error) {
			if a.ctx != nil {
				wailsRuntime.EventsEmit(a.ctx, "session:dropped", map[string]interface{}{
					"sessionId":   sessionID,
					"profileId":   profile.ID,
					"profileName": profile.Name,
					"host":        profile.Host,
					"port":        profile.Port,
					"error":       reason.Error(),
				})
			}
		})
	}
}

// shutdown is called during application termination.
func (a *App) shutdown(ctx context.Context) {
	if a.tunnelMgr != nil {
		a.tunnelMgr.CloseAll()
	}
	if a.connMgr != nil {
		a.connMgr.CloseAll()
	}
}

// --- Profile & Secret Management ---

// ListProfiles returns all saved connection profiles.
func (a *App) ListProfiles() ([]models.Profile, error) {
	if a.profileStore == nil {
		return []models.Profile{}, nil
	}
	return a.profileStore.List()
}

// SaveProfile creates or updates a profile, optionally storing its password securely.
func (a *App) SaveProfile(profile models.Profile, secret string) error {
	if a.profileStore == nil {
		return fmt.Errorf("profile storage is not initialized")
	}

	if err := a.profileStore.Save(profile); err != nil {
		return err
	}

	if secret != "" && a.secretStore != nil {
		_ = a.secretStore.SaveSecret(profile.ID, secret)
	}

	return nil
}

// DeleteProfile removes a profile and its stored secrets.
func (a *App) DeleteProfile(id string) error {
	if a.profileStore == nil {
		return nil
	}

	if a.secretStore != nil {
		_ = a.secretStore.DeleteSecret(id)
	}

	return a.profileStore.Delete(id)
}

// GetProfileSecret retrieves the stored password/passphrase for a profile if available.
func (a *App) GetProfileSecret(id string) (string, error) {
	if a.secretStore == nil {
		return "", nil
	}
	return a.secretStore.GetSecret(id)
}

// GetDefaultSSHConfigPath returns the default location of the ~/.ssh/config file.
func (a *App) GetDefaultSSHConfigPath() string {
	return sshconfig.DefaultSSHConfigPath()
}

// ParseSSHConfig reads and parses host entries from an SSH config file.
func (a *App) ParseSSHConfig(filePath string) ([]models.Profile, error) {
	return sshconfig.ParseSSHConfig(filePath)
}

// ImportSSHConfigProfiles imports a list of parsed SSH profiles into local profile storage.
func (a *App) ImportSSHConfigProfiles(profiles []models.Profile, overwriteExisting bool) (int, error) {
	if a.profileStore == nil {
		return 0, fmt.Errorf("profile storage is not initialized")
	}

	existingProfiles, err := a.profileStore.List()
	if err != nil {
		existingProfiles = []models.Profile{}
	}

	existingMap := make(map[string]models.Profile)
	for _, p := range existingProfiles {
		existingMap[strings.ToLower(p.Name)] = p
	}

	importedCount := 0
	for _, p := range profiles {
		key := strings.ToLower(p.Name)
		if existing, exists := existingMap[key]; exists {
			if !overwriteExisting {
				continue
			}
			// Keep existing ID if overwriting
			p.ID = existing.ID
		}
		if err := a.profileStore.Save(p); err == nil {
			importedCount++
		}
	}

	return importedCount, nil
}

// --- Connection Management ---

// Connect starts an SSH & SFTP session using the provided profile.
func (a *App) Connect(profile models.Profile, password string, trustKey bool) (*ConnectResponse, error) {
	if a.connMgr == nil {
		return &ConnectResponse{
			Success: false,
			Error:   "connection manager not initialized",
		}, nil
	}

	// Guard against duplicate connection attempts if this profile is already actively connected
	if profile.ID != "" {
		for _, s := range a.connMgr.ListSessions() {
			if s.ProfileID == profile.ID && s.IsAlive {
				return &ConnectResponse{
					Success: true,
					Session: &s,
				}, nil
			}
		}
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	session, prompt, err := a.connMgr.Connect(ctx, profile, password, trustKey)
	if err != nil {
		return &ConnectResponse{
			Success:       false,
			HostKeyPrompt: prompt,
			Error:         err.Error(),
		}, nil
	}

	if prompt != nil {
		return &ConnectResponse{
			Success:       false,
			HostKeyPrompt: prompt,
		}, nil
	}

	summary := session.Summary()

	// Pre-populate any saved port forwards from the profile into the tunnel manager (in stopped state)
	if a.tunnelMgr != nil {
		p := &profile
		if a.profileStore != nil && profile.ID != "" {
			if storedP, err := a.profileStore.Get(profile.ID); err == nil && storedP != nil {
				p = storedP
			}
		}
		for _, pf := range p.PortForwards {
			a.tunnelMgr.AddConfiguredTunnel(pf.ID, session.ID, pf.LocalPort, pf.RemoteHost, pf.RemotePort, pf.Name)
		}
	}

	return &ConnectResponse{
		Success: true,
		Session: &summary,
	}, nil
}

// Reconnect attempts to re-establish an SSH and SFTP session after a dropped connection.
func (a *App) Reconnect(sessionID string) (*ConnectResponse, error) {
	if a.connMgr == nil {
		return &ConnectResponse{
			Success: false,
			Error:   "connection manager not initialized",
		}, nil
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	session, prompt, err := a.connMgr.Reconnect(ctx, sessionID)
	if err != nil {
		return &ConnectResponse{
			Success:       false,
			HostKeyPrompt: prompt,
			Error:         err.Error(),
		}, nil
	}

	if prompt != nil {
		return &ConnectResponse{
			Success:       false,
			HostKeyPrompt: prompt,
		}, nil
	}

	// Resume any tunnels that were configured/active for this session
	if a.tunnelMgr != nil {
		tunnels := a.tunnelMgr.ListTunnels(sessionID)
		for _, tun := range tunnels {
			if tun.Status == "active" || tun.Status == "error" {
				_, _ = a.tunnelMgr.RestartForwarding(tun.ID, session.SSH)
			}
		}
	}

	summary := session.Summary()
	if a.ctx != nil {
		wailsRuntime.EventsEmit(a.ctx, "session:reconnected", summary)
	}

	return &ConnectResponse{
		Success: true,
		Session: &summary,
	}, nil
}

// Disconnect terminates an active session.
func (a *App) Disconnect(sessionID string) error {
	if a.tunnelMgr != nil {
		a.tunnelMgr.CloseSessionTunnels(sessionID)
	}
	if a.connMgr == nil {
		return nil
	}
	return a.connMgr.Disconnect(sessionID)
}

// ListActiveSessions returns summaries of all connected sessions.
func (a *App) ListActiveSessions() []connections.SessionSummary {
	if a.connMgr == nil {
		return []connections.SessionSummary{}
	}
	return a.connMgr.ListSessions()
}

// --- Remote Filesystem Operations ---

// getSFTPClient safely retrieves the SFTP client for a session with nil guards.
func (a *App) getSFTPClient(sessionID string) (*sftpclient.Client, error) {
	if a.connMgr == nil {
		return nil, fmt.Errorf("connection manager is not initialized")
	}
	if strings.TrimSpace(sessionID) == "" {
		return nil, fmt.Errorf("session ID is required")
	}

	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	return sess.GetSFTP()
}

// ListRemoteFiles lists entries in the specified remote directory.
func (a *App) ListRemoteFiles(sessionID string, remotePath string) ([]models.RemoteFile, error) {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return nil, err
	}
	return sftpCl.ListDirectory(remotePath)
}

// SearchRemoteFiles searches for files under a remote directory matching a query.
func (a *App) SearchRemoteFiles(sessionID string, rootPath string, query string, maxResults int) ([]models.RemoteFile, error) {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return nil, err
	}
	return sftpCl.SearchFiles(rootPath, query, maxResults)
}

// ReadRemoteFile retrieves the contents and metadata of a file.
func (a *App) ReadRemoteFile(sessionID string, filePath string) (*models.FileContent, error) {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return nil, err
	}
	return sftpCl.ReadFile(filePath, 0)
}

// SaveRemoteFile safely saves edited content to the remote server.
func (a *App) SaveRemoteFile(sessionID string, filePath string, content string, checkModTime int64) (*sftpclient.SaveResult, error) {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return nil, err
	}
	return sftpCl.SaveFile(filePath, content, checkModTime)
}

// CreateRemoteFile creates a new empty file on the remote server.
func (a *App) CreateRemoteFile(sessionID string, filePath string) error {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	return sftpCl.CreateFile(filePath)
}

// CreateRemoteDirectory creates a new directory on the remote server.
func (a *App) CreateRemoteDirectory(sessionID string, dirPath string) error {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	return sftpCl.CreateDirectory(dirPath)
}

// DeleteRemotePath deletes a remote file or folder.
func (a *App) DeleteRemotePath(sessionID string, targetPath string, isDir bool) error {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	return sftpCl.DeletePath(targetPath, isDir)
}

// RenameRemotePath renames or moves a remote file or folder.
func (a *App) RenameRemotePath(sessionID string, oldPath string, newPath string) error {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	return sftpCl.Rename(oldPath, newPath)
}

// ChmodRemotePath changes permissions of a remote file or directory.
func (a *App) ChmodRemotePath(sessionID string, remotePath string, mode uint32, recursive bool) error {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return err
	}
	return sftpCl.Chmod(remotePath, mode, recursive)
}

// DownloadRemotePath prompts the user for a local save path and downloads the file or directory (as a zip archive).
// Returns the local file path if downloaded, or empty string if canceled by user.
func (a *App) DownloadRemotePath(sessionID string, remotePath string, isDir bool) (string, error) {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return "", err
	}

	baseName := path.Base(remotePath)
	dialogTitle := fmt.Sprintf("Save %s", baseName)
	defaultFilename := baseName

	if isDir {
		dialogTitle = fmt.Sprintf("Download Folder Archive: %s", baseName)
		defaultFilename = baseName + ".zip"
	}

	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	localPath, err := wailsRuntime.SaveFileDialog(ctx, wailsRuntime.SaveDialogOptions{
		Title:           dialogTitle,
		DefaultFilename: defaultFilename,
	})
	if err != nil {
		return "", fmt.Errorf("failed to open save dialog: %w", err)
	}
	if localPath == "" {
		// User canceled
		return "", nil
	}

	var fileSize int64 = 0
	if !isDir {
		if sz, szErr := sftpCl.GetFileSize(remotePath); szErr == nil {
			fileSize = sz
		}
	}

	var item *transfer.Item
	var transferCtx context.Context = ctx
	var transferCancel context.CancelFunc

	if a.transferMgr != nil {
		transferName := filepath.Base(localPath)
		item, transferCtx, transferCancel = a.transferMgr.StartTransfer(sessionID, transferName, transfer.TypeDownload, remotePath, localPath, fileSize)
	}

	var downloadErr error
	if isDir {
		var wrapWriter func(io.Writer) io.Writer
		if a.transferMgr != nil && item != nil {
			wrapWriter = func(w io.Writer) io.Writer {
				return a.transferMgr.WrapWriter(w, item.ID, transferCtx)
			}
		}
		downloadErr = sftpCl.DownloadDirectoryAsZipWithProgress(transferCtx, remotePath, localPath, wrapWriter)
	} else {
		var wrapWriter func(io.Writer) io.Writer
		if a.transferMgr != nil && item != nil {
			wrapWriter = func(w io.Writer) io.Writer {
				return a.transferMgr.WrapWriter(w, item.ID, transferCtx)
			}
		}
		downloadErr = sftpCl.DownloadFileWithProgress(transferCtx, remotePath, localPath, wrapWriter)
	}

	if a.transferMgr != nil && item != nil {
		if downloadErr != nil {
			if errors.Is(downloadErr, context.Canceled) {
				a.transferMgr.SetCancelled(item.ID)
			} else {
				a.transferMgr.SetFailed(item.ID, downloadErr)
			}
		} else {
			if fi, fiErr := os.Stat(localPath); fiErr == nil {
				a.transferMgr.SetCompleted(item.ID, fi.Size())
			} else {
				a.transferMgr.SetCompleted(item.ID, fileSize)
			}
		}
		if transferCancel != nil {
			transferCancel()
		}
	}

	if downloadErr != nil {
		return "", downloadErr
	}
	return localPath, nil
}

// SelectPrivateKeyFile opens a native OS file picker allowing the user to select an SSH private key file from disk.
func (a *App) SelectPrivateKeyFile() (string, error) {
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}

	homeDir, _ := os.UserHomeDir()
	defaultDir := ""
	if homeDir != "" {
		sshDir := filepath.Join(homeDir, ".ssh")
		if info, err := os.Stat(sshDir); err == nil && info.IsDir() {
			defaultDir = sshDir
		} else {
			defaultDir = homeDir
		}
	}

	selectedFile, err := wailsRuntime.OpenFileDialog(ctx, wailsRuntime.OpenDialogOptions{
		Title:            "Select SSH Private Key File",
		DefaultDirectory: defaultDir,
		Filters: []wailsRuntime.FileFilter{
			{
				DisplayName: "All Files (*)",
				Pattern:     "*",
			},
			{
				DisplayName: "SSH & PEM Key Files (*.pem, *.key, id_*)",
				Pattern:     "*.pem;*.key;id_*",
			},
		},
	})
	if err != nil {
		return "", fmt.Errorf("failed to open file dialog: %w", err)
	}
	return selectedFile, nil
}

// GetInitialProfileID returns the profile ID passed via CLI flag when starting this window, if any.
func (a *App) GetInitialProfileID() string {
	id := a.initialProfileID
	a.initialProfileID = "" // Clear once consumed to prevent repeated connections
	return id
}

// OpenNewWindow spawns a new native instance of Termlet, optionally auto-connecting to profileID.
func (a *App) OpenNewWindow(profileID string) error {
	var cmd *exec.Cmd

	// If running inside a Snap environment, use snap run to invoke properly with runtime wrappers
	if snapName := os.Getenv("SNAP_NAME"); snapName != "" {
		args := []string{"run", snapName}
		if profileID != "" {
			args = append(args, "--profile", profileID)
		}
		cmd = exec.Command("snap", args...)
	} else {
		execPath, err := os.Executable()
		if err != nil {
			return fmt.Errorf("failed to determine executable path: %w", err)
		}
		if realPath, err := filepath.EvalSymlinks(execPath); err == nil {
			execPath = realPath
		}
		var args []string
		if profileID != "" {
			args = append(args, "--profile", profileID)
		}
		cmd = exec.Command(execPath, args...)
	}

	return cmd.Start()
}

// UploadFileContent writes base64-encoded file data into a remote directory.
func (a *App) UploadFileContent(sessionID string, remoteDir string, fileName string, base64Content string) error {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return err
	}

	data, err := base64.StdEncoding.DecodeString(base64Content)
	if err != nil {
		return fmt.Errorf("failed to decode base64 file data: %w", err)
	}

	destPath := path.Join(remoteDir, fileName)
	totalSize := int64(len(data))

	var item *transfer.Item
	var transferCtx context.Context = context.Background()
	var transferCancel context.CancelFunc

	if a.transferMgr != nil {
		item, transferCtx, transferCancel = a.transferMgr.StartTransfer(sessionID, fileName, transfer.TypeUpload, fileName, destPath, totalSize)
	}

	var r io.Reader = bytes.NewReader(data)
	if a.transferMgr != nil && item != nil {
		r = a.transferMgr.WrapReader(r, item.ID, transferCtx)
	}

	uploadErr := sftpCl.UploadStream(destPath, r)

	if a.transferMgr != nil && item != nil {
		if uploadErr != nil {
			if errors.Is(uploadErr, context.Canceled) {
				a.transferMgr.SetCancelled(item.ID)
			} else {
				a.transferMgr.SetFailed(item.ID, uploadErr)
			}
		} else {
			a.transferMgr.SetCompleted(item.ID, totalSize)
		}
		if transferCancel != nil {
			transferCancel()
		}
	}

	return uploadErr
}

// ListTransfers returns all tracked file transfers.
func (a *App) ListTransfers() []transfer.Item {
	if a.transferMgr == nil {
		return []transfer.Item{}
	}
	return a.transferMgr.ListTransfers()
}

// CancelTransfer cancels an ongoing file transfer.
func (a *App) CancelTransfer(transferID string) error {
	if a.transferMgr == nil {
		return fmt.Errorf("transfer manager not initialized")
	}
	return a.transferMgr.CancelTransfer(transferID)
}

// ClearFinishedTransfers clears completed, failed, and cancelled transfers from history.
func (a *App) ClearFinishedTransfers() {
	if a.transferMgr != nil {
		a.transferMgr.ClearFinished()
	}
}

// OpenLocalFile opens the parent directory or highlights the file in the OS file explorer.
func (a *App) OpenLocalFile(localPath string) error {
	if localPath == "" {
		return fmt.Errorf("empty file path")
	}
	dir := filepath.Dir(localPath)
	switch runtime.GOOS {
	case "windows":
		return exec.Command("explorer.exe", "/select,", localPath).Start()
	case "darwin":
		return exec.Command("open", "-R", localPath).Start()
	default:
		return exec.Command("xdg-open", dir).Start()
	}
}

// GetAppVersion returns the current version string.
func (a *App) GetAppVersion() string {
	return version.Version
}

// CheckForUpdates checks GitHub releases for a newer version.
func (a *App) CheckForUpdates() (*updater.UpdateInfo, error) {
	if a.updater == nil {
		return &updater.UpdateInfo{
			Available:      false,
			CurrentVersion: version.Version,
		}, nil
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.updater.CheckForUpdate(ctx)
}

// CheckForAppUpdate is an alias for CheckForUpdates for dockit-style frontend parity.
func (a *App) CheckForAppUpdate() (*updater.UpdateInfo, error) {
	return a.CheckForUpdates()
}

// DownloadAndApplyUpdate starts downloading the update archive/installer, extracts it, and applies it in-place.
func (a *App) DownloadAndApplyUpdate(downloadURL, assetFileName string) error {
	if a.updater == nil {
		return fmt.Errorf("updater service is not initialized")
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.updater.DownloadAndInstallUpdate(ctx, downloadURL, assetFileName)
}

// GetUpdateProgress returns the current percentage and state of the update download.
func (a *App) GetUpdateProgress() updater.DownloadProgress {
	if a.updater == nil {
		return updater.DownloadProgress{Status: "idle"}
	}
	return a.updater.GetCurrentProgress()
}

// RestartApp restarts the desktop application with the newly updated binary.
func (a *App) RestartApp() error {
	if a.updater == nil {
		return fmt.Errorf("updater service is not initialized")
	}
	return a.updater.RestartApp()
}

// GetReleaseNotes returns the embedded markdown release notes for the active version.
func (a *App) GetReleaseNotes() string {
	return embeddedReleaseNotes
}

// --- SSH Port Forwarding (Tunneling) ---

// saveTunnelToProfile adds or updates a port forward config inside the session's profile.
func (a *App) saveTunnelToProfile(profileID string, info tunnel.TunnelInfo) {
	if profileID == "" || a.profileStore == nil {
		return
	}
	p, err := a.profileStore.Get(profileID)
	if err != nil || p == nil {
		return
	}

	found := false
	for i, pf := range p.PortForwards {
		if pf.ID == info.ID || (pf.LocalPort == info.LocalPort && pf.RemotePort == info.RemotePort && pf.RemoteHost == info.RemoteHost) {
			p.PortForwards[i].ID = info.ID
			p.PortForwards[i].LocalPort = info.LocalPort
			p.PortForwards[i].RemoteHost = info.RemoteHost
			p.PortForwards[i].RemotePort = info.RemotePort
			p.PortForwards[i].Name = info.Name
			found = true
			break
		}
	}

	if !found {
		p.PortForwards = append(p.PortForwards, models.ForwardedPortConfig{
			ID:         info.ID,
			LocalPort:  info.LocalPort,
			RemoteHost: info.RemoteHost,
			RemotePort: info.RemotePort,
			Name:       info.Name,
		})
	}

	_ = a.profileStore.Save(*p)
}

// removeTunnelFromProfile removes a port forward config from the session's profile.
func (a *App) removeTunnelFromProfile(profileID string, tunnelID string, localPort int, remoteHost string, remotePort int) {
	if profileID == "" || a.profileStore == nil {
		return
	}
	p, err := a.profileStore.Get(profileID)
	if err != nil || p == nil {
		return
	}

	var filtered []models.ForwardedPortConfig
	for _, pf := range p.PortForwards {
		if pf.ID == tunnelID || (localPort > 0 && pf.LocalPort == localPort && pf.RemotePort == remotePort && pf.RemoteHost == remoteHost) {
			continue
		}
		filtered = append(filtered, pf)
	}

	p.PortForwards = filtered
	_ = a.profileStore.Save(*p)
}

// StartPortForward establishes a local port listener on 127.0.0.1:localPort and proxies to remoteHost:remotePort via SSH.
func (a *App) StartPortForward(sessionID string, localPort int, remoteHost string, remotePort int, name string) (*tunnel.TunnelInfo, error) {
	if a.connMgr == nil {
		return nil, fmt.Errorf("connection manager not initialized")
	}
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return nil, fmt.Errorf("active session required for port forwarding: %w", err)
	}
	if sess.SSH == nil {
		return nil, fmt.Errorf("SSH connection is not active")
	}

	info, err := a.tunnelMgr.StartForwarding(sessionID, sess.SSH, localPort, remoteHost, remotePort, name)
	if err != nil {
		return nil, err
	}

	a.saveTunnelToProfile(sess.Profile.ID, *info)
	return info, nil
}

// SavePortForwardConfig stores a port forward config in stopped state for a session's profile without starting it.
func (a *App) SavePortForwardConfig(sessionID string, localPort int, remoteHost string, remotePort int, name string) (*tunnel.TunnelInfo, error) {
	if a.connMgr == nil {
		return nil, fmt.Errorf("connection manager not initialized")
	}
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return nil, fmt.Errorf("active session required: %w", err)
	}
	if a.tunnelMgr == nil {
		return nil, fmt.Errorf("tunnel manager not initialized")
	}

	info := a.tunnelMgr.AddConfiguredTunnel("", sessionID, localPort, remoteHost, remotePort, name)
	a.saveTunnelToProfile(sess.Profile.ID, *info)
	return info, nil
}

// StopPortForward stops an active tunnel and releases the local port.
func (a *App) StopPortForward(tunnelID string) error {
	if a.tunnelMgr == nil {
		return fmt.Errorf("tunnel manager not initialized")
	}
	return a.tunnelMgr.StopForwarding(tunnelID)
}

// RestartPortForward resumes a stopped tunnel using an active session's SSH connection.
func (a *App) RestartPortForward(sessionID string, tunnelID string) (*tunnel.TunnelInfo, error) {
	if a.connMgr == nil {
		return nil, fmt.Errorf("connection manager not initialized")
	}
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return nil, fmt.Errorf("active session required to resume port forwarding: %w", err)
	}
	if sess.SSH == nil {
		return nil, fmt.Errorf("SSH connection is not active")
	}

	info, err := a.tunnelMgr.RestartForwarding(tunnelID, sess.SSH)
	if err != nil {
		return nil, err
	}

	a.saveTunnelToProfile(sess.Profile.ID, *info)
	return info, nil
}

// DeletePortForward stops and removes a port forwarding configuration.
func (a *App) DeletePortForward(tunnelID string) error {
	if a.tunnelMgr == nil {
		return nil
	}

	if info, found := a.tunnelMgr.GetTunnel(tunnelID); found && a.connMgr != nil {
		if sess, err := a.connMgr.GetSession(info.SessionID); err == nil && sess != nil {
			a.removeTunnelFromProfile(sess.Profile.ID, tunnelID, info.LocalPort, info.RemoteHost, info.RemotePort)
		}
	}

	return a.tunnelMgr.DeleteForwarding(tunnelID)
}

// ListPortForwards retrieves all port forwards for a session (or all if sessionID is empty).
func (a *App) ListPortForwards(sessionID string) ([]*tunnel.TunnelInfo, error) {
	if a.tunnelMgr == nil {
		return []*tunnel.TunnelInfo{}, nil
	}
	return a.tunnelMgr.ListTunnels(sessionID), nil
}

// CheckPortHealth checks the health of an individual local port forward.
func (a *App) CheckPortHealth(tunnelID string) (*tunnel.PortHealthStatus, error) {
	if a.tunnelMgr == nil {
		return &tunnel.PortHealthStatus{
			TunnelID: tunnelID,
			Status:   "stopped",
			Protocol: "none",
			Error:    "tunnel manager not initialized",
		}, nil
	}
	res := a.tunnelMgr.CheckHealth(tunnelID)
	return &res, nil
}

// CheckAllPortsHealth checks the health of multiple local port forwards concurrently.
func (a *App) CheckAllPortsHealth(tunnelIDs []string) ([]tunnel.PortHealthStatus, error) {
	if a.tunnelMgr == nil {
		return []tunnel.PortHealthStatus{}, nil
	}
	return a.tunnelMgr.CheckAllHealth(tunnelIDs), nil
}

// GetKnownHosts retrieves all stored known host entries from Termlet and system known_hosts.
func (a *App) GetKnownHosts() ([]models.KnownHostEntry, error) {
	if a.connMgr == nil {
		return []models.KnownHostEntry{}, nil
	}
	hkm := a.connMgr.GetHostKeyManager()
	if hkm == nil {
		return []models.KnownHostEntry{}, nil
	}
	return hkm.ListKnownHosts()
}

// RemoveKnownHost removes all known host entries matching target from the specified source.
func (a *App) RemoveKnownHost(source string, host string) error {
	if a.connMgr == nil {
		return fmt.Errorf("connection manager not initialized")
	}
	hkm := a.connMgr.GetHostKeyManager()
	if hkm == nil {
		return fmt.Errorf("host key manager not initialized")
	}
	return hkm.RemoveKnownHost(source, host)
}

// RemoveKnownHostByLine removes a known host entry at a specific line number.
func (a *App) RemoveKnownHostByLine(source string, lineNum int) error {
	if a.connMgr == nil {
		return fmt.Errorf("connection manager not initialized")
	}
	hkm := a.connMgr.GetHostKeyManager()
	if hkm == nil {
		return fmt.Errorf("host key manager not initialized")
	}
	return hkm.RemoveKnownHostByLine(source, lineNum)
}

// ClearKnownHosts resets known host entries for the specified source.
func (a *App) ClearKnownHosts(source string) error {
	if a.connMgr == nil {
		return fmt.Errorf("connection manager not initialized")
	}
	hkm := a.connMgr.GetHostKeyManager()
	if hkm == nil {
		return fmt.Errorf("host key manager not initialized")
	}
	return hkm.ClearKnownHosts(source)
}

// GenerateSSHKey creates a new SSH key pair according to the request parameters.
func (a *App) GenerateSSHKey(req models.GenerateSSHKeyRequest) (*models.GeneratedSSHKey, error) {
	return sshkeys.GenerateSSHKey(req)
}

// ListLocalSSHKeys inspects the user's ~/.ssh directory and returns info on all discovered SSH keys.
func (a *App) ListLocalSSHKeys() ([]models.SSHKeyInfo, error) {
	return sshkeys.ListLocalKeys("")
}

// DeleteLocalSSHKey removes both the private key and public key (.pub) files for the given path.
func (a *App) DeleteLocalSSHKey(keyPath string) error {
	return sshkeys.DeleteLocalKey(keyPath)
}

// InstallSSHKeyToRemote installs a public key onto the remote server's ~/.ssh/authorized_keys file.
func (a *App) InstallSSHKeyToRemote(sessionID string, publicKey string) error {
	sftpCl, err := a.getSFTPClient(sessionID)
	if err != nil {
		return fmt.Errorf("failed to get remote connection: %w", err)
	}
	return sshkeys.InstallPublicKeyToRemote(sftpCl.SFTP(), publicKey)
}

// ExecRemoteCommand runs a shell command on the remote server for the active session and terminal tab.
func (a *App) ExecRemoteCommand(sessionID string, terminalID string, command string) (*models.RemoteExecResult, error) {
	if a.connMgr == nil {
		return nil, fmt.Errorf("connection manager not initialized")
	}
	ctx := a.ctx
	if ctx == nil {
		ctx = context.Background()
	}
	return a.connMgr.ExecCommand(ctx, sessionID, terminalID, command)
}

// CancelRemoteCommand terminates the running command on the remote session and terminal tab.
func (a *App) CancelRemoteCommand(sessionID string, terminalID string) error {
	if a.connMgr == nil {
		return fmt.Errorf("connection manager not initialized")
	}
	return a.connMgr.CancelCommand(sessionID, terminalID)
}

// GetRemoteCwd returns the tracked remote working directory for the session and terminal tab.
func (a *App) GetRemoteCwd(sessionID string, terminalID string) (string, error) {
	if a.connMgr == nil {
		return "", fmt.Errorf("connection manager not initialized")
	}
	return a.connMgr.GetRemoteCwd(sessionID, terminalID)
}

// SetRemoteCwd explicitly sets the remote working directory for the session and terminal tab.
func (a *App) SetRemoteCwd(sessionID string, terminalID string, cwd string) error {
	if a.connMgr == nil {
		return fmt.Errorf("connection manager not initialized")
	}
	return a.connMgr.SetRemoteCwd(sessionID, terminalID, cwd)
}

// CloseTerminal cleans up an individual terminal instance on the session.
func (a *App) CloseTerminal(sessionID string, terminalID string) error {
	if a.connMgr == nil {
		return fmt.Errorf("connection manager not initialized")
	}
	return a.connMgr.CloseTerminal(sessionID, terminalID)
}
