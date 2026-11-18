# Termlet v0.10.3 🚀

Termlet **v0.10.3** is a major feature update delivering **Remote Reverse Port Forwarding (`ssh -R`)**, **Terminal Split Panes**, **Terminal Session Recording & Multi-Format Export** (`.cast`, `.txt`, `.html`), **Server Quick-Diagnostics & Network Toolkit**, **SFTP Directory Sync & Compare**, and a **VS Code-inspired terminal drawer with an interactive resizable tabs sidebar**.

---

### ✨ What's New & Highlights

#### 🌐 Remote Reverse Port Forwarding (`ssh -R`)
- **Expose Local Services Remotely**:
  - Forward inbound traffic from a remote SSH server port back to your local development environment.
  - Implemented with Go's `ssh.Client.Listen("tcp", remoteAddr)` with robust bidirectional TCP streaming, goroutine lifecycle management, and clean connection teardown.
- **3-Way Port Forwarding UI**:
  - Unified toggle between **Local** (`-L`), **Dynamic SOCKS5** (`-D`), and **Reverse / Remote** (`-R`) forwarding modes.
  - Quick-pick presets for common ports (HTTP `8080`, Vite `5173`, React `3000`, Node `4000`, MySQL `3306`, Postgres `5432`, Redis `6379`).
  - Real-time emerald status badges and convenient 1-click `curl` test commands for remote verification.

#### 🪟 Terminal Split Panes (Horizontal & Vertical)
- **Side-by-Side & Stacked Terminals**:
  - Split any active terminal tab vertically (side-by-side) or horizontally (top-and-bottom) with independent interactive PTY allocations.
  - Seamless active pane tracking, focus switching on click or typing, and dedicated close controls per pane.

#### 🎥 Terminal Session Recording, Replayer & Multi-Format Export
- **Live Session Recording**:
  - Built-in terminal stream recorder capturing terminal I/O events with precise millisecond relative timestamps.
  - Top header visual pulse indicator with live elapsed time (`REC MM:SS`).
- **Interactive Player & Exporters**:
  - Modal replayer with scrub slider, play/pause, and time tracking.
  - 1-click export to:
    - **Asciinema v2 (`.cast`)**: Standard asciicast format compatible with asciinema player and web embeds.
    - **Raw Transcript (`.txt`)**: Clean text log of terminal output.
    - **Standalone HTML Preview (`.html`)**: Self-contained styled HTML file ready to share.

#### 📊 Server Quick-Diagnostics & Network Toolkit
- **Instant System Metrics**:
  - 1-click diagnostics for CPU utilization, RAM usage, Swap space, Disk partitions, uptime, and top resource-consuming processes.
- **Network Diagnostic Suite**:
  - Perform live network diagnostics directly from the remote server: **Ping**, **DNS lookup**, **TCP port check**, **Listening ports (`netstat`/`ss`)**, and **Traceroute**.
  - Strict regex sanitization on host/port inputs to prevent command injection risks.

#### 🔄 SFTP Directory Sync & Compare
- **Side-by-Side Directory Comparison**:
  - Compare local and remote folders side-by-side with automatic diff detection: `Match`, `Different`, `Only Local`, `Only Remote`.
- **Flexible Sync Operations**:
  - Choose between **Pull** (Remote &rarr; Local), **Push** (Local &rarr; Remote), or **Mirror** (Full 2-way sync) with individual file selection checkboxes.

#### 💻 VS Code-Style Terminal Drawer & Resizable Tabs Sidebar
- **VS Code Panel Layout**:
  - Integrated header with panel tabs: `PROBLEMS`, `OUTPUT`, `DEBUG CONSOLE`, `TERMINAL`, `PORTS`.
  - Action controls strip: `+ ⌵` (New terminal dropdown), `...` (More actions), `|` (Divider), `[ ]` (Maximize/Restore), and `✕` (Close).
- **Interactive Resizable Vertical Tab List**:
  - Right-hand terminal tab strip with `[>_]` icon badges and `bash` naming.
  - Inline hover action buttons: Split Terminal (`Columns2`) and Kill Terminal (`Trash2` with `Kill (Del)` tooltip).
  - Vertical drag handle (`col-resize`) to adjust sidebar width smoothly, with width preferences automatically persisted in `localStorage`.
- **Toolbar Polish**:
  - Cleaned up redundant Snippets button from the terminal drawer toolbar in favor of the global `Ctrl+K` palette and dedicated activity bar tab.

#### 📦 Dependency & Security Updates
- Consolidated Dependabot updates across Go modules and NPM frontend packages.

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
