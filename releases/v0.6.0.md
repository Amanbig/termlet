# Termlet v0.6.0 🚀

Termlet **v0.6.0** introduces native **SSH Local Port Forwarding & Tunneling**, allowing you to effortlessly map internal remote server services (like Traefik dashboard, Docker webhooks, internal Postgres/MySQL/Redis, Next.js dev servers, or internal microservices) directly to `localhost` on your machine. This release also introduces **profile-persisted port configurations**, **native in-app confirmation dialogs**, and navigation refinements.

---

### ✨ What's New & Highlights

#### 🔌 SSH Local Port Forwarding & Tunneling
- **Direct Service Tunneling (`ssh -L`)**:
  - Securely route remote server ports (e.g., `127.0.0.1:8080`, `127.0.0.1:5432`) to any chosen local port on your machine over an encrypted SSH connection.
- **Dedicated Port Forwarding View**:
  - Accessible directly from the new **Ports** tab on the left Activity Bar or the bottom Status Bar.
- **Profile-Persisted Port Configurations**:
  - Forwarded port configurations are saved alongside your connection profiles in a stopped state. When you reconnect to a saved profile, your port mappings are immediately ready to toggle on with a single click.
- **1-Click Browser Launch**:
  - Launch tunneled web services (e.g. Traefik, Vite, React, Swagger) directly in your default browser with a single click.
- **One-Click URL Copying**:
  - Copy `http://localhost:<port>` to the clipboard with visual confirmation.
- **Quick Presets**:
  - Built-in shortcuts for Traefik Dashboard (`8080`), Web / HTTP (`8080 -> 80`), Node/Vite (`3000`), PostgreSQL (`5432`), MySQL (`3306`), and Redis (`6379`).
- **Live Status & Concurrency Tracking**:
  - Real-time indicator badges showing active, stopped, or error states, along with active connection counts.
  - Safe port conflict detection and automatic tunnel teardown when disconnecting.
- **Status Bar Integration**:
  - Added a live `🔌 X Ports Forwarded` counter in the status bar for quick glance and 1-click access.

#### 💬 Native In-App Confirmation Modals
- **Sleek Custom Dialogs**:
  - Replaced all native browser `window.confirm` popups with custom, theme-styled in-app modal confirmation dialogs.
  - Applied across deleting connection profiles, deleting port forward rules, deleting remote files/directories, resetting preferences, and closing tabs with unsaved edits.
  - Keyboard accessible (<kbd>Enter</kbd> to confirm, <kbd>Escape</kbd> to cancel) with distinct visual cues and badges for destructive actions.

#### 📑 Tab Navigation & UI Polish
- **Clean Editor Tab Navigation**:
  - Removed overlapping horizontal scrollbars on editor tabs in favor of compact left/right chevron navigation buttons and smooth trackpad/mouse-wheel scrolling.
- **Unified Activity Bar**:
  - Refined the Ports button styling to seamlessly match the active/inactive appearance of the File Explorer and other sidebar tools.

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
