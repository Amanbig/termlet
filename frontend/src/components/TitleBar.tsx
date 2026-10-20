import React, { useState, useEffect } from 'react';
import { Minus, Square, X, Server, Terminal, Settings as SettingsIcon, Search } from 'lucide-react';
import {
  WindowMinimise,
  WindowToggleMaximise,
  WindowIsMaximised,
  Quit,
} from '../../wailsjs/runtime/runtime';
import { SessionSummary } from '../types/remote';
import logoImg from '../assets/images/logo.png';

interface TitleBarProps {
  currentSession: SessionSummary | null;
  activeFilePath: string | null;
  isSettingsOpen: boolean;
  onOpenSettings: () => void;
  onNewConnection: () => void;
  onOpenProfiles: () => void;
  onQuickOpen?: () => void;
}

function RestoreIcon({ className = 'w-3 h-3' }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M4.5 4.5V2.5A1 1 0 015.5 1.5H13.5A1 1 0 0114.5 2.5V10.5A1 1 0 0113.5 11.5H11.5" />
      <rect x="1.5" y="4.5" width="10" height="10" rx="1" />
    </svg>
  );
}

export const TitleBar: React.FC<TitleBarProps> = ({
  currentSession,
  activeFilePath,
  isSettingsOpen,
  onOpenSettings,
  onNewConnection,
  onOpenProfiles,
  onQuickOpen,
}) => {
  const [isMaximised, setIsMaximised] = useState(false);

  useEffect(() => {
    // Check initial window maximize state if supported
    if (typeof WindowIsMaximised === 'function') {
      WindowIsMaximised().then(setIsMaximised).catch(() => {});
    }
  }, []);

  const handleMinimise = () => {
    if (typeof WindowMinimise === 'function') {
      WindowMinimise();
    } else if ((window as any).runtime?.WindowMinimise) {
      (window as any).runtime.WindowMinimise();
    }
  };

  const handleToggleMaximise = () => {
    if (typeof WindowToggleMaximise === 'function') {
      WindowToggleMaximise();
      if (typeof WindowIsMaximised === 'function') {
        setTimeout(() => {
          WindowIsMaximised().then(setIsMaximised).catch(() => {});
        }, 80);
      }
    } else if ((window as any).runtime?.WindowToggleMaximise) {
      (window as any).runtime.WindowToggleMaximise();
    }
  };

  const handleClose = () => {
    if (typeof Quit === 'function') {
      Quit();
    } else if ((window as any).runtime?.Quit) {
      (window as any).runtime.Quit();
    }
  };

  const getActiveTitle = () => {
    if (activeFilePath === 'termlet://release-notes') {
      return 'Release Notes — Termlet';
    }
    if (activeFilePath === 'termlet://settings' || isSettingsOpen) {
      return 'Settings — Termlet';
    }
    if (activeFilePath) {
      const fileName = activeFilePath.split('/').pop() || activeFilePath;
      const hostLabel = currentSession ? ` [${currentSession.profile_name || currentSession.host}]` : '';
      return `${fileName}${hostLabel} — Termlet`;
    }
    if (currentSession) {
      return `${currentSession.profile_name || currentSession.host} (${currentSession.username}@${currentSession.host}:${currentSession.port}) — Termlet`;
    }
    return 'Termlet — SSH Remote Workspace';
  };

  return (
    <header
      onDoubleClick={handleToggleMaximise}
      className="wails-drag h-9 w-full flex items-center justify-between select-none shrink-0 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/90 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 text-xs font-sans cursor-default z-40"
    >
      {/* Left: App Branding & Status */}
      <div className="flex items-center gap-2 pl-3 shrink-0 wails-no-drag">
        <img
          src={logoImg}
          alt="Termlet"
          className="w-4 h-4 rounded object-contain shrink-0"
        />
        <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 tracking-tight">
          Termlet
        </span>

        {currentSession ? (
          <button
            type="button"
            onClick={onOpenProfiles}
            title={
              currentSession.status === 'dropped' || !currentSession.is_alive
                ? `Connection lost to ${currentSession.host}:${currentSession.port}. Click to inspect or reconnect.`
                : `Connected to ${currentSession.host}:${currentSession.port} as ${currentSession.username}`
            }
            className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[11px] font-mono transition-colors cursor-pointer ml-1 ${
              currentSession.status === 'dropped' || !currentSession.is_alive
                ? 'bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                currentSession.status === 'dropped' || !currentSession.is_alive
                  ? 'bg-amber-500 animate-ping'
                  : 'bg-emerald-500 animate-pulse'
              }`}
            />
            <span className="truncate max-w-[150px] sm:max-w-[200px]">
              {currentSession.profile_name || currentSession.host}
            </span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onNewConnection}
            title="Create new SSH connection"
            className="hidden sm:flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-200/80 dark:bg-zinc-800/70 hover:bg-zinc-300 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400 text-[11px] transition-colors cursor-pointer ml-1"
          >
            <Server className="w-3 h-3" />
            <span>Connect</span>
          </button>
        )}
      </div>

      {/* Center: Window Title / Context Search Bar */}
      <div className="flex-1 h-full flex items-center justify-center px-4 overflow-hidden">
        {currentSession && onQuickOpen ? (
          <button
            type="button"
            onClick={onQuickOpen}
            title="Quick Open File (Ctrl+P / Cmd+P)"
            className="wails-no-drag flex items-center gap-2 px-3 py-1 rounded-md bg-zinc-200/50 hover:bg-zinc-200/80 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 border border-zinc-200/80 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 max-w-sm sm:max-w-md w-full justify-between transition-colors cursor-pointer group shadow-2xs"
          >
            <div className="flex items-center gap-2 truncate">
              <Search className="w-3 h-3 text-zinc-400 group-hover:text-blue-500 transition-colors shrink-0" />
              <span className="text-[11px] font-medium truncate text-zinc-700 dark:text-zinc-300">
                {getActiveTitle()}
              </span>
            </div>
            <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 shrink-0">
              Ctrl+P
            </kbd>
          </button>
        ) : (
          <div className="flex items-center gap-2 px-3 py-0.5 rounded-md bg-zinc-200/40 dark:bg-zinc-900/50 border border-zinc-200/60 dark:border-zinc-800/60 max-w-md truncate pointer-events-none">
            <Terminal className="w-3 h-3 text-zinc-400 shrink-0" />
            <span className="text-[11px] text-zinc-600 dark:text-zinc-300 font-medium truncate">
              {getActiveTitle()}
            </span>
          </div>
        )}
      </div>

      {/* Right: Window Controls */}
      <div className="flex items-center h-full shrink-0 wails-no-drag">
        {/* Settings Shortcut */}
        <button
          type="button"
          onClick={onOpenSettings}
          title="Open Settings"
          className="h-full px-2.5 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <SettingsIcon className="w-3.5 h-3.5" />
        </button>

        {/* Minimize */}
        <button
          type="button"
          onClick={handleMinimise}
          title="Minimize Window"
          className="h-full px-3 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>

        {/* Maximize / Restore */}
        <button
          type="button"
          onClick={handleToggleMaximise}
          title={isMaximised ? 'Restore Down' : 'Maximize Window'}
          className="h-full px-3 flex items-center justify-center text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
        >
          {isMaximised ? <RestoreIcon className="w-3 h-3" /> : <Square className="w-3 h-3" />}
        </button>

        {/* Close */}
        <button
          type="button"
          onClick={handleClose}
          title="Close Window"
          className="h-full px-3.5 flex items-center justify-center text-zinc-500 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
