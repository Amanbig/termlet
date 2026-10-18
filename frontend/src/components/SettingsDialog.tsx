import React from 'react';
import { AppSettings, EditorTheme } from '../types/settings';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import {
  Settings,
  Palette,
  Sliders,
  Shield,
  RotateCcw,
  Check,
  Moon,
  Sun,
  Type,
  FileCode,
} from 'lucide-react';
import { toast } from 'sonner';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: AppSettings;
  onUpdateSettings: (newPartial: Partial<AppSettings>) => void;
  onResetSettings: () => void;
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

export const SettingsDialog: React.FC<SettingsDialogProps> = ({
  open,
  onOpenChange,
  settings,
  onUpdateSettings,
  onResetSettings,
}) => {
  const handleReset = () => {
    if (window.confirm('Reset all settings to default values?')) {
      onResetSettings();
      toast.success('Settings reset to default');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] bg-zinc-950 border-zinc-800 text-zinc-100 max-h-[85vh] flex flex-col p-0">
        <DialogHeader className="p-6 pb-2 border-b border-zinc-800/80">
          <DialogTitle className="flex items-center gap-2 text-zinc-100 text-base">
            <Settings className="w-5 h-5 text-blue-500" />
            Settings
          </DialogTitle>
          <DialogDescription className="text-zinc-400 text-xs">
            Customize editor appearance, themes, font settings, and SSH defaults.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-6 pt-3">
          <Tabs defaultValue="appearance" className="w-full">
            <TabsList className="grid grid-cols-3 bg-zinc-900 h-9 p-0.5 border border-zinc-800 mb-6">
              <TabsTrigger value="appearance" className="text-xs h-8 flex items-center gap-1.5">
                <Palette className="w-3.5 h-3.5" /> Appearance
              </TabsTrigger>
              <TabsTrigger value="editor" className="text-xs h-8 flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5" /> Editor
              </TabsTrigger>
              <TabsTrigger value="ssh" className="text-xs h-8 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5" /> SSH & General
              </TabsTrigger>
            </TabsList>

            {/* --- 1. Appearance Tab --- */}
            <TabsContent value="appearance" className="space-y-6">
              {/* Editor Theme Palette Selector */}
              <div className="space-y-3">
                <Label className="text-xs font-semibold text-zinc-300">Editor Syntax Theme</Label>
                <div className="grid grid-cols-2 gap-2.5">
                  {THEME_OPTIONS.map((theme) => {
                    const isSelected = settings.editorTheme === theme.id;
                    return (
                      <button
                        key={theme.id}
                        onClick={() => onUpdateSettings({ editorTheme: theme.id })}
                        className={`flex items-center justify-between p-2.5 rounded-md border text-left cursor-pointer transition-all ${
                          isSelected
                            ? 'bg-blue-950/40 border-blue-500 text-blue-100 ring-1 ring-blue-500/50'
                            : 'bg-zinc-900/60 border-zinc-800 hover:border-zinc-700 text-zinc-300'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span
                            className="w-4 h-4 rounded-full border border-zinc-700 shrink-0"
                            style={{ backgroundColor: theme.previewBg }}
                          />
                          <span className="text-xs font-medium">{theme.label}</span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* UI Theme: Dark vs Light */}
              <div className="space-y-2 pt-2 border-t border-zinc-800/80">
                <Label className="text-xs font-semibold text-zinc-300">Interface Theme</Label>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onUpdateSettings({ uiTheme: 'dark' })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs cursor-pointer ${
                      settings.uiTheme === 'dark'
                        ? 'bg-zinc-800 border-zinc-600 text-white font-medium'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Moon className="w-3.5 h-3.5" /> Dark Mode
                  </button>
                  <button
                    onClick={() => onUpdateSettings({ uiTheme: 'light' })}
                    className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs cursor-pointer ${
                      settings.uiTheme === 'light'
                        ? 'bg-zinc-100 border-zinc-300 text-zinc-900 font-medium'
                        : 'bg-zinc-900/40 border-zinc-800 text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5" /> Light Mode
                  </button>
                </div>
              </div>
            </TabsContent>

            {/* --- 2. Editor Tab --- */}
            <TabsContent value="editor" className="space-y-5">
              {/* Font Size */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-zinc-300">Font Size</Label>
                  <p className="text-[11px] text-zinc-500">Controls the font size of the code editor</p>
                </div>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={10}
                    max={28}
                    value={settings.fontSize}
                    onChange={(e) => onUpdateSettings({ fontSize: Number(e.target.value) || 13 })}
                    className="w-20 h-8 text-xs bg-zinc-900 border-zinc-800"
                  />
                  <span className="text-xs text-zinc-500">px</span>
                </div>
              </div>

              {/* Tab Size */}
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
                <div>
                  <Label className="text-xs font-semibold text-zinc-300">Tab Size</Label>
                  <p className="text-[11px] text-zinc-500">Number of spaces per indentation</p>
                </div>
                <select
                  value={settings.tabSize}
                  onChange={(e) => onUpdateSettings({ tabSize: Number(e.target.value) || 2 })}
                  className="bg-zinc-900 border border-zinc-800 text-zinc-200 text-xs rounded px-2.5 py-1.5 h-8 focus:outline-none focus:border-zinc-700"
                >
                  <option value={2}>2 Spaces</option>
                  <option value={4}>4 Spaces</option>
                  <option value={8}>8 Spaces</option>
                </select>
              </div>

              {/* Line Numbers Toggle */}
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
                <div>
                  <Label className="text-xs font-semibold text-zinc-300">Line Numbers</Label>
                  <p className="text-[11px] text-zinc-500">Display line numbers in editor gutter</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.lineNumbers}
                  onChange={(e) => onUpdateSettings({ lineNumbers: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-500 cursor-pointer"
                />
              </div>

              {/* Word Wrap Toggle */}
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
                <div>
                  <Label className="text-xs font-semibold text-zinc-300">Word Wrap</Label>
                  <p className="text-[11px] text-zinc-500">Wrap long lines to fit the viewport</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.wordWrap}
                  onChange={(e) => onUpdateSettings({ wordWrap: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-500 cursor-pointer"
                />
              </div>
            </TabsContent>

            {/* --- 3. SSH & General Tab --- */}
            <TabsContent value="ssh" className="space-y-5">
              {/* Default SSH Port */}
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold text-zinc-300">Default SSH Port</Label>
                  <p className="text-[11px] text-zinc-500">Standard port used when adding new servers</p>
                </div>
                <Input
                  type="number"
                  min={1}
                  max={65535}
                  value={settings.defaultPort}
                  onChange={(e) => onUpdateSettings({ defaultPort: Number(e.target.value) || 22 })}
                  className="w-24 h-8 text-xs bg-zinc-900 border-zinc-800"
                />
              </div>

              {/* Confirm Delete */}
              <div className="flex items-center justify-between border-t border-zinc-800/80 pt-4">
                <div>
                  <Label className="text-xs font-semibold text-zinc-300">Confirm File Deletion</Label>
                  <p className="text-[11px] text-zinc-500">Prompt confirmation dialog before deleting remote files</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.confirmDelete}
                  onChange={(e) => onUpdateSettings({ confirmDelete: e.target.checked })}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-900 text-blue-500 cursor-pointer"
                />
              </div>

              {/* Reset All Settings Button */}
              <div className="border-t border-zinc-800/80 pt-5">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 text-xs text-rose-400 border-rose-900/60 hover:bg-rose-950/30 flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset All to Defaults
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="p-4 border-t border-zinc-800/80 bg-zinc-950/80">
          <Button
            onClick={() => onOpenChange(false)}
            className="bg-blue-600 hover:bg-blue-500 text-xs h-8 px-4"
          >
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
