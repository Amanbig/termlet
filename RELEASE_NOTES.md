# Termlet v0.9.0 💻

Termlet **v0.9.0** brings a major UX and productivity upgrade across the entire workspace, introducing a **Multi-Tab Remote Terminal** runner, real **Line-Based Shell Stream** with multi-line command continuation (`\` & Shift+Enter), **VS Code Style Draggable Resizing** for both the terminal drawer and sidepanel, unified sidebar width, and tab management polish.

---

### ✨ What's New & Highlights

#### 💻 Multi-Tab Line-Based Terminal Runner
- **True Line-Based Stream**:
  - Replaced the detached bottom input box with a real terminal emulator stream where the prompt (`username@host:path$ [cursor]`) follows output directly inline.
  - History entries render as authentic prompt lines with working directory context.
  - Pressing Enter on an empty line naturally emits a fresh prompt on the next line; pressing Ctrl+C prints `^C` inline and resets the prompt.
- **Multi-Line Command Continuation (`\` and Shift+Enter)**:
  - Write multi-line commands using standard trailing backslash `\` (e.g. `docker run -d \`) or Shift+Enter.
  - Continuation lines render with secondary shell prompt (`> `) matching real Bash/Zsh behavior.
  - Pressing Backspace on an empty continuation prompt pops the previous line back into the active input for easy editing.
  - Smart multi-line paste support: pasting multi-line scripts or command blocks automatically parses them into continuation lines and active input ready to inspect and run.
- **Multiple Concurrent Terminal Tabs**:
  - Open multiple concurrent terminals (`Terminal 1`, `Terminal 2`, etc.) multiplexed over the same SSH connection.
  - Each tab maintains independent remote working directory (`CWD`), history, and command execution state.
  - Run long-running tasks in one tab while executing commands concurrently in another.
- **Tab Management Polish**:
  - **Double-Click to Rename**: Double-click any tab title to rename it to something custom like `docker`, `web-server`, or `logs`.
  - **Duplicate Tab**: Dedicated button next to `+` to duplicate active tab in its current remote working directory.
  - **Horizontal Wheel & Arrow Scrolling**: Scroll horizontally with your mouse wheel, click left/right navigation arrows, and enjoy smooth automatic centering on the active tab.
  - **Local `exit` / `logout` Handling**: Typing `exit` or `logout` cleanly closes the active tab (or drawer if last tab).

#### 📐 Workspace Layout & Resizing
- **VS Code Style Drag-to-Resize Drawer**:
  - Drag the top border of the terminal drawer to adjust height smoothly between 100px and `workspaceHeight - 50px`.
  - Double-click the resize handle to toggle maximize / restore height.
  - Height is saved across app restarts.
- **Draggable Sidepanel & Unified Width**:
  - Added a draggable vertical resize handle on the right border of the sidepanel.
  - Clamped smoothly between 180px and 60% of the window width, with double-click reset to default (270px).
  - Unified width across **Explorer**, **Ports**, and **Profiles** views, eliminating previous width jumping.
- **Workspace-Scoped Drawer**:
  - Terminal drawer sits strictly inside the editor workspace to the right of the sidebar, never covering the ActivityBar or file tree.
- **ActivityBar Tab Reordering**:
  - Moved **Remote Profiles & Sessions** (`Server` icon) to the very top above **Explorer** (`Files` icon), defaulting to connections on app startup for instant server selection.

#### ⚡ Port Forwarding Stability
- **Deterministic Port List Ordering**:
  - Fixed a race condition where Go map iteration randomization caused active/inactive port forwarding cards to continually bounce and swap positions on periodic refresh.
  - Ports are now stably sorted by local port and ID on both backend and frontend.

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
