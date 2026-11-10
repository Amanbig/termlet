# Termlet v0.10.0 🚀

Termlet **v0.10.0** introduces **SSH Jump Host / Bastion (ProxyJump) tunneling**, an integrated **Command Snippets & Quick Actions Palette** (`Ctrl+K`/`Cmd+K`) with persistent storage and DevOps presets, comprehensive UI theme polish for dark/light mode select dropdowns, viewport-bounded scrollable connection dialogs, and consolidated dependency updates across Go, Vite, Tailwind CSS, and GitHub Actions.

---

### ✨ What's New & Highlights

#### 🛡️ SSH Jump Host & Bastion (ProxyJump) Support
- **Intermediate Bastion Dialing**:
  - Connect securely to private remote servers located in isolated VPCs, subnets, or internal corporate networks by tunneling through an intermediate SSH bastion or jump host.
  - Implemented cascading TCP dial tunneling in the Go backend (`bastion.Dial("tcp", addr)` with `handshakeConn`) ensuring full handshake negotiation, host key verification, context cancellation, and cascaded connection tear-down.
- **Config-Driven & UI Integration**:
  - Direct selection of configured Jump Host profiles inside the Connection Dialog.
  - Full support for `ProxyJump` directives when importing configurations from `~/.ssh/config`.
  - Informative visual routing badges across the Connection Sidebar and Remote Explorer (`via <jump_host>`) displaying real-time bastion routing status.

#### ⚡ Command Snippets & Quick Actions Palette (`Ctrl+K` / `Cmd+K`)
- **Global Command Palette**:
  - Access snippets anywhere in Termlet using `Ctrl+K` (or `Cmd+K` on macOS) to instantly search, filter, preview, and execute commands in active remote sessions.
- **Persistent Snippets Library & DevOps Presets**:
  - Persisted JSON storage at `~/.config/termlet/snippets.json` with CRUD operations (create, edit, delete, categorize, tag, and restore defaults).
  - Ships out-of-the-box with 11 production DevOps presets spanning Docker cleanup, Git maintenance, system diagnostics, and network troubleshooting.
- **Dedicated Activity Drawer**:
  - A clean 3-tier card layout in the Snippets sidebar drawer with full-width titles, monospace syntax blocks, description, copy button, and 1-click execution to the active interactive terminal.

#### 🎨 UI Polish & Theming Consistency
- **Native Select Dropdowns in Dark/Light Modes**:
  - Configured `color-scheme: light` on `:root` and `color-scheme: dark` on `.dark` in CSS, ensuring Linux WebKitGTK and desktop runtimes render select elements and native dropdown popups in the proper theme.
  - Enforced `appearance: none` with custom SVG chevrons and Tailwind zinc styling across all form selectors.
- **Viewport-Bounded Dialog Safety**:
  - Pinned modal headers and footers with `shrink-0` and made form contents scrollable (`max-h-[85vh]` and `overflow-y-auto`).
  - Guarantees `Connect` and `Cancel` action buttons are always accessible and never clipped off-screen when Jump Host options, advanced keep-alive, or error details are expanded.

#### 📦 Core Dependency Updates
- **Go Backend**:
  - `github.com/wailsapp/wails/v2`: `v2.17.0` &rarr; `v2.17.1`
  - `golang.org/x/crypto`: updated to latest security release
- **Frontend & Tooling**:
  - `vite`: `8.3.5` &rarr; `8.3.6`
  - `@vitejs/plugin-react`: `6.2.0` &rarr; `6.2.1`
  - `tailwindcss` & `@tailwindcss/vite`: `4.3.4` &rarr; `4.3.5`
  - `lucide-react`: `1.68.0` &rarr; `1.71.0`
  - `marked`: `18.1.3` &rarr; `18.2.0`
  - `cn`: `0.5.1` &rarr; `0.5.2`

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
