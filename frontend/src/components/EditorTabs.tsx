import React from 'react';
import { OpenFile } from '../types/remote';
import { X, FileCode, MoreHorizontal, Settings } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface EditorTabsProps {
  files: OpenFile[];
  activeFilePath: string | null;
  isSettingsOpen: boolean;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseAll: () => void;
  onSelectSettings: () => void;
  onCloseSettings: () => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  files,
  activeFilePath,
  isSettingsOpen,
  onSelect,
  onClose,
  onCloseAll,
  onSelectSettings,
  onCloseSettings,
}) => {
  if (files.length === 0 && !isSettingsOpen) {
    return null;
  }

  return (
    <div className="flex items-center bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800/80 overflow-x-auto no-scrollbar select-none">
      <div className="flex items-center flex-1 min-w-0">
        {/* Settings Tab if Open (like VS Code) */}
        {isSettingsOpen && (
          <div
            onClick={onSelectSettings}
            className={`group flex items-center gap-2 px-3 py-2 text-xs border-r border-zinc-200 dark:border-zinc-800/80 cursor-pointer transition-colors max-w-[200px] shrink-0 ${
              activeFilePath === 'termlet://settings'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium border-t-2 border-t-blue-500'
                : 'bg-zinc-200/50 dark:bg-zinc-950/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200 border-t-2 border-t-transparent'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate flex-1">Settings</span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseSettings();
              }}
              title="Close Settings"
              className="p-0.5 rounded-sm hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* File Tabs */}
        {files.map((file) => {
          const isActive = file.path === activeFilePath && !isSettingsOpen;
          return (
            <div
              key={file.path}
              onClick={() => onSelect(file.path)}
              className={`group flex items-center gap-2 px-3 py-2 text-xs border-r border-zinc-200 dark:border-zinc-800/80 cursor-pointer transition-colors max-w-[200px] shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium border-t-2 border-t-blue-500'
                  : 'bg-zinc-200/50 dark:bg-zinc-950/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200 border-t-2 border-t-transparent'
              }`}
            >
              <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-500' : 'text-zinc-400'}`} />
              <span className="truncate flex-1" title={file.path}>
                {file.name}
              </span>

              {/* Dirty indicator or close button */}
              <div className="flex items-center justify-center w-4 h-4">
                {file.isDirty ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(file.path);
                    }}
                    className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden"
                  />
                ) : null}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(file.path);
                  }}
                  className={`p-0.5 rounded-sm hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer ${
                    file.isDirty ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs Actions Menu */}
      <div className="px-2 shrink-0">
        <DropdownMenu>
          <DropdownMenuTrigger className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer">
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200">
            <DropdownMenuItem
              onClick={onCloseAll}
              className="text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-rose-500 focus:text-rose-500 cursor-pointer"
            >
              Close All Tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
