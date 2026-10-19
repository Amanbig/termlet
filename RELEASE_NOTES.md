# Termlet v0.5.2 🚀

Termlet **v0.5.2** brings comprehensive, production-grade error handling across the entire stack, eliminating white-screen crashes, introducing actionable diagnostic hints, and bolstering backend fault tolerance alongside our automatic updater and UI refinements.

---

### ✨ What's New & Highlights

#### 🛡️ Robust Error Handling & Crash Protection
- **React Sectional `<ErrorBoundary>`**:
  - Integrated error boundaries around all major workspace zones (Side panels, Explorer, Editor, Settings, and Release Notes).
  - Component crashes or syntax errors in editors no longer cause white-screen failures.
  - Includes user-facing recovery controls: **Reload View**, collapsible **Technical Details** stack viewer, and **Full Restart**.
- **Centralized Error Parsing & Actionable Hints (`formatErrorMessage`)**:
  - Automatically translates cryptic Go, SSH, SFTP, and OS errors into structured `{ title, message, hint, raw }` objects across 13 categories:
    - **Authentication Failures**: Clear advice on username, password, or key passphrases.
    - **Connection Refused**: Guides users to check `sshd` status, listening ports, and firewall rules.
    - **DNS / Host Resolution**: Pinpoints DNS lookups and typos.
    - **Connection Timeouts & Network Unreachability**: Actionable hints on server reachability and VPN routing.
    - **Host Key Verification & Security Warnings**: Explicit guidance on untrusted or changed host keys.
    - **SFTP Permissions & Missing Files**: Clear Linux file permission (`chmod`/`chown`) hints.
    - **Concurrent File Modification**: Interactive conflict warnings with "Overwrite anyway" options.
    - **Buffer Limits**: Guards on files exceeding editor size limits.
    - **Disconnected Sessions**: Contextual prompts to reconnect.
- **Inline Connection Error Banners**:
  - Replaced fleeting toasts in `ConnectDialog` with persistent inline error alerts above action buttons, complete with troubleshooting hints and a toggleable raw technical details view.
- **Remote Explorer Failure Recovery**:
  - Replaced misleading "Directory is empty" states during SFTP failures with an explicit error screen and an inline **Retry** action.
- **Go Backend Panic Prevention & Nil Safety**:
  - Added centralized `getSFTPClient` in `app.go` with strict nil checks and session validation.
  - Added receiver and client nil guards across `sftpclient.Client` methods before mutex acquisitions.

---

# Termlet v0.5.1 🚀

Termlet **v0.5.1** brought seamless in-app automatic update installation (matching Dockit's update architecture), native Windows icon integration, webview favicon fidelity, comprehensive light-mode theme contrast enhancements, and UI control cleanup across platforms.

---

### 🔄 Automatic In-App Update Installation & Management (Dockit Parity)
- **One-Click In-App Updating**:
  - Added background update detection shortly after startup that alerts users with a non-intrusive floating toast when a newer version is released.
  - Interactive **`<UpdateModal>`**: displays installed version vs new version badges, target package detection tag, release notes, and real-time download progress (percentage and downloaded MB).
  - **Native Package & In-Place Installation**:
    - **Linux (`.deb`)**: automatically downloads `.deb` package and invokes `pkexec dpkg -i` (with fallback to `apt-get install -f -y` or desktop package manager), prompting for desktop authorization seamlessly.
    - **Linux (`.rpm`)**: automatically downloads `.rpm` package and installs via `pkexec rpm -Uvh --replacepkgs`.
    - **Windows**: launches downloaded NSIS setup installer `.exe` or updates portable `.zip` in-place.
    - **Standalone / Portable**: extracts binary in-memory and applies the replacement in-place using `selfupdate` (or `pkexec` if destination directory requires root permission).
  - **Seamless App Restart**: integrated `RestartApp()` allows 1-click restarting directly into the newly updated version.
  - **VS Code Style Post-Update Release Notes Tab**:
    - Automatically opens a dedicated rendered Release Notes tab upon first launch after an update, showing the changelog and highlights.
    - Tracked via `localStorage` to ensure it is displayed **only once** per version update.
    - Seamlessly integrated as an editor tab (`termlet://release-notes`) alongside file and settings tabs.
    - Can be reopened at any time from the Settings view via the **"Release Notes"** button.
  - **Settings Integration**: direct "Check for Updates" and "Install Update" triggers right inside the Settings view and bottom status bar.

### 🪟 Windows Native Icon & Taskbar Integration
- **Multi-Resolution Windows Executable Icon**:
  - Generated and embedded a true multi-resolution icon (`build/windows/icon.ico`) with standard 16x16, 32x32, 48x48, 64x64, 128x128, and 256x256 RGBA layers.
  - Fixes icon display across Windows Taskbar, Alt-Tab task switcher, File Explorer detail/tile views, and the window title bar.
  - Resolved missing custom icon issue in NSIS installer setup wizard and Start Menu application shortcuts.
- **Master App Icon Standardization**:
  - Re-rendered `build/appicon.png` into a crisp 512x512 RGBA squircle asset with smooth antialiased corners for cross-platform packaging.

### 🌐 Webview & Browser Favicon Assets
- **Webview Favicon Support**:
  - Added `frontend/public/favicon.png` (512x512) and `frontend/public/favicon.ico` (multi-res 16/32/48).
  - Explicitly linked `<link rel="icon" type="image/png" href="/favicon.png" />` in `frontend/index.html` to eliminate blank or default webview icons during runtime.
  - Added clean `<title>Termlet</title>` branding in the webview document head.

### 🎨 Complete Light Mode UI & Contrast Polish
- **Remote File Tree Readability**:
  - Enhanced text color contrast in light mode: unselected tree items now use high-contrast dark text (`text-zinc-800` / `hover:text-zinc-950`) instead of low-contrast muted zinc.
  - Polished active item highlight: replaced low-contrast white highlight with a crisp, subtle blue badge (`bg-blue-100 text-blue-900` in light mode, `bg-blue-900/30 text-blue-200` in dark mode).
  - Ensured toolbar button icons (`Refresh`, `Collapse All`) adopt high-contrast foreground states in both themes.
- **Code Editor Canvas & Status Bar**:
  - Fixed empty editor background: eliminated the jarring dark canvas in light mode when no files are open, seamlessly adopting a clean `bg-zinc-50` backdrop with dark zinc prompt text.
  - Seamless Status Bar: synchronized the bottom status bar background (`bg-zinc-100/90 text-zinc-700`) and border color to match the light theme workspace.
- **SSH Connection Dialog**:
  - Overhauled modal styling: resolved harsh dark panels in light mode by applying appropriate light theme containers (`bg-white/95 text-zinc-800 border-zinc-200`).

### 🎛️ Linux WebKitGTK Spinner Elimination
- **Numeric Stepper Polish**:
  - Fully suppressed native WebKitGTK number spin boxes in connection dialog port inputs and settings panels, providing clean, tactile, custom stepper buttons across all platforms.

---

### 📦 Artifacts Included
- **Linux**:
  - `termlet-linux-amd64.deb` (Debian, Ubuntu, Linux Mint, Pop!_OS)
  - `termlet-linux-amd64.rpm` (Fedora, RHEL, CentOS, openSUSE)
  - `termlet-linux-amd64.tar.gz` (Portable Linux archive)
- **Windows**:
  - `termlet-windows-amd64.zip` (Portable 64-bit Windows archive)
  - `termlet-windows-amd64-installer.exe` (NSIS setup wizard installer)
- **macOS**:
  - `termlet-darwin-universal.dmg` (Apple Silicon & Intel Universal DMG)
  - `termlet-darwin-universal.zip` (Portable macOS bundle)
