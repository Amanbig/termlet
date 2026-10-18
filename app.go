package main

import (
	"context"
	"encoding/base64"
	"fmt"
	"path"
	"strings"
	"termlet/internal/connections"
	"termlet/internal/models"
	"termlet/internal/sftpclient"
	"termlet/internal/storage"
	"termlet/internal/updater"
	"termlet/internal/version"
)

// App is the main application bridge between Wails frontend and Go backend.
type App struct {
	ctx          context.Context
	connMgr      *connections.Manager
	profileStore *storage.ProfileStorage
	secretStore  *storage.SecretStorage
	updater      *updater.Updater
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

	return &App{
		profileStore: profileStore,
		secretStore:  secretStore,
		connMgr:      connMgr,
		updater:      upd,
	}
}

// startup is called when the app starts. The context is saved
// so we can call the runtime methods.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown is called during application termination.
func (a *App) shutdown(ctx context.Context) {
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
	return &ConnectResponse{
		Success: true,
		Session: &summary,
	}, nil
}

// Disconnect terminates an active session.
func (a *App) Disconnect(sessionID string) error {
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

// ListRemoteFiles lists entries in the specified remote directory.
func (a *App) ListRemoteFiles(sessionID string, remotePath string) ([]models.RemoteFile, error) {
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	sftpCl, err := sess.GetSFTP()
	if err != nil {
		return nil, err
	}

	return sftpCl.ListDirectory(remotePath)
}

// ReadRemoteFile retrieves the contents and metadata of a file.
func (a *App) ReadRemoteFile(sessionID string, filePath string) (*models.FileContent, error) {
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	sftpCl, err := sess.GetSFTP()
	if err != nil {
		return nil, err
	}

	return sftpCl.ReadFile(filePath, 0)
}

// SaveRemoteFile safely saves edited content to the remote server.
func (a *App) SaveRemoteFile(sessionID string, filePath string, content string, checkModTime int64) (*sftpclient.SaveResult, error) {
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return nil, err
	}

	sftpCl, err := sess.GetSFTP()
	if err != nil {
		return nil, err
	}

	return sftpCl.SaveFile(filePath, content, checkModTime)
}

// CreateRemoteFile creates a new empty file on the remote server.
func (a *App) CreateRemoteFile(sessionID string, filePath string) error {
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return err
	}

	sftpCl, err := sess.GetSFTP()
	if err != nil {
		return err
	}

	return sftpCl.CreateFile(filePath)
}

// CreateRemoteDirectory creates a new directory on the remote server.
func (a *App) CreateRemoteDirectory(sessionID string, dirPath string) error {
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return err
	}

	sftpCl, err := sess.GetSFTP()
	if err != nil {
		return err
	}

	return sftpCl.CreateDirectory(dirPath)
}

// DeleteRemotePath deletes a remote file or folder.
func (a *App) DeleteRemotePath(sessionID string, targetPath string, isDir bool) error {
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return err
	}

	sftpCl, err := sess.GetSFTP()
	if err != nil {
		return err
	}

	return sftpCl.DeletePath(targetPath, isDir)
}

// RenameRemotePath renames or moves a remote file or folder.
func (a *App) RenameRemotePath(sessionID string, oldPath string, newPath string) error {
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return err
	}

	sftpCl, err := sess.GetSFTP()
	if err != nil {
		return err
	}

	return sftpCl.Rename(oldPath, newPath)
}

// UploadFileContent writes base64-encoded file data into a remote directory.
func (a *App) UploadFileContent(sessionID string, remoteDir string, fileName string, base64Content string) error {
	sess, err := a.connMgr.GetSession(sessionID)
	if err != nil {
		return err
	}

	sftpCl, err := sess.GetSFTP()
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
