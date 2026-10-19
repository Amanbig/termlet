# Termlet v0.5.3 🚀

Termlet **v0.5.3** delivers an expanded, high-fidelity editor theme ecosystem with 14 syntax themes, polished theme-synchronized toast notifications with ergonomic top-right dismiss controls, alongside our production-grade error boundaries and streamlined automatic updater.

---

### ✨ What's New & Highlights

#### 🎨 Expanded Editor Theme Ecosystem (14 Themes)
- **7 New Curated Themes Added**:
  - **Atom One Dark**: Classic dark aesthetic with rich token contrasts.
  - **Sublime Text**: High-contrast, iconic Sublime color scheme.
  - **Material Dark**: Sleek, modern Material palette.
  - **Solarized Dark & Solarized Light**: Precision-calibrated color relationships designed to reduce eye strain.
  - **Xcode Dark & Xcode Light**: Native Apple IDE syntax coloring for dark and light environments.
- **Visual Preview Badges in Settings**:
  - Live color preview circles displaying background and accent token colors for each theme directly inside the Settings picker.
  - Full persistence across app sessions and workspace reloads.

#### 🔔 Polished Toast Notifications & Close Button Positioning
- **Ergonomic Top-Right Dismiss Placement**:
  - Fixed Sonner's default behavior where the close (`x`) button hovered awkwardly outside the card on the top-left edge.
  - The close button is now neatly embedded in the **top-right inside corner** of the toast card with comfortable padding (`pr-8`) preventing any overlap with long notification text.
- **Theme-Synchronized Styling**:
  - Integrated hover states (`bg-zinc-200/50` in light mode, `bg-white/10` in dark mode) and subtle border styling.
  - Semantic status colors (emerald success, rose error, amber warning, sky info) dynamically adapt to Termlet's UI theme mode.

#### 🛡️ Robust Fault-Tolerant Foundation (from v0.5.2)
- **Sectional `<ErrorBoundary>`**:
  - Isolates errors in side panels, explorer, editor, settings, and release notes without taking down the application.
  - Actionable crash recovery options: Reload View, Technical Stack Details, and Full Restart.
- **Centralized Error Parsing**:
  - Decodes Go, SSH, SFTP, and OS network errors into actionable guidance across 13 distinct categories.
- **Streamlined In-Settings Automatic Updater**:
  - Clean update management directly inside Settings without intrusive modals. Real-time download progress and 1-click restart to apply.

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
