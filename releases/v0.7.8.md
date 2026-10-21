# Termlet v0.7.8 🔑

Termlet **v0.7.8** introduces a native **SSH Key Pair Generator**, an interactive **Local SSH Keys Explorer**, a dedicated **SSH Keys Workspace Tab (`termlet://ssh-keys`)**, and **1-click remote server key installation (`ssh-copy-id`)**.

---

### ✨ What's New & Highlights

#### 🔑 Native SSH Key Pair Generator
- **Multi-Algorithm Cryptographic Key Creation**:
  - Generate industry-standard **Ed25519** *(Recommended, 256-bit)*, **RSA (2048 / 3072 / 4096-bit)**, and **ECDSA (P-256 / P-384 / P-521)** key pairs directly in Termlet without needing terminal CLI tools like `ssh-keygen`.
- **Passphrase Encryption (AES-256)**:
  - Encrypt private keys with an optional passphrase using OpenSSH-standard AES-256 ciphering (`ssh.MarshalPrivateKeyWithPassphrase`).
- **OpenSSH "Drunken Bishop" Randomart Visualizer**:
  - Generates the classic OpenSSH ASCII art representation for instant visual fingerprint verification.
- **Safe Auto-Save to `~/.ssh/`**:
  - Writes private key files with strict `0600` and public key files with `0644` file permissions.
  - Includes duplicate filename detection and explicit overwrite protection.

#### 🗂️ Dedicated SSH Keys Workspace Tab (`termlet://ssh-keys`)
- **Full Workspace Tab Experience**:
  - Open and manage SSH keys in a dedicated workspace tab ([`SSHKeysView.tsx`](file:///home/amanpreet/Documents/termlet/frontend/src/components/SSHKeysView.tsx)) featuring a key icon, tab persistence, and responsive split layout.
  - Quick launcher directly accessible from the bottom Status Bar (`SSH Keys`) and the Settings View.
- **Local Keys Explorer (`~/.ssh/`)**:
  - Automatically scans and displays all local key pairs found in `~/.ssh/`.
  - Shows algorithm badges, key comments, SHA256 fingerprints, file paths, and encryption status.
  - 1-click **Copy Public Key** to clipboard for pasting into GitHub, GitLab, or server configurations.
  - Safe key pair deletion with modal confirmation.

#### 🚀 1-Click Remote Server Deployment (`ssh-copy-id` in-app)
- **Direct Remote Authorization**:
  - Install any generated or local public key onto any active SSH connection with a single click.
  - Automatically ensures remote `~/.ssh` directory exists with `0700` permissions, appends the public key to `~/.ssh/authorized_keys`, and enforces strict `0600` permissions.

#### 🛠️ Connection Profile Integration
- **In-Dialog Key Picker & Generator**:
  - When configuring a private key connection in the Connection Profile Dialog ([`ConnectDialog.tsx`](file:///home/amanpreet/Documents/termlet/frontend/src/components/ConnectDialog.tsx)), a *"Pick / Generate Key..."* button opens the manager and auto-populates the chosen or generated key path.

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
