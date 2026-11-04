# Termlet v0.9.5 🚀

Termlet **v0.9.5** eliminates **unsolicited HTTP health check requests** on forwarded ports, resolves a **React polling spin loop**, prepares the snap package for **Ubuntu USN-8975-1 security updates** (`libsoup-3.0-common`), and consolidates all latest core dependencies across Go, Node.js, and GitHub Actions.

---

### ✨ What's New & Highlights

#### 🔌 Non-Intrusive Port Forwarding & Health Checking
- **Eliminated Unsolicited HTTP GET Probes**:
  - Removed synthetic HTTP client probing (`GET http://127.0.0.1:<port>/` with `User-Agent: Termlet-HealthCheck/1.0`) that previously hit forwarded ports over SSH even before any browser or client connection was opened.
  - Prevents server access log pollution, unwanted route execution, and connection/protocol corruption on non-HTTP services (such as PostgreSQL, MySQL, Redis, MongoDB, and gRPC).
  - Health checks now check internal forwarder readiness (`Status`, `LocalPort`, `ErrorMsg`) and verify raw TCP socket readiness (`net.DialTimeout`) without sending application-layer bytes.
- **Fixed React Polling & Re-render Spin Loop**:
  - Resolved a `useCallback` / `useEffect` dependency loop in `PortForwardView` that caused health checks to fire repeatedly every second in the background.
  - Stabilized component lifecycle callbacks and timers to a smooth, predictable 5-second refresh interval without unnecessary re-renders.

#### 🛡️ Ubuntu Security Updates & Snapcraft Packaging
- **Ubuntu Security Notice (USN-8975-1)**:
  - Addressed Canonical security advisory for `libsoup-3.0-common` in snap revisions r10/r11 by updating build configuration to pull the latest Ubuntu `core24` archive security patches.
- **Snapcraft Tooling Alignment**:
  - Synchronized Wails CLI installation in `snap/snapcraft.yaml` to `v2.17.0` to match `go.mod`.

#### 📦 Core Dependency Updates
- **Go Backend**:
  - `github.com/wailsapp/wails/v2`: `v2.16.0` &rarr; `v2.17.0`
  - `github.com/pkg/sftp`: `v1.13.11` &rarr; `v1.13.12`
- **Frontend & Tooling**:
  - `vite`: `8.3.4` &rarr; `8.3.5`
  - `shadcn`: `4.22.0` &rarr; `4.23.0`
  - `@types/node`: `26.6.5` &rarr; `26.6.6`
  - `marked`: `18.1.1` &rarr; `18.1.3`
  - `lucide-react`: `1.59.0` &rarr; `1.68.0`
- **CI / CD**:
  - `actions/upload-artifact`: `v4` &rarr; `v7` in release workflow

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
