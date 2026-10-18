package updater

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strings"
	"termlet/internal/version"
	"time"
)

const (
	githubOwner = "Amanbig"
	githubRepo  = "termlet"
)

// UpdateInfo holds details about the latest available release.
type UpdateInfo struct {
	Available      bool   `json:"available"`
	CurrentVersion string `json:"current_version"`
	LatestVersion  string `json:"latest_version"`
	ReleaseName    string `json:"release_name"`
	ReleaseNotes   string `json:"release_notes"`
	PublishedAt    string `json:"published_at"`
	ReleaseURL     string `json:"release_url"`
	DownloadURL    string `json:"download_url"`
}

// GitHubRelease represents the minimal response from GitHub API.
type gitHubRelease struct {
	TagName     string `json:"tag_name"`
	Name        string `json:"name"`
	Body        string `json:"body"`
	PublishedAt string `json:"published_at"`
	HTMLURL     string `json:"html_url"`
	Assets      []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

// Updater handles checking for application updates.
type Updater struct {
	client *http.Client
}

// NewUpdater creates a new Updater instance.
func NewUpdater() *Updater {
	return &Updater{
		client: &http.Client{Timeout: 10 * time.Second},
	}
}

// CheckForUpdate queries GitHub for the latest release and compares with current version.
func (u *Updater) CheckForUpdate(ctx context.Context) (*UpdateInfo, error) {
	currentVer := version.Version
	if currentVer == "" {
		currentVer = "0.1.0"
	}

	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", githubOwner, githubRepo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create update request: %w", err)
	}

	req.Header.Set("User-Agent", "Termlet-Desktop-App")
	req.Header.Set("Accept", "application/vnd.github.v3+json")

	resp, err := u.client.Do(req)
	if err != nil {
		// Return no update available if offline
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: currentVer,
			LatestVersion:  currentVer,
		}, nil
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return &UpdateInfo{
			Available:      false,
			CurrentVersion: currentVer,
			LatestVersion:  currentVer,
		}, nil
	}

	var ghRelease gitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&ghRelease); err != nil {
		return nil, fmt.Errorf("failed to decode release info: %w", err)
	}

	latestVer := strings.TrimPrefix(ghRelease.TagName, "v")
	currentClean := strings.TrimPrefix(currentVer, "v")

	isNewer := compareVersions(latestVer, currentClean) > 0

	var downloadURL string
	for _, asset := range ghRelease.Assets {
		if strings.Contains(asset.Name, "linux") || strings.HasSuffix(asset.Name, ".tar.gz") || strings.HasSuffix(asset.Name, ".deb") {
			downloadURL = asset.BrowserDownloadURL
			break
		}
	}
	if downloadURL == "" && len(ghRelease.Assets) > 0 {
		downloadURL = ghRelease.Assets[0].BrowserDownloadURL
	}
	if downloadURL == "" {
		downloadURL = ghRelease.HTMLURL
	}

	return &UpdateInfo{
		Available:      isNewer,
		CurrentVersion: currentVer,
		LatestVersion:  latestVer,
		ReleaseName:    ghRelease.Name,
		ReleaseNotes:   ghRelease.Body,
		PublishedAt:    ghRelease.PublishedAt,
		ReleaseURL:     ghRelease.HTMLURL,
		DownloadURL:    downloadURL,
	}, nil
}

// compareVersions compares two semver strings like "1.2.0" and "1.1.0".
func compareVersions(v1, v2 string) int {
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	maxLen := len(parts1)
	if len(parts2) > maxLen {
		maxLen = len(parts2)
	}

	for i := 0; i < maxLen; i++ {
		var n1, n2 int
		if i < len(parts1) {
			_, _ = fmt.Sscanf(parts1[i], "%d", &n1)
		}
		if i < len(parts2) {
			_, _ = fmt.Sscanf(parts2[i], "%d", &n2)
		}
		if n1 > n2 {
			return 1
		}
		if n1 < n2 {
			return -1
		}
	}
	return 0
}
