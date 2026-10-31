# Termlet v0.9.4 🚀

Termlet **v0.9.4** introduces a **Real-Time Interactive PTY Terminal** powered by `@xterm/xterm`, **Empty Folder Robustness & Visual Feedback**, **Persistent File Tree Expansion**, **Native OS-Level Clipboard & Drag-Selection**, and a classic **Solid Block Cursor with Click-to-Focus**.

---

### ✨ What's New & Highlights

#### 🖥️ Real-Time Interactive PTY Terminal (`@xterm/xterm`)
- **Full Pseudo-Terminal (PTY) Engine**:
  - Replaced the legacy subshell runner with an authentic `xterm-256color` PTY allocated directly on the remote server (`ssh.RequestPty`).
  - Seamlessly streams interactive `stdin` and `stdout` in real time via bidirectional Wails runtime events.
- **Support for Interactive CLI Applications**:
  - **`htop` & `top`**: Live CPU/memory monitoring with real-time process table updates, interactive scrolling, and function key controls.
  - **Text Editors**: Full terminal editors like `vim`, `nano`, `vi`, `pico`, and `emacs` work with cursor navigation, syntax highlighting, and keyboard shortcuts.
  - **Interactive Containers & Shells**: `docker exec -it ...`, `python3`, `node`, `bash`, and `sudo` password prompts work natively.
  - **Dynamic Progress Bars**: Commands with in-place rewriting like `docker pull`, `git clone`, `apt install`, and `ping` animate in real time.
- **Dynamic Window Resizing**:
  - Embedded `ResizeObserver` automatically recalculates terminal rows and columns (`fitAddon.fit()`) and synchronizes remote dimensions (`ssh.WindowChange`) as you drag or maximize the drawer.
- **Native Shell Errors & Tab Completion**:
  - Unknown or invalid commands now stream authentic shell output (e.g. `bash: hi: command not found`).
  - Full `<Tab>` path and command auto-completion and Up/Down history browsing.

#### 📁 SFTP File Tree & Empty Folder Robustness
- **Empty Directory Safety**:
  - Fixed a serialization crash where empty directory listings returned `null` instead of `[]` to the frontend, causing `TypeError: null is not an object (evaluating '...map')`.
  - Added a clean `(empty folder)` indicator in the file tree when expanding empty directories.
- **Persistent Tree Expansion on Reload**:
  - Creating, renaming, uploading, or deleting files no longer collapses previously opened subfolders.
  - The tree recursively restores open directory branches and re-fetches updated children.
  - Commands executed in the terminal drawer automatically trigger non-disruptive tree synchronization.

#### 📋 Native OS Clipboard & Smooth Drag-Selection
- **WebKit Sandbox Permission Bypass**:
  - Migrated terminal clipboard operations to Wails's native OS clipboard bridge (`ClipboardGetText` / `ClipboardSetText`), eliminating `"Clipboard access denied"` errors on Linux WebKit2GTK.
- **Auto-Copy on Mouse Selection**:
  - Highlighting text or double-clicking paths/words automatically copies the selection to the system clipboard (standard terminal convention).
- **Instant Right-Click Copy with Toast Notification**:
  - Right-clicking highlighted text copies it instantly with a clear toast alert (`Selection copied to clipboard`).
  - Context menu buttons dynamically adapt between **"Copy Selection"** and **"Copy All Output"**.
  - Middle-click mouse paste support.
  - Keyboard shortcuts <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> and <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>V</kbd>.

#### 🟩 Classic Solid Block Cursor & Click-to-Focus
- **Authentic Terminal Aesthetics**:
  - Configured high-visibility solid blinking green block cursor (`█`) matching standard GNOME Terminal and xterm aesthetics.
  - Clicking anywhere inside the terminal drawer immediately focuses the active shell.

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
