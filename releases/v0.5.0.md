# Termlet v0.5.0 🚀

Termlet **v0.5.0** is a major milestone release of Termlet — a modern, blazing-fast cross-platform SSH terminal, SFTP browser, and remote code editor built with Go, Wails v2, and React.

---

### ✨ What's New & Highlights

#### 🪟 Modern Frameless Window & Integrated Controls
- **Custom Frameless Title Bar**:
  - Replaced native OS window decorations with an integrated, sleek title bar matching the active application theme.
  - Modern window controls: **`—` Minimize**, **`□` Maximize / Restore**, and **`✕` Close**.
  - **Dynamic Maximize/Restore Toggle**: Smoothly switches between single square and dual-rectangle restore icons.
  - **Double-Click Header**: Double-clicking anywhere on the draggable titlebar toggles maximize and restore.
  - **Smooth Window Dragging**: Designated drag region (`.wails-drag` and `.wails-no-drag`) allows effortless window movement across Linux, Windows, and macOS.
  - **Active Session Pill**: Displays the currently connected remote server with a pulsing green indicator and quick-disconnect dropdown right inside the title bar.

#### ⚡ Full-Featured SSH Terminal & Profile Manager
- **SSH Connection Profiles**: Save and organize multiple remote servers with custom labels, hostnames, ports, usernames, and authentication methods (password or private key).
- **Fast Session Switching**: Switch between active servers and terminal tabs effortlessly without losing state.
- **Configurable Terminal**: Built-in font size stepper with 1-click increment/decrement, custom font families (JetBrains Mono), and configurable tab indentations.

#### 📁 Dual-Pane Remote SFTP Browser & Inline Code Editor
- **Remote File Tree**: Fast SFTP tree exploration with file type icons, directory expansion, and breadcrumbs.
- **Integrated Code Editor**: Open, view, and edit remote files directly on your server with syntax highlighting and instant remote save (<kbd>Ctrl + S</kbd> / <kbd>Cmd + S</kbd>).
- **Safety Confirmations**: Optional confirmation dialogs before deleting remote files or directories to prevent accidental data loss.

#### 🎨 Polished Light & Dark Theme System
- **Unified Workspace Aesthetics**: Clean dark mode (`#09090b` / `zinc-950`) and light mode (`zinc-50`) with seamless status bar alignment.
- **Custom Numeric Controls**: Handcrafted tactile font size steppers and sanitized port inputs eliminating native WebKitGTK white spinner box artifacts on Linux.
- **Searchable Settings View**: Filter preferences instantly through a centered search bar across appearance, editor, and SSH settings.

#### 🔄 In-App Updater & Release Detection
- **GitHub Release Integration**: Automatically checks for new Termlet releases directly from GitHub.
- **In-App Notification**: Instant notification toast with version diff and direct download links when an update is available.

#### 📦 Multi-Platform Native Packaging
- **Linux Packages**: Automated `.deb`, `.rpm`, and portable `.tar.gz` packages generated with NFPM, including desktop launcher (`termlet.desktop`) and high-resolution icons.
- **Windows Binaries**: Standalone Windows executables (`termlet-windows-amd64.zip`).
- **macOS Universal Builds**: Native Apple Silicon & Intel universal binaries and DMG images.
- **Open-Source License**: Released under the permissive **Apache 2.0 License**.

---

### 📦 Artifacts Included
- **Linux**:
  - `termlet-linux-amd64.deb` (Debian, Ubuntu, Linux Mint, Pop!_OS)
  - `termlet-linux-amd64.rpm` (Fedora, RHEL, CentOS, openSUSE)
  - `termlet-linux-amd64.tar.gz` (Portable Linux archive)
- **Windows**:
  - `termlet-windows-amd64.zip` (Portable 64-bit Windows archive)
- **macOS**:
  - `termlet-darwin-universal.dmg` (Apple Silicon & Intel Universal DMG)
  - `termlet-darwin-universal.zip` (Portable macOS bundle)
