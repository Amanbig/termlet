import React, { useState } from 'react';
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
  Type,
  FileCode,
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (newPartial: Partial<AppSettings>) => void;
  onResetSettings: () => void;
  onClose: () => void;
}

const THEME_OPTIONS: { id: EditorTheme; label: string; previewBg: string; previewFg: string }[] = [
  { id: 'vscodeDark', label: 'VS Code Dark', previewBg: '#1e1e1e', previewFg: '#9cdcfe' },
  { id: 'tokyoNight', label: 'Tokyo Night', previewBg: '#1a1b26', previewFg: '#7aa2f7' },
  { id: 'dracula', label: 'Dracula', previewBg: '#282a36', previewFg: '#bd93f9' },
  { id: 'nord', label: 'Nord', previewBg: '#2e3440', previewFg: '#88c0d0' },
  { id: 'monokai', label: 'Monokai', previewBg: '#272822', previewFg: '#a6e22e' },
  { id: 'githubDark', label: 'GitHub Dark', previewBg: '#0d1117', previewFg: '#58a6ff' },
  { id: 'githubLight', label: 'GitHub Light', previewBg: '#ffffff', previewFg: '#0550ae' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetSettings,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<'all' | 'appearance' | 'editor' | 'ssh'>('all');

  const handleReset = () => {
    if (window.confirm('Reset all settings to default values?')) {
      onResetSettings();
      toast.success('Settings reset to default');
    }
  };

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

  const matchesSearch = (text: string) => {
    if (!searchQuery.trim()) return true;
    return text.toLowerCase().includes(searchQuery.toLowerCase());
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden select-none">
      {/* Top Header Bar */}
      <div className="px-8 py-5 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-blue-500" />
            <h1 className="text-lg font-bold tracking-tight">Settings</h1>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
            User Preferences, Interface Themes, and SSH Configuration
          </p>
        </div>

        <Button
          variant="ghost"
          size="icon"
          onClick={onClose}
          title="Close Settings (Esc)"
          className="h-8 w-8 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-md cursor-pointer"
        >
          <X className="w-4 h-4" />
        </Button>
      </div>

      {/* Search & Category Filter */}
      <div className="px-8 py-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/50 dark:bg-zinc-900/30 flex items-center gap-4">
        <div className="relative max-w-md w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
          <Input
            placeholder="Search settings (e.g. theme, font, wrap)..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-8 text-xs bg-white dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800"
          />
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveCategory('all')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              activeCategory === 'all'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveCategory('appearance')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              activeCategory === 'appearance'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            Appearance
          </button>
          <button
            onClick={() => setActiveCategory('editor')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              activeCategory === 'editor'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            Editor
          </button>
          <button
            onClick={() => setActiveCategory('ssh')}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors cursor-pointer ${
              activeCategory === 'ssh'
                ? 'bg-blue-600 text-white'
                : 'text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            SSH
          </button>
        </div>
      </div>

      {/* Main Settings Content Area */}
      <div className="flex-1 overflow-y-auto px-8 py-6 space-y-8 max-w-4xl">
        {/* --- 1. APPEARANCE SECTION --- */}
        {(activeCategory === 'all' || activeCategory === 'appearance') && matchesSearch('theme appearance dark light') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <Palette className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Appearance & Themes
              </h2>
            </div>

            {/* Interface Theme (Dark vs Light) */}
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-3">
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
            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-3">
              <div>
                <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                  Editor Syntax Theme
                </Label>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                  Choose the color theme for code syntax highlighting in CodeMirror
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2.5">
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
        {(activeCategory === 'all' || activeCategory === 'editor') && matchesSearch('editor font size tab wrap numbers') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <Sliders className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                Editor Configuration
              </h2>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-4">
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
                  <Input
                    type="number"
                    min={10}
                    max={28}
                    value={settings.fontSize}
                    onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) || 13 })}
                    className="w-20 h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800"
                  />
                  <span className="text-xs text-zinc-500">px</span>
                </div>
              </div>

              {/* Tab Size */}
              <div className="flex items-center justify-between border-t border-zinc-100 dark:border-zinc-800/60 pt-3">
                <div>
                  <Label className="text-xs font-semibold text-zinc-900 dark:text-zinc-200">
                    Tab Indentation Size
                  </Label>
                  <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                    Number of spaces per tab indentation
                  </p>
                </div>
                <select
                  value={settings.tabSize}
                  onChange={(e) => onUpdateSettings({ tabSize: Number(e.target.value) || 2 })}
                  className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-200 text-xs rounded px-2.5 py-1.5 h-8 focus:outline-none"
                >
                  <option value={2}>2 Spaces</option>
                  <option value={4}>4 Spaces</option>
                  <option value={8}>8 Spaces</option>
                </select>
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
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 cursor-pointer"
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
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 cursor-pointer"
                />
              </div>
            </div>
          </div>
        )}

        {/* --- 3. SSH & GENERAL SECTION --- */}
        {(activeCategory === 'all' || activeCategory === 'ssh') && matchesSearch('ssh port delete reset general') && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-zinc-200 dark:border-zinc-800">
              <Shield className="w-4 h-4 text-blue-500" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-zinc-700 dark:text-zinc-300">
                SSH & General Preferences
              </h2>
            </div>

            <div className="p-4 rounded-lg bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 shadow-xs space-y-4">
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
                  type="number"
                  min={1}
                  max={65535}
                  value={settings.defaultPort}
                  onChange={(e) => onUpdateSettings({ defaultPort: Number(e.target.value) || 22 })}
                  className="w-24 h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800"
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
                  className="w-4 h-4 rounded border-zinc-300 dark:border-zinc-700 text-blue-600 cursor-pointer"
                />
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
      </div>
    </div>
  );
};
