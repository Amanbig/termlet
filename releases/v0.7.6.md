# Termlet v0.7.6 🚀

Termlet **v0.7.6** is a major stability and feature update delivering an **SFTP Transfer Queue & Live Progress Drawer**, **SSH Keep-Alive & Auto-Reconnect Engine**, **Instant 0ms Workspace Search Caching**, and **Reliable Teardown & Context Menu fixes**.

---

### ✨ What's New & Highlights

#### 📊 SFTP Transfer Queue & Live Progress Drawer
- **Real-Time Transfer Metrics**:
  - Sliding bottom drawer tracking all active, completed, and cancelled downloads & uploads.
  - Live progress bars, transfer speeds (KB/s, MB/s), elapsed time, and ETA calculations.
  - Real-time active transfers count badge pinned to the bottom status bar with 1-click toggle.
- **In-Flight Cancellation**:
  - Cancel any ongoing download or upload immediately with context cancellation, instantly freeing network I/O and cleaning up partial local files.
- **Native OS Reveal**:
  - "Show in Folder" action on completed downloads reveals the file directly in your native OS file manager (Windows Explorer, macOS Finder, Linux xdg-open).
- **Tab Filtering & History Management**:
  - Filter transfers across *All*, *Active*, and *Completed* tabs with 1-click history cleanup.

#### 💓 Proactive SSH Keep-Alive & Auto-Reconnect Engine
- **OpenSSH Heartbeat Probes**:
  - Periodic `keepalive@openssh.com` global requests (default every 20s, configurable) with a 5s probe timeout to prevent idle connection drops behind NAT/firewalls.
- **Accurate Drop Detection**:
  - Distinguishes intentional user disconnects (`Session.Close`) from unexpected network drops (`Session.MarkDropped`).
- **Contextual Reconnection Banner**:
  - Top floating banner with live countdown (*"Reconnecting in 3s... Attempt 1/5"*), exponential backoff, and 1-click *"Reconnect Now"* action.
- **Seamless Session Revival**:
  - In-memory cached session credentials allow reconnection without re-prompting for credentials.
  - Automatically restores active port forward tunnels upon reconnect without altering the session ID, preserving open editor tabs.
- **Configurable Settings**:
  - New *Advanced Options* in Connection Profile dialog to customize keep-alive interval (seconds) and toggle auto-reconnect.

#### ⚡ Instant 0ms Workspace Search & Quick Open Caching (<kbd>Ctrl+P</kbd> / <kbd>Cmd+P</kbd>)
- **In-Memory File Cache & Deduplication**:
  - Workspace files are cached in memory per session. Opening Quick Open is now **instantaneous (0ms latency)** without triggering repeated SSH requests.
  - Concurrent search requests are deduplicated so rapid opens share the same promise rather than flooding the remote server.
- **60fps Client-Side Fuzzy Search**:
  - Keystrokes no longer dispatch heavy remote find commands; filtering runs locally at 60fps with multi-word scoring, exact matching, and recency ranking.
- **Manual Refresh Trigger**:
  - Added a 1-click *"Refresh workspace index"* button (<kbd>RefreshCw</kbd>) for updating the file cache when server files change.

#### 🛡️ Robust Connection Teardown & Non-Blocking SFTP I/O
- **Never-Hanging Disconnect**:
  - `Disconnect()` now terminates cleanly with a safety timeout, ensuring the app never freezes or becomes stuck when dropping an unresponsive or broken connection.
- **Fine-Grained SFTP Concurrency**:
  - Released client mutexes during streaming downloads, uploads, and directory walks, preventing SFTP operations from blocking UI requests.
- **Explorer Disconnect Action**:
  - Added a dedicated *"Disconnect"* button directly on the Explorer error card when sessions drop, ensuring you are never trapped.

#### 🖱️ File Tree Context Menu Three-Dots Fix
- **Three-Dots Dropdown Trigger**:
  - Fixed an issue where left-clicking the three-dots button (`•••`) on file and directory items dismissed the dropdown menu immediately.
  - Isolated pointer and click event propagation from parent row actions.

#### ⚡ Core Engine Upgrades
- **Vite 8 Upgrade**:
  - Upgraded frontend build pipeline to Vite 8.3.4, yielding ~4x faster compilation times (~1.2s).

---

### 📦 Artifacts Included
- **Linux**:
  - `termlet-linux-amd64.deb` (Debian, Ubuntu, Linux Mint, Pop!_OS)
  - `termlet-linux-amd64.rpm` (Fedora, RHEL, CentOS, openSUSE)
  - `termlet-linux-amd64.tar.gz` (Portable Linux archive)
- **Windows**:
  - `termlet-windows-amd64.zip` (Portable 64-bit Windows archive)
- **macOS**:
  - `termlet-darwin-universal.dmg` (Intel & Apple Silicon)
