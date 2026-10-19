package main

import (
	"context"
	_ "embed"
	"encoding/base64"
	"fmt"
	"path"
	"strings"
	"termlet/internal/connections"
	"termlet/internal/models"
	"termlet/internal/sftpclient"
	"termlet/internal/storage"
	"termlet/internal/tunnel"
	"termlet/internal/updater"
	"termlet/internal/version"
)

//go:embed RELEASE_NOTES.md
var embeddedReleaseNotes string

// App is the main application bridge between Wails frontend and Go backend.
type App struct {
	ctx          context.Context
	connMgr      *connections.Manager
	profileStore *storage.ProfileStorage
	secretStore  *storage.SecretStorage
	updater      *updater.Updater
	tunnelMgr    *tunnel.Manager
}

// ConnectResponse wraps the outcome of a Connect request.
type ConnectResponse struct {
	Success       bool                       `json:"success"`
	Session       *connections.SessionSummary `json:"session,omitempty"`
	HostKeyPrompt *models.HostKeyPrompt      `json:"host_key_prompt,omitempty"`
	Error         string                     `json:"error,omitempty"`
}

// NewApp creates a new App application struct.
func NewApp() *App {
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

	return &App{
		profileStore: profileStore,
		secretStore:  secretStore,
		connMgr:      connMgr,
		updater:      upd,
		tunnelMgr:    tunnelMgr,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
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

// --- Connection Management ---

// Connect starts an SSH & SFTP session using the provided profile.
func (a *App) Connect(profile models.Profile, password string, trustKey bool) (*ConnectResponse, error) {
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
	reader := strings.NewReader(string(data))
	return sftpCl.UploadStream(destPath, reader)
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
