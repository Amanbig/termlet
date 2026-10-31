import React, { useState, useEffect } from 'react';
import { AppSettings, EditorTheme } from '../types/settings';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  Settings,
  Palette,
  Sliders,
  Shield,
  RotateCcw,
  Check,
  Moon,
  Sun,
  Search,
  X,
  RefreshCw,
  ExternalLink,
  Info,
  Download,
  Minus,
  Plus,
  Sparkles,
  Loader2,
  ShieldCheck,
  Trash2,
  Copy,
  KeyRound,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  CheckForUpdates,
  GetAppVersion,
  DownloadAndApplyUpdate,
  GetUpdateProgress,
  RestartApp,
  GetKnownHosts,
  RemoveKnownHostByLine,
  ClearKnownHosts,
} from '../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { updater, models } from '../../wailsjs/go/models';
import { useConfirm } from '../context/ConfirmContext';
import logoImg from '../assets/images/logo.png';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newPartial: Partial<AppSettings>) => void;
  onResetSettings: () => void;
  onClose: () => void;
  onOpenReleaseNotes?: () => void;
  onOpenKnownHosts?: () => void;
  onOpenSSHKeys?: () => void;
  updateInfo?: updater.UpdateInfo | null;
  onUpdateInfoChange?: (info: updater.UpdateInfo | null) => void;
  isCheckingUpdates?: boolean;
}

const THEME_OPTIONS: { id: EditorTheme; label: string; previewBg: string; previewFg: string }[] = [
  { id: 'vscodeDark', label: 'VS Code Dark', previewBg: '#1e1e1e', previewFg: '#9cdcfe' },
  { id: 'tokyoNight', label: 'Tokyo Night', previewBg: '#1a1b26', previewFg: '#7aa2f7' },
  { id: 'dracula', label: 'Dracula', previewBg: '#282a36', previewFg: '#bd93f9' },
  { id: 'nord', label: 'Nord', previewBg: '#2e3440', previewFg: '#88c0d0' },
  { id: 'monokai', label: 'Monokai', previewBg: '#272822', previewFg: '#a6e22e' },
  { id: 'atomone', label: 'Atom One Dark', previewBg: '#272c35', previewFg: '#9d9b97' },
  { id: 'materialDark', label: 'Material Dark', previewBg: '#2e3235', previewFg: '#bdbdbd' },
  { id: 'sublime', label: 'Sublime', previewBg: '#303841', previewFg: '#ffffff' },
  { id: 'solarizedDark', label: 'Solarized Dark', previewBg: '#002b36', previewFg: '#839496' },
  { id: 'solarizedLight', label: 'Solarized Light', previewBg: '#fdf6e3', previewFg: '#657b83' },
  { id: 'githubDark', label: 'GitHub Dark', previewBg: '#0d1117', previewFg: '#58a6ff' },
  { id: 'githubLight', label: 'GitHub Light', previewBg: '#ffffff', previewFg: '#0550ae' },
  { id: 'xcodeDark', label: 'Xcode Dark', previewBg: '#292a30', previewFg: '#cecfd0' },
  { id: 'xcodeLight', label: 'Xcode Light', previewBg: '#ffffff', previewFg: '#3d3d3d' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onClose,
  onOpenReleaseNotes,
  onOpenKnownHosts,
  onOpenSSHKeys,
  updateInfo: propUpdateInfo,
  onUpdateInfoChange,
  isCheckingUpdates: propIsChecking,
}) => {
  const confirm = useConfirm();
  const [searchQuery, setSearchQuery] = useState('');
  const [appVersion, setAppVersion] = useState('0.9.4');
  const [localCheckingUpdates, setLocalCheckingUpdates] = useState(false);
  const [localUpdateInfo, setLocalUpdateInfo] = useState<updater.UpdateInfo | null>(null);
  const [hasCheckedUpdates, setHasCheckedUpdates] = useState(false);

  // In-app update installation state
  const [installState, setInstallState] = useState<
    'idle' | 'downloading' | 'extracting' | 'applying' | 'ready' | 'error'
  >('idle');
  const [progress, setProgress] = useState(0);
  const [progressInfo, setProgressInfo] = useState({ readBytes: 0, totalBytes: 0 });
  const [installError, setInstallError] = useState('');
  const [isRestarting, setIsRestarting] = useState(false);

  const activeUpdateInfo = propUpdateInfo || localUpdateInfo;
  const isChecking = propIsChecking !== undefined ? propIsChecking : localCheckingUpdates;

  useEffect(() => {
    GetAppVersion()
      .then((v) => {
        if (v) setAppVersion(v);
      })
      .catch(() => {});
  }, []);

  // Poll update progress when installing
  useEffect(() => {
    let timer: any;
    if (
      installState === 'downloading' ||
      installState === 'extracting' ||
      installState === 'applying'
    ) {
      timer = setInterval(async () => {
        try {
          const res = await GetUpdateProgress();
          if (res) {
            setProgress(res.percentage || 0);
            setProgressInfo({
              readBytes: res.readBytes || 0,
              totalBytes: res.totalBytes || 0,
            });
            if (res.status === 'ready') {
              setInstallState('ready');
            } else if (res.status === 'error') {
              setInstallState('error');
              setInstallError(res.error || 'Update failed');
            } else if (res.status && res.status !== 'idle') {
              setInstallState(
                res.status as 'downloading' | 'extracting' | 'applying' | 'ready' | 'error'
              );
            }
          }
        } catch (e) {
          console.warn('Failed to poll update progress:', e);
        }
      }, 500);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [installState]);

  const handleReset = async () => {
    const ok = await confirm({
      title: 'Reset Settings',
      description: 'Are you sure you want to restore all settings to their default values?',
      confirmText: 'Reset Defaults',
      variant: 'destructive',
    });
    if (ok) {
      onResetSettings();
      toast.success('Settings reset to default');
    }
  };

  // Known Hosts Count for SSH Configuration card
  const [knownHostsCount, setKnownHostsCount] = useState<number>(0);

  useEffect(() => {
    GetKnownHosts()
      .then((list) => {
        if (list) setKnownHostsCount(list.length);
      })
      .catch(() => {});
  }, []);

  const handleUiThemeChange = (mode: 'dark' | 'light') => {
    // If switching to light mode and current theme is dark, suggest/set githubLight
    const newPartial: Partial<AppSettings> = { uiTheme: mode };
    if (mode === 'light' && settings.editorTheme !== 'githubLight') {
      newPartial.editorTheme = 'githubLight';
    } else if (mode === 'dark' && settings.editorTheme === 'githubLight') {
      newPartial.editorTheme = 'vscodeDark';
    }
    onUpdateSettings(newPartial);
  };

  const handleCheckUpdates = async () => {
    setLocalCheckingUpdates(true);
    try {
      const info = await CheckForUpdates();
      setLocalUpdateInfo(info);
      setHasCheckedUpdates(true);
      if (onUpdateInfoChange) {
        onUpdateInfoChange(info);
      }
      if (info?.available) {
        const ver = String(info.latestVersion || info.latest_version || '').replace(/^v/, '');
        toast.info(`Version ${ver} is available!`);
      } else {
        toast.success('Termlet is up to date!');
      }
    } catch (err: any) {
      toast.error(`Update check failed: ${err?.message || err}`);
    } finally {
      setLocalCheckingUpdates(false);
    }
  };

  const handleStartInstall = async () => {
    const targetUrl = activeUpdateInfo?.downloadUrl;
    const targetFile = activeUpdateInfo?.assetFileName;

    if (!targetUrl || !targetFile) {
      const fallbackUrl = activeUpdateInfo?.releaseUrl || 'https://github.com/Amanbig/termlet/releases';
      BrowserOpenURL(fallbackUrl);
      return;
    }

    setInstallState('downloading');
    setProgress(0);
    setInstallError('');

    try {
      DownloadAndApplyUpdate(targetUrl, targetFile)
        .then(() => {
          setInstallState('ready');
          toast.success('Update installed! Restart to apply.');
        })
        .catch((err) => {
          setInstallState('error');
          setInstallError(String(err));
          toast.error(`Update failed: ${err}`);
        });
    } catch (err: any) {
      setInstallState('error');
      setInstallError(String(err));
      toast.error(`Update failed: ${err}`);
    }
  };

  const handleRestartNow = async () => {
    setIsRestarting(true);
    try {
      await RestartApp();
    } catch (err) {
      setIsRestarting(false);
      setInstallError(`Failed to restart: ${err}`);
      setInstallState('error');
    }
  };

  const handleOpenExternal = (url: string) => {
    if (url) {
      BrowserOpenURL(url);
    }
  };

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  const showAppearance = matchesSearch('theme appearance dark light mode syntax editor ui');
  const showEditor = matchesSearch('editor font size tab indentation wrap line numbers');
  const showSsh = matchesSearch('ssh port delete confirm reset general preferences known hosts security fingerprint');
  const showAbout = matchesSearch('about version update release license repository termlet info');
  const hasMatches = showAppearance || showEditor || showSsh || showAbout;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden select-none">
      {/* Top Header Bar & Centered Search with Equal Width on Both Sides */}
      <div className="px-6 sm:px-8 lg:px-12 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950">
        <div className="w-full max-w-5xl mx-auto space-y-4">
          <div>
            <div className="flex items-center gap-2">
              <Settings className="w-5 h-5 text-blue-500" />
              <h1 className="text-lg font-bold tracking-tight">Settings</h1>
            </div>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
              User Preferences, Interface Themes, and SSH Configuration
            </p>
          </div>

          {/* Centered Search Bar with equal margins/width on left and right */}
          <div className="flex justify-center w-full">
            <div className="relative w-full max-w-2xl">
              <Search className="w-4 h-4 absolute left-3.5 top-2.5 text-zinc-400" />
              <Input
                placeholder="Search settings (e.g. theme, font, wrap, port, update)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-9 h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-1 focus:ring-blue-500 w-full shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Main Settings Content Area - Balanced layout for large screens */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 lg:px-12 py-6">
        <div className="w-full max-w-5xl mx-auto space-y-8 pb-12">
          {/* Empty search state */}
          {!hasMatches && (
            <div className="text-center py-16 space-y-3">
              <Search className="w-8 h-8 mx-auto text-zinc-400/80" />
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                No settings found matching <span className="font-semibold text-zinc-900 dark:text-zinc-200">"{searchQuery}"</span>
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSearchQuery('')}
                className="text-xs h-8 cursor-pointer border-zinc-300 dark:border-zinc-700"
              >
                Clear Search
              </Button>
            </div>
          )}

          {/* --- 1. APPEARANCE SECTION --- */}
          {showAppearance && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <Palette className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Appearance &amp; Themes
                </h2>
              </div>

              {/* Interface Theme (Dark vs Light) */}
              <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                    Interface Theme Mode
                  </Label>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Select the application-wide theme mode (applies to workspace, activity bar, sidebar, and status bar)
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => handleUiThemeChange('dark')}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                      settings.uiTheme === 'dark'
                        ? 'bg-zinc-900 dark:bg-zinc-800 border-zinc-700 text-white ring-2 ring-blue-500/50'
                        : 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                    }`}
                  >
                    <Moon className="w-4 h-4 text-amber-400" />
                    <span>Dark Mode</span>
                    {settings.uiTheme === 'dark' && <Check className="w-3.5 h-3.5 ml-1 text-blue-400" />}
                  </button>

                  <button
                    onClick={() => handleUiThemeChange('light')}
                    className={`flex items-center gap-2.5 px-4 py-2.5 rounded-md border text-xs font-medium cursor-pointer transition-all ${
                      settings.uiTheme === 'light'
                        ? 'bg-white border-zinc-400 text-zinc-900 ring-2 ring-blue-500/50 shadow-sm'
                        : 'bg-zinc-100 dark:bg-zinc-900/50 border-zinc-300 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-400'
                    }`}
                  >
                    <Sun className="w-4 h-4 text-amber-500" />
                    <span>Light Mode</span>
                    {settings.uiTheme === 'light' && <Check className="w-3.5 h-3.5 ml-1 text-blue-600" />}
                  </button>
                </div>
              </div>

              {/* Editor Syntax Theme */}
              <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-3">
                <div>
                  <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                    Editor Syntax Theme
                  </Label>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Choose the color theme for code syntax highlighting in CodeMirror
                  </p>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {THEME_OPTIONS.map((theme) => {
                    const isSelected = settings.editorTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => onUpdateSettings({ editorTheme: theme.id })}
                        className={`flex items-center justify-between p-3 rounded-md border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-500 text-blue-900 dark:text-blue-100 ring-1 ring-blue-500/50'
                            : 'bg-zinc-50 dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 text-zinc-800 dark:text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full border border-zinc-300 dark:border-zinc-700 shrink-0 shadow-xs"
                            style={{ backgroundColor: theme.previewBg }}
                          />
                          <span className="text-xs font-medium">{theme.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* --- 2. EDITOR SECTION --- */}
          {showEditor && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <Sliders className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  Editor Configuration
                </h2>
              </div>

              <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-4">
                {/* Font Size */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      Font Size
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Editor text size in pixels
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex items-center bg-zinc-100 dark:bg-zinc-800 rounded-md border border-zinc-300 dark:border-zinc-700 overflow-hidden shadow-2xs">
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ fontSize: Math.max(10, settings.fontSize - 1) })}
                        className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        title="Decrease font size"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={settings.fontSize}
                        onChange={(e) => {
                          const val = e.target.value.replace(/\D/g, '');
                          const num = parseInt(val, 10);
                          onUpdateSettings({ fontSize: isNaN(num) ? 0 : Math.min(36, num) });
                        }}
                        onBlur={() => {
                          if (!settings.fontSize || settings.fontSize < 8) {
                            onUpdateSettings({ fontSize: 13 });
                          }
                        }}
                        className="w-12 h-8 text-center font-mono text-xs font-semibold bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border-x border-zinc-300 dark:border-zinc-700 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => onUpdateSettings({ fontSize: Math.min(32, settings.fontSize + 1) })}
                        className="w-8 h-8 flex items-center justify-center text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 transition-colors cursor-pointer"
                        title="Increase font size"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <span className="text-xs text-zinc-500 font-medium">px</span>
                  </div>
                </div>

                {/* Tab Size - Modern segmented pill controls */}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      Tab Indentation Size
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Number of spaces per tab indentation
                    </p>
                  </div>
                  <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-800/80 p-1 rounded-md border border-zinc-200 dark:border-zinc-700/80">
                    {[2, 4, 8].map((size) => (
                      <button
                        key={size}
                        type="button"
                        onClick={() => onUpdateSettings({ tabSize: size })}
                        className={`px-3 py-1 text-xs font-medium rounded transition-all cursor-pointer ${
                          settings.tabSize === size
                            ? 'bg-blue-600 text-white shadow-xs'
                            : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-700/50'
                        }`}
                      >
                        {size} Spaces
                      </button>
                    ))}
                  </div>
                </div>

                {/* Line Numbers */}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      Show Line Numbers
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Display line numbers in editor gutter
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.lineNumbers}
                    onChange={(e) => onUpdateSettings({ lineNumbers: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* Word Wrap */}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      Word Wrap
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Wrap lines exceeding editor width
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.wordWrap}
                    onChange={(e) => onUpdateSettings({ wordWrap: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-blue-600 cursor-pointer"
                  />
                </div>
              </div>
            </div>
          )}

          {/* --- 3. SSH & GENERAL SECTION --- */}
          {showSsh && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <Shield className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  SSH &amp; General Preferences
                </h2>
              </div>

              <div className="p-4 sm:p-5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-4">
                {/* Default SSH Port */}
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      Default SSH Port
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Port pre-filled when creating new connection profiles
                    </p>
                  </div>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={settings.defaultPort}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, '');
                      const num = parseInt(val, 10);
                      onUpdateSettings({ defaultPort: isNaN(num) ? 0 : Math.min(65535, num) });
                    }}
                    onBlur={() => {
                      if (!settings.defaultPort || settings.defaultPort < 1) {
                        onUpdateSettings({ defaultPort: 22 });
                      }
                    }}
                    className="w-24 sm:w-28 h-8 text-center font-mono text-xs bg-zinc-50 dark:bg-zinc-800/90 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-md focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                {/* Confirm Delete */}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      Confirm Remote Deletion
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Prompt confirmation dialog before deleting files or directories on remote server
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.confirmDelete}
                    onChange={(e) => onUpdateSettings({ confirmDelete: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* Multi-Window for Multiple Connections */}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      Open Connections in Separate Windows
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      When already connected, connecting to another profile automatically opens in a new native window
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.openNewWindowForMultipleConnections ?? false}
                    onChange={(e) => onUpdateSettings({ openNewWindowForMultipleConnections: e.target.checked })}
                    className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 accent-blue-600 cursor-pointer"
                  />
                </div>

                {/* SSH Host Keys & Security */}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      SSH Known Hosts &amp; Security
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Inspect and manage trusted host keys, cryptographic fingerprints, and revocation ({knownHostsCount} recorded)
                    </p>
                  </div>
                  {onOpenKnownHosts && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onOpenKnownHosts}
                      className="h-8 text-xs text-emerald-600 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/60 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 flex items-center gap-1.5 cursor-pointer shadow-2xs font-medium"
                    >
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Manage Known Hosts</span>
                      <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                    </Button>
                  )}
                </div>

                {/* SSH Key Pairs & Generator */}
                <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                  <div>
                    <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                      SSH Key Pairs &amp; Identity
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Generate modern Ed25519/RSA keys, copy public keys, and inspect local key pairs in ~/.ssh/
                    </p>
                  </div>
                  {onOpenSSHKeys && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onOpenSSHKeys}
                      className="h-8 text-xs text-blue-600 dark:text-blue-400 border-blue-300 dark:border-blue-800/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1.5 cursor-pointer shadow-2xs font-medium"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>SSH Key Manager</span>
                      <ExternalLink className="w-3 h-3 ml-0.5 opacity-70" />
                    </Button>
                  )}
                </div>

                {/* Reset to Defaults */}
                <div className="border-t border-zinc-100 dark:border-zinc-800/60 pt-4 flex items-center justify-between">
                  <div>
                    <Label className="text-xs font-semibold text-rose-600 dark:text-rose-400">
                      Reset Settings
                    </Label>
                    <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                      Revert all configuration values to initial factory defaults
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleReset}
                    className="h-8 text-xs text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-1.5 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reset All
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* --- 4. ABOUT & UPDATES SECTION --- */}
          {showAbout && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <Info className="w-4 h-4 text-blue-500" />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                  About &amp; Updates
                </h2>
              </div>

              <div className="p-5 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <img
                      src={logoImg}
                      alt="Termlet Logo"
                      className="w-12 h-12 rounded-xl object-contain shadow-xs border border-zinc-200 dark:border-zinc-800"
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-base font-bold text-zinc-900 dark:text-zinc-100">Termlet Desktop</h3>
                        <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono text-[11px] font-semibold">
                          v{appVersion.replace(/^v/, '')}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                        Modern SSH Remote Workspace &amp; Fast Code Editor
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 self-start sm:self-auto">
                    {onOpenReleaseNotes && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={onOpenReleaseNotes}
                        className="h-8 text-xs flex items-center gap-1.5 cursor-pointer border-zinc-300 dark:border-zinc-700 hover:text-blue-600 dark:hover:text-blue-400"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-blue-500" />
                        <span>Release Notes</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleCheckUpdates}
                      disabled={isChecking}
                      className="h-8 text-xs flex items-center gap-1.5 cursor-pointer border-zinc-300 dark:border-zinc-700"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${isChecking ? 'animate-spin text-blue-500' : ''}`} />
                      <span>{isChecking ? 'Checking for Updates...' : 'Check for Updates'}</span>
                    </Button>
                  </div>
                </div>

                {/* Update Status Feedback */}
                {activeUpdateInfo?.available ? (
                  <div className="p-4 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900/60 space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                          <Sparkles className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                              Update Available: v{String(activeUpdateInfo.latestVersion || activeUpdateInfo.latest_version).replace(/^v/, '')}
                            </h4>
                            {activeUpdateInfo.installType && (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                                {activeUpdateInfo.installType}
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                            Installed: v{appVersion.replace(/^v/, '')} &bull;{' '}
                            {activeUpdateInfo.installType === 'snap'
                              ? 'Snap Store updates automatically in the background'
                              : 'Latest release ready to install'}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {activeUpdateInfo.installType === 'snap' ? (
                          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/60 text-xs text-blue-700 dark:text-blue-300">
                            <span>Managed by Snap Store &bull; run</span>
                            <code className="font-mono font-semibold bg-white dark:bg-zinc-900 px-1 py-0.5 rounded border border-blue-200 dark:border-blue-800 text-[11px]">
                              snap refresh termlet
                            </code>
                          </div>
                        ) : installState === 'ready' ? (
                          <Button
                            size="sm"
                            onClick={handleRestartNow}
                            disabled={isRestarting}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8 px-3 gap-1.5 cursor-pointer shadow-xs"
                          >
                            <RotateCcw className={`w-3.5 h-3.5 ${isRestarting ? 'animate-spin' : ''}`} />
                            <span>{isRestarting ? 'Restarting...' : 'Restart to Apply'}</span>
                          </Button>
                        ) : installState === 'downloading' ||
                          installState === 'extracting' ||
                          installState === 'applying' ? (
                          <Button
                            size="sm"
                            disabled
                            className="bg-blue-600 text-white text-xs h-8 px-3 gap-1.5 opacity-90 cursor-wait"
                          >
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>
                              {installState === 'downloading'
                                ? `Downloading (${progress}%)`
                                : installState === 'extracting'
                                ? 'Extracting package...'
                                : 'Applying update...'}
                            </span>
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            onClick={handleStartInstall}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3 gap-1.5 cursor-pointer shadow-xs font-semibold"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Install Update</span>
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            if (onOpenReleaseNotes) {
                              onOpenReleaseNotes();
                            } else if (activeUpdateInfo.releaseUrl) {
                              handleOpenExternal(activeUpdateInfo.releaseUrl);
                            }
                          }}
                          className="h-8 text-xs cursor-pointer border-zinc-300 dark:border-zinc-700"
                        >
                          <ExternalLink className="w-3.5 h-3.5 mr-1" />
                          <span>Release Notes</span>
                        </Button>
                      </div>
                    </div>

                    {/* Progress Bar when installing */}
                    {(installState === 'downloading' ||
                      installState === 'extracting' ||
                      installState === 'applying') && (
                      <div className="space-y-1.5 pt-1">
                        <div className="w-full h-2 rounded-full bg-zinc-200 dark:bg-zinc-800 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 transition-all duration-300 ease-out"
                            style={{ width: `${Math.max(progress, 5)}%` }}
                          />
                        </div>
                        <div className="flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                          <span>
                            {installState === 'downloading'
                              ? 'Downloading target package...'
                              : installState === 'extracting'
                              ? 'Extracting archive payload...'
                              : 'Running package manager installation...'}
                          </span>
                          <span>
                            {progressInfo.totalBytes > 0
                              ? `${(progressInfo.readBytes / (1024 * 1024)).toFixed(1)} / ${(
                                  progressInfo.totalBytes /
                                  (1024 * 1024)
                                ).toFixed(1)} MB (${progress}%)`
                              : `${progress}%`}
                          </span>
                        </div>
                      </div>
                    )}

                    {/* Error Banner if install failed */}
                    {installState === 'error' && (
                      <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-xs text-rose-700 dark:text-rose-300 flex items-center justify-between">
                        <span>Installation failed: {installError}</span>
                        <button
                          type="button"
                          onClick={handleStartInstall}
                          className="text-xs font-semibold underline hover:text-rose-800 cursor-pointer ml-2"
                        >
                          Retry
                        </button>
                      </div>
                    )}

                    {/* Release Notes Excerpt */}
                    {(activeUpdateInfo.releaseNotes || activeUpdateInfo.release_notes) &&
                      installState === 'idle' && (
                        <p className="text-[11px] text-zinc-600 dark:text-zinc-300 line-clamp-3 whitespace-pre-line font-mono bg-white/70 dark:bg-black/30 p-2.5 rounded-lg border border-blue-100 dark:border-blue-900/40">
                          {activeUpdateInfo.releaseNotes || activeUpdateInfo.release_notes}
                        </p>
                      )}
                  </div>
                ) : hasCheckedUpdates && !activeUpdateInfo?.available ? (
                  <div className="p-3.5 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 flex items-center gap-2.5 text-xs text-emerald-800 dark:text-emerald-300">
                    <Check className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                    <span className="font-medium">
                      You are running the latest official release of Termlet (v{appVersion.replace(/^v/, '')}){activeUpdateInfo?.installType === 'snap' ? ' (Snap package)' : ''}.
                    </span>
                  </div>
                ) : null}

                {/* Meta & System Information */}
                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-800/60 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-zinc-600 dark:text-zinc-400">
                  <div className="flex items-center justify-between pr-4">
                    <span>Application ID:</span>
                    <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-300">com.termlet.desktop</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>Architecture:</span>
                    <span className="font-mono text-[11px] text-zinc-800 dark:text-zinc-300">
                      {navigator.userAgent.toLowerCase().includes('arm') || navigator.userAgent.toLowerCase().includes('aarch64')
                        ? 'arm64'
                        : 'x86_64'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between pr-4">
                    <span>License:</span>
                    <button
                      type="button"
                      onClick={() => handleOpenExternal('https://github.com/Amanbig/termlet/blob/main/LICENSE')}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <span>Apache-2.0</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                  <div className="flex items-center justify-between">
                    <span>GitHub Repository:</span>
                    <button
                      type="button"
                      onClick={() => handleOpenExternal('https://github.com/Amanbig/termlet')}
                      className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline cursor-pointer"
                    >
                      <span>Amanbig/termlet</span>
                      <ExternalLink className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
