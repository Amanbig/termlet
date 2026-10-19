# Termlet v0.5.1 🚀

Termlet **v0.5.1** is a targeted polish and stability release focusing on native Windows icon integration, webview favicon fidelity, comprehensive light-mode theme contrast enhancements, and UI control cleanup across platforms.

---

### ✨ What's New & Highlights

#### 🪟 Windows Native Icon & Taskbar Integration
- **Multi-Resolution Windows Executable Icon**:
  - Generated and embedded a true multi-resolution icon (`build/windows/icon.ico`) with standard 16x16, 32x32, 48x48, 64x64, 128x128, and 256x256 RGBA layers.
  - Fixes icon display across Windows Taskbar, Alt-Tab task switcher, File Explorer detail/tile views, and the window title bar.
  - Resolved missing custom icon issue in NSIS installer setup wizard and Start Menu application shortcuts.
- **Master App Icon Standardization**:
  - Re-rendered `build/appicon.png` into a crisp 512x512 RGBA squircle asset with smooth antialiased corners for cross-platform packaging.

#### 🌐 Webview & Browser Favicon Assets
- **Webview Favicon Support**:
  - Added `frontend/public/favicon.png` (512x512) and `frontend/public/favicon.ico` (multi-res 16/32/48).
  - Explicitly linked `<link rel="icon" type="image/png" href="/favicon.png" />` in `frontend/index.html` to eliminate blank or default webview icons during runtime.
  - Added clean `<title>Termlet</title>` branding in the webview document head.

#### 🎨 Complete Light Mode UI & Contrast Polish
- **Remote File Tree Readability**:
  - Enhanced text color contrast in light mode: unselected tree items now use high-contrast dark text (`text-zinc-800` / `hover:text-zinc-950`) instead of low-contrast muted zinc.
  - Polished active item highlight: replaced low-contrast white highlight with a crisp, subtle blue badge (`bg-blue-100 text-blue-900` in light mode, `bg-blue-900/30 text-blue-200` in dark mode).
  - Ensured toolbar button icons (`Refresh`, `Collapse All`) adopt high-contrast foreground states in both themes.
- **Code Editor Canvas & Status Bar**:
  - Fixed empty editor background: eliminated the jarring dark canvas in light mode when no files are open, seamlessly adopting a clean `bg-zinc-50` backdrop with dark zinc prompt text.
  - Seamless Status Bar: synchronized the bottom status bar background (`bg-zinc-100/90 text-zinc-700`) and border color to match the light theme workspace.
- **SSH Connection Dialog**:
  - Overhauled modal styling: resolved harsh dark panels in light mode by applying appropriate light theme containers (`bg-white/95 text-zinc-800 border-zinc-200`).

#### 🎛️ Linux WebKitGTK Spinner Elimination
- **Numeric Stepper Polish**:
  - Fully suppressed native WebKitGTK number spin boxes in connection dialog port inputs and settings panels, providing clean, tactile, custom stepper buttons across all platforms.

---

### 📦 Artifacts Included
- **Linux**:
  - `termlet-linux-amd64.deb` (Debian, Ubuntu, Linux Mint, Pop!_OS)
  - `termlet-linux-amd64.rpm` (Fedora, RHEL, CentOS, openSUSE)
  - `termlet-linux-amd64.tar.gz` (Portable Linux archive)
- **Windows**:
  - `termlet-windows-amd64.zip` (Portable 64-bit Windows archive)
- **macOS**:
  - `termlet-darwin-universal.dmg` (Apple Silicon & Intel Universal DMG)
  - `termlet-darwin-universal.zip` (Portable macOS bundle)
