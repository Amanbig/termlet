package updater

import (
	"testing"
)

func TestIsNewerVersion(t *testing.T) {
	tests := []struct {
		remote string
		local  string
		want   bool
	}{
		{"v0.5.1", "v0.5.0", true},
		{"v0.6.0", "v0.5.1", true},
		{"v1.0.0", "v0.9.9", true},
		{"v0.5.0", "v0.5.0", false},
		{"v0.4.9", "v0.5.0", false},
		{"0.5.1", "0.5.0", true},
		{"v0.5.0-beta.1", "v0.5.0", false},
		{"v0.5.1-rc1", "v0.5.0", true},
	}

	for _, tc := range tests {
		got := IsNewerVersion(tc.remote, tc.local)
		if got != tc.want {
			t.Errorf("IsNewerVersion(%q, %q) = %v; want %v", tc.remote, tc.local, got, tc.want)
		}
	}
}

func TestMatchAsset(t *testing.T) {
	assets := []githubAsset{
		{Name: "termlet-linux-amd64.tar.gz", BrowserDownloadURL: "https://example.com/tar"},
		{Name: "termlet-linux-amd64.deb", BrowserDownloadURL: "https://example.com/deb"},
		{Name: "termlet-linux-amd64.rpm", BrowserDownloadURL: "https://example.com/rpm"},
		{Name: "termlet-windows-amd64.zip", BrowserDownloadURL: "https://example.com/win"},
		{Name: "termlet-windows-amd64-installer.exe", BrowserDownloadURL: "https://example.com/win-inst"},
		{Name: "termlet-darwin-universal.zip", BrowserDownloadURL: "https://example.com/mac"},
	}

	// Linux deb
	name, url, _ := matchAsset(assets, "linux", "amd64", "deb")
	if name != "termlet-linux-amd64.deb" || url != "https://example.com/deb" {
		t.Fatalf("unexpected asset for linux deb: %s, %s", name, url)
	}

	// Linux rpm
	name, url, _ = matchAsset(assets, "linux", "amd64", "rpm")
	if name != "termlet-linux-amd64.rpm" || url != "https://example.com/rpm" {
		t.Fatalf("unexpected asset for linux rpm: %s, %s", name, url)
	}

	// Linux standalone
	name, url, _ = matchAsset(assets, "linux", "amd64", "standalone")
	if name != "termlet-linux-amd64.tar.gz" || url != "https://example.com/tar" {
		t.Fatalf("unexpected asset for linux standalone: %s, %s", name, url)
	}

	// Windows nsis
	name, url, _ = matchAsset(assets, "windows", "amd64", "nsis")
	if name != "termlet-windows-amd64-installer.exe" || url != "https://example.com/win-inst" {
		t.Fatalf("unexpected asset for windows nsis: %s, %s", name, url)
	}

	// Windows portable
	name, url, _ = matchAsset(assets, "windows", "amd64", "portable")
	if name != "termlet-windows-amd64.zip" || url != "https://example.com/win" {
		t.Fatalf("unexpected asset for windows: %s, %s", name, url)
	}

	// macOS
	name, url, _ = matchAsset(assets, "darwin", "arm64", "dmg")
	if name != "termlet-darwin-universal.zip" || url != "https://example.com/mac" {
		t.Fatalf("unexpected asset for mac: %s, %s", name, url)
	}
}

func TestDetectInstallationType(t *testing.T) {
	instType := DetectInstallationType()
	t.Logf("Detected install type: %s", instType)
	if instType == "" {
		t.Fatal("expected non-empty install type")
	}
}
