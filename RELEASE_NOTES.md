# Termlet v0.6.0 🚀

Termlet **v0.6.0** introduces native **SSH Local Port Forwarding & Tunneling**, allowing you to effortlessly map internal remote server services (like Traefik dashboard, Docker webhooks, internal Postgres/MySQL/Redis, Next.js dev servers, or internal microservices) directly to `localhost` on your machine.

---

### ✨ What's New & Highlights

#### 🔌 SSH Local Port Forwarding & Tunneling
- **Direct Service Tunneling (`ssh -L`)**:
  - Securely route remote server ports (e.g., `127.0.0.1:8080`, `127.0.0.1:5432`) to any chosen local port on your machine over an encrypted SSH connection.
- **Dedicated Port Forwarding View**:
  - Accessible directly from the new **Ports** tab on the left Activity Bar or the bottom Status Bar.
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

#### 📑 Tab Bar Scrollbar & Navigation (from v0.5.3)
- Smooth horizontal mouse-wheel scrolling over open tabs.
- Dedicated `.editor-tabs-scrollbar` with step chevrons and auto-scroll to active tab.
- Bulk tab actions: *"Close Other Tabs"* and *"Close Saved Tabs"*.

#### 🎨 14 High-Fidelity Editor Themes & Live Switching
- Instant live theme switching across 14 themes without restarting Termlet.
- Polished theme-synchronized toast notifications with ergonomic top-right dismiss buttons.

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
