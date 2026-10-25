<p align="center">
  <img src="build/appicon.png" alt="Termlet logo" width="120" />
</p>

<h1 align="center">Termlet</h1>

<p align="center">
  A fast, cross-platform desktop <b>SSH client</b> with a built-in <b>SFTP file browser</b>,
  <b>remote code editor</b>, and <b>port forwarding</b> manager.
</p>

<p align="center">
  <a href="https://github.com/Amanbig/termlet/releases/latest"><img src="https://img.shields.io/github/v/release/Amanbig/termlet?label=release" alt="Latest release" /></a>
  <a href="https://github.com/Amanbig/termlet/actions/workflows/ci.yml"><img src="https://github.com/Amanbig/termlet/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-Apache_2.0-blue.svg" alt="License: Apache 2.0" /></a>
  <a href="https://github.com/Amanbig/termlet/issues"><img src="https://img.shields.io/github/issues/Amanbig/termlet" alt="Open issues" /></a>
  <img src="https://img.shields.io/badge/Platform-Linux%20%7C%20Windows%20%7C%20macOS-lightgrey" alt="Platforms" />
</p>

[![Get it from the Snap Store](https://snapcraft.io/en/dark/install.svg)](https://snapcraft.io/termlet)

<p align="center">
  <a href="#install">Install</a> ·
  <a href="#features">Features</a> ·
  <a href="#build-from-source">Build</a> ·
  <a href="CONTRIBUTING.md">Contribute</a> ·
  <a href="https://github.com/Amanbig/termlet/issues/new/choose">Report a bug</a>
</p>

<p align="center">
  <img src="docs/screenshot.png" alt="Termlet screenshot" width="800" />
</p>

## Why Termlet?

Managing a remote server usually means juggling a terminal, an SFTP client, a text editor, and a pile of `ssh -L` commands. Termlet puts them in one lightweight native window: connect once, then browse files, edit them in place, and tunnel ports without leaving the app.

Built with [Wails v2](https://wails.io) (Go) and React 19 + TypeScript, so it ships as a small native binary instead of an Electron bundle.

## Features

- **SSH terminal and profiles**: save servers, use passwords, private keys (with passphrases), or your SSH agent. Host keys are verified, with a warning when a key changes.
- **Multi-tab remote terminal**: true line-based stream emulator with multi-tab concurrency, multi-line command continuation (`\` & Shift+Enter), tab renaming, tab duplication, and draggable drawer resizing.
- **SFTP file browser**: browse, create, rename, delete, and upload files on the remote host with bi-directional terminal CWD sync.
- **Remote code editor**: CodeMirror 6 with syntax highlighting, multiple tabs, 14 themes, and <kbd>Ctrl</kbd>+<kbd>S</kbd> to save straight to the server. Binary files are detected and not opened.
- **Local port forwarding** (`ssh -L`): create, start, and stop tunnels from a dedicated view. Forwards are saved with the profile, with one-click "open in browser" and presets for common services (HTTP, Vite, PostgreSQL, MySQL, Redis, Traefik).
- **Auto-update**: checks GitHub Releases and installs updates in place (`.deb`, `.rpm`, Windows installer, or portable binary).
- **Polished UI**: frameless window, resizable sidebar and terminal drawer, light and dark themes, and readable error messages with troubleshooting hints.

## Install

Download the latest build for your platform from the [Releases page](https://github.com/Amanbig/termlet/releases/latest):

| Platform | Packages |
| :--- | :--- |
| **Linux (amd64)** | `.deb`, `.rpm`, `.tar.gz` |
| **Windows (amd64)** | Installer `.exe`, portable `.zip` |
| **macOS (Universal)** | `.dmg`, `.zip` |

On Linux, Termlet needs GTK 3 and WebKitGTK 4.1 at runtime (installed automatically by the `.deb` and `.rpm` packages).

## Build from source

### Prerequisites

- [Go](https://go.dev/dl/) (version in [`go.mod`](go.mod))
- [Node.js](https://nodejs.org/) 20+ and npm
- [Wails CLI](https://wails.io/docs/gettingstarted/installation) v2.9+:
  `go install github.com/wailsapp/wails/v2/cmd/wails@latest`
- **Linux only**, GTK and WebKit headers:

  ```bash
  # Debian / Ubuntu / Mint
  sudo apt-get install -y build-essential pkg-config libgtk-3-dev libwebkit2gtk-4.1-dev

  # Fedora / RHEL
  sudo dnf install -y gtk3-devel webkit2gtk4.1-devel
  ```

### Run in development

```bash
git clone https://github.com/Amanbig/termlet.git
cd termlet
(cd frontend && npm install)
wails dev -tags webkit2_41      # drop "-tags webkit2_41" on Windows/macOS
```

### Production build

```bash
wails build -tags webkit2_41    # output: build/bin/termlet
```

### Tests

```bash
go test ./internal/...
cd frontend && npx tsc --noEmit
```

## Project layout

```
termlet/
├── app.go, main.go        # Wails entrypoint and Go ↔ frontend bindings
├── internal/
│   ├── sshclient/         # SSH client, PTY sessions, authentication
│   ├── sftpclient/        # SFTP file operations
│   ├── tunnel/            # Local port forwarding manager
│   ├── connections/       # Connection manager and sessions
│   ├── storage/           # Profile and settings persistence
│   ├── models/            # Shared data types
│   ├── updater/           # GitHub release check and installer
│   └── version/           # Version constant
├── frontend/              # React + TypeScript + Tailwind CSS v4 UI
├── build/                 # Icons and packaging (Linux, Windows, macOS)
└── .github/               # CI, release workflow, issue/PR templates
```

## Contributing

Contributions of all sizes are welcome: bug reports, feature ideas, docs, and code.

1. Read [CONTRIBUTING.md](CONTRIBUTING.md) for the dev setup and PR process.
2. Look for issues labeled [`good first issue`](https://github.com/Amanbig/termlet/labels/good%20first%20issue) or [`help wanted`](https://github.com/Amanbig/termlet/labels/help%20wanted).
3. Please follow our [Code of Conduct](CODE_OF_CONDUCT.md).

Found a security problem? Don't open a public issue; see [SECURITY.md](SECURITY.md).

## Changelog

See [RELEASE_NOTES.md](RELEASE_NOTES.md) for the current release and [releases/](releases/) for the full history.

## License

Licensed under the [Apache License 2.0](LICENSE).
