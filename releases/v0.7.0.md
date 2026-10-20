# Termlet v0.7.0 🚀

Termlet **v0.7.0** is a major feature update delivering powerful productivity workflows: **Fast Remote File Quick Open** (<kbd>Ctrl+P</kbd> / <kbd>Cmd+P</kbd>), **1-Click OpenSSH `~/.ssh/config` Importer**, **Remote File & Directory Download (with ZIP streaming)**, **Interactive `chmod` Permissions Modal**, **Port Forwarding Live Health Badges**, and a floating **Code Editor Find & Replace toolbar** (<kbd>Ctrl+F</kbd> / <kbd>Ctrl+H</kbd>).

---

### ✨ What's New & Highlights

#### ⚡ Fast Remote File Quick Open (<kbd>Ctrl+P</kbd> / <kbd>Cmd+P</kbd>)
- **Near-Instant Remote Indexing**:
  - Executes remote SSH find commands for near-instant indexing of up to 800 workspace files, automatically pruned of noise directories (`.git`, `node_modules`, `dist`, `vendor`, `.venv`).
  - Seamless fallback to breadth-first SFTP directory traversal on systems without remote find execution.
- **Fuzzy Client-Side Matching**:
  - Multi-term scoring algorithm that instantly ranks results by exact match, prefix match, path length, and recently opened file status.
  - Fast keyboard navigation (<kbd>↑</kbd>, <kbd>↓</kbd>, <kbd>Enter</kbd> to open, <kbd>Escape</kbd> to close).
- **Rock-Solid Typing Stability**:
  - Query sequence locking prevents network race conditions and protects search text from clearing or reloading while typing.
  - Inline error notifications with a 1-click retry button if remote search encounters permission or connection issues.

#### 🔑 1-Click OpenSSH `~/.ssh/config` Importer
- **Automated Profile Discovery**:
  - Scan and parse your local `~/.ssh/config` file with a single click.
  - Supports `Host`, `HostName`, `User`, `Port`, `IdentityFile`, `ProxyJump`, and `ForwardAgent` directives.
- **Interactive Review & Selection**:
  - Preview all discovered hosts with badges for ports, keys, and jump proxies.
  - Multi-select or selectively import hosts with automatic duplicate detection against existing profiles.

#### 📥 Remote File & Directory Download
- **Direct Local File Download**:
  - Right-click any file in the Remote File Explorer to download it directly via the native operating system Save dialog.
- **On-the-Fly Directory Download as ZIP**:
  - Right-click any remote directory to stream its entire hierarchy directly into a local `.zip` file on the fly without intermediate disk overhead.

#### 🛡️ Interactive Remote Permissions Modal (`chmod`)
- **Visual Permission Matrix**:
  - Right-click any remote file or folder to inspect and adjust permissions.
  - 3x3 interactive grid (User, Group, Other $\times$ Read, Write, Execute).
- **Live Octal & Symbolic Sync**:
  - Bidirectional sync between checkboxes, numeric octal notation (`0755`, `0644`, `0600`), and symbolic string preview (`-rwxr-xr-x`).
  - 1-click presets for standard Unix file and directory permissions.
  - Optional recursive mode for applying permissions across entire directory trees.

#### 🩺 Port Forwarding Live Health Badges
- **Real-Time Port Probing**:
  - Automatically probes active local port forwards using HTTP GET (with redirect suppression) and falls back to TCP dial probes.
- **Live Status Badges**:
  - Visual badges indicating HTTP status codes and latency (`🟢 200 OK (8ms)`, `🟡 404 Not Found (4ms)`).
  - `🔵 TCP Ready (1ms)` for non-HTTP services (databases, Redis, custom protocol daemons).
  - `🔴 Unreachable` if remote services stop or fail to respond.
  - Concurrent backend multi-port health checker with automatic periodic refresh.

#### 🔍 Code Editor Find & Replace (<kbd>Ctrl+F</kbd> / <kbd>Ctrl+H</kbd>)
- **Floating Glassmorphic Toolbar**:
  - Modern floating toolbar anchored to the top-right of the code editor.
  - <kbd>Ctrl+F</kbd> / <kbd>Cmd+F</kbd> opens Find (pre-populated with any active text selection).
  - <kbd>Ctrl+H</kbd> / <kbd>Cmd+H</kbd> opens Find & Replace with the replace row expanded.
- **Comprehensive Search Options**:
  - Match Case (`Aa`), Match Whole Word (`\b`), and Regular Expression (`.*`) with live syntax error feedback.
  - Live match counter displaying current position (`1 of 12` or `No results`).
  - Next (<kbd>Enter</kbd>) and Previous (<kbd>Shift+Enter</kbd>) navigation.
  - Single Replace and Replace All actions with real-time editor and dirty state synchronization.
  - 1-click "Find" button in the bottom status bar.

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
