# Termlet v0.7.7 🛡️

Termlet **v0.7.7** introduces enterprise-grade **SSH Host Key Verification & MitM Protection**, a dedicated **SSH Security & Known Hosts Manager Tab (`termlet://known-hosts`)**, and modernized build infrastructure powered by **TypeScript 7.0 & Bundler resolution**.

---

### ✨ What's New & Highlights

#### 🛡️ SSH Host Key Verification & MitM Attack Protection
- **Dual-Layer Known Hosts Store**:
  - Automatically queries both the standard OpenSSH `~/.ssh/known_hosts` file and Termlet's dedicated application store (`~/.config/termlet/known_hosts` / `%APPDATA%\termlet\known_hosts`).
  - Automatically records newly trusted hosts with SHA256 cryptographic fingerprints, host keys, and port numbers without mutating standard system files unless configured.
- **Trust On First Use (TOFU) Verification**:
  - When connecting to an unknown host for the first time, an interactive modal presents the host address, key type (e.g., `ssh-ed25519`, `ecdsa-sha2-nistp256`, `rsa-sha2-512`), and full SHA256 fingerprint.
  - Allows you to inspect and confirm the remote server's identity before any authentication tokens or credentials are transmitted over the network.
- **Strict Host Key Mismatch Detection**:
  - If a server's host key changes unexpectedly, Termlet flags a high-priority security warning to prevent Man-in-the-Middle (MitM) eavesdropping and spoofing attacks.
  - Displays side-by-side comparison of the expected fingerprint versus the incoming fingerprint, requiring explicit confirmation before proceeding.

#### 🗂️ Dedicated SSH Security & Known Hosts Manager (`termlet://known-hosts`)
- **Full Workspace Tab Experience**:
  - Moved out of general settings into a dedicated, first-class workspace tab (`termlet://known-hosts`) featuring a shield icon, tab state persistence, and responsive full-width layout.
  - Quick-access button added directly to the bottom status bar (`Known Hosts`) and from the Security section in Settings.
- **Search & Source Filtering**:
  - Real-time search across hostnames, key algorithms, and fingerprints.
  - Filter chips to quickly narrow entries between *All*, *Termlet Store*, and *System Store (`~/.ssh/known_hosts`)*.
- **Hashed Hostname Privacy Support**:
  - Cleanly handles OpenSSH HMAC-SHA1 hashed host entries (`|1|...`), displaying an informative `[Hashed Host]` badge with privacy tooltips instead of raw cryptic hashes.
- **Key Inspection & Revocation**:
  - 1-click SHA256 fingerprint copying with visual confirmation.
  - Instant host revocation and bulk cache clearing directly from the UI.

#### ⚡ Core Engine & Build Modernization
- **TypeScript 7.0 Upgrade**:
  - Upgraded frontend build pipeline to `typescript@7.0.2`.
- **Modern Bundler Module Resolution**:
  - Migrated `tsconfig.json` from legacy `node` resolution to modern Vite `bundler` resolution (`moduleResolution: "bundler"`, `allowImportingTsExtensions`, `isolatedModules: true`).
  - Streamlined type checking and reduced development build latency.

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
