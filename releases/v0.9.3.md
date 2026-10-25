# Termlet v0.9.3 🚀

Termlet **v0.9.3** introduces **Multi-Window Connection Support** for handling multiple server environments simultaneously, a native **File Explorer Picker** for SSH private keys, **Snapcraft core24 & GPU modernization**, and robust connection concurrency guards and error feedback.

---

### ✨ What's New & Highlights

#### 🪟 Multi-Window Connection Architecture
- **Independent Window Spawning**:
  - Open multiple native Termlet windows to manage different servers simultaneously with fully independent sessions, file trees, and terminal states.
  - Deep-link or launch connections directly from the CLI via `termlet --profile <profile-id>`.
  - Global shortcut <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> / <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>N</kbd> and quick-action icon in the TitleBar to spawn a new window at any time.
  - Dedicated **"Open in New Window"** option in profile context menus.
- **Smart Multi-Connection Window Routing**:
  - Added new setting: *"Open connections in new window when already connected"* in **Settings → General**.
  - When enabled, connecting to another server while an existing connection is active automatically launches the new connection in its own dedicated window.
- **Connection Concurrency & Idempotency Safeguards**:
  - Backend idempotency guards prevent duplicate SSH and SFTP connections for the same profile.
  - Initial profile ID passed via CLI flag is atomically consumed on startup to eliminate re-trigger loops.
  - Frontend in-flight ref locks guarantee rapid clicks never spawn duplicate concurrent sessions.

#### 🔑 Native Private Key File Picker
- **Instant Key File Selection**:
  - Integrated an inline native file dialog picker button (**"Pick / Generate Key..."**) right next to the Private Key Path input in the connection dialog.
  - Opens the OS-native file manager (Nautilus, Dolphin, Explorer, Finder) filtered for common SSH private key formats (`.pem`, `.ppk`, OpenSSH keys, `id_rsa`, `id_ed25519`, `id_ecdsa`).
  - Seamlessly updates the connection profile path without manual file path typing.

#### 🛡️ Enhanced Error Handling & Feedback
- **Intelligent Error Categorization**:
  - Distinguishes missing credentials from network and connection failures.
  - Host unreachable, connection timeout, and handshake failures immediately trigger clear, informative toast error alerts (`Connection failed: <details>`) before presenting the setup dialog.
  - Failed initial profile lookups provide actionable notifications.
  - Multi-window spawn errors at the OS level are caught and reported directly in the UI.

#### 📦 Snapcraft Packaging & Linux Compatibility
- **Ubuntu 24.04 (Noble) & core24 Foundation**:
  - Migrated Snap package to `base: core24` with `gnome-46-2404` extension and `gpu-2404` Mesa interface.
  - Resolves `DRI_Mesa` graphics driver initialization and WebKitGTK 4.1 hardware acceleration crashes on modern Linux distributions.
- **Snap Environment Detection**:
  - Self-updater automatically detects when Termlet is running under Snap confinement and cleanly defers updates to Snapcraft (`snap refresh termlet`) to prevent conflicts with read-only SquashFS mounts.

---

### 📦 Artifacts Included
- **Linux**:
  - `termlet-linux-amd64.deb` (Debian, Ubuntu, Linux Mint, Pop!_OS)
  - `termlet-linux-amd64.rpm` (Fedora, RHEL, CentOS, openSUSE)
  - `termlet-linux-amd64.tar.gz` (Portable Linux archive)
  - Canonical Snap Store: `snap install termlet`
- **Windows**:
  - `termlet-windows-amd64.zip` (Portable 64-bit Windows archive)
- **macOS**:
  - `termlet-darwin-universal.dmg` (Intel & Apple Silicon)
