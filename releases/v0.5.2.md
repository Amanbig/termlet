# Termlet v0.5.2 🚀

Termlet **v0.5.2** brings comprehensive, production-grade error handling across the entire stack, eliminating white-screen crashes, introducing actionable diagnostic hints, and bolstering backend fault tolerance alongside our streamlined in-settings automatic updater and UI refinements.

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

#### 🔄 Streamlined In-Settings Automatic Updater
- **Eliminated Redundant Popup Modal**:
  - Removed confusing modal dialog overlay in favor of a clean, unified update dashboard built directly into the Settings "About & Updates" card.
- **Inline Package Download & Installation**:
  - Real-time download progress bar with downloaded MB / total MB and percentage.
  - Status feedback (*"Downloading package..."*, *"Extracting payload..."*, *"Installing package..."*).
  - Instant **"Restart to Apply"** 1-click restart button upon completion.
- **Quick Access from Anywhere**:
  - Clicking "Update in Settings" from the floating notification toast or clicking the version button in the status bar opens Settings directly to the update card.

#### 🎨 Theme-Aware, High-Contrast Toast Notifications
- **Dynamic Light/Dark Mode Palette**:
  - Toasts are now fully synchronized with Termlet's UI theme (`settings.uiTheme`), dynamically shifting between a rich dark backdrop (`dark:bg-zinc-900/95`) and crisp light background (`bg-white/95`).
- **Tactile Semantic Color Tinting**:
  - Success, error, warning, and info notifications adopt matching pastel status tints and high-contrast borders (emerald, rose, amber, and blue).
  - Integrated Lucide SVG icons (`CheckCircle2`, `AlertCircle`, `AlertTriangle`, `Info`, `Loader2`).
- **Integrated Close Buttons & Accessible Text**:
  - Every notification card includes an accessible dismiss button, clean typography, and high-contrast hint/description text.

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
