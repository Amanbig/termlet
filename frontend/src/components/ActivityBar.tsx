import React from 'react';
import { Files, Server, Plus, HardDrive, Settings } from 'lucide-react';

export type ActivityView = 'explorer' | 'connections';

interface ActivityBarProps {
  activeView: ActivityView;
  onSelectView: (view: ActivityView) => void;
  onNewConnection: () => void;
  onOpenSettings: () => void;
  hasActiveSession: boolean;
}

export const ActivityBar: React.FC<ActivityBarProps> = ({
  activeView,
  onSelectView,
  onNewConnection,
  onOpenSettings,
  hasActiveSession,
}) => {
  return (
    <div className="w-12 bg-zinc-100 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col justify-between items-center py-2 select-none shrink-0 z-20">
      {/* Top Section */}
      <div className="flex flex-col items-center gap-1 w-full">
        {/* Termlet Logo icon */}
        <div className="w-8 h-8 rounded flex items-center justify-center text-blue-500 mb-2">
          <HardDrive className="w-5 h-5" />
        </div>

        {/* Explorer Button (only if connected, or switches to explorer) */}
        <button
          onClick={() => onSelectView('explorer')}
          title="Explorer (Files)"
          className={`relative w-full h-10 flex items-center justify-center transition-colors cursor-pointer ${
            activeView === 'explorer'
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {activeView === 'explorer' && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-500 rounded-r" />
          )}
          <Files className="w-5 h-5 stroke-[1.6]" />
        </button>

        {/* Remote Profiles / Connections Button */}
        <button
          onClick={() => onSelectView('connections')}
          title="Remote Profiles & Sessions"
          className={`relative w-full h-10 flex items-center justify-center transition-colors cursor-pointer ${
            activeView === 'connections'
              ? 'text-zinc-100'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {activeView === 'connections' && (
            <span className="absolute left-0 top-1.5 bottom-1.5 w-0.5 bg-blue-500 rounded-r" />
          )}
          <Server className="w-5 h-5 stroke-[1.6]" />
        </button>
      </div>

      {/* Bottom Section */}
      <div className="flex flex-col items-center gap-1 w-full">
        <button
          onClick={onNewConnection}
          title="New SSH Connection"
          className="w-full h-10 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <Plus className="w-5 h-5 stroke-[1.8]" />
        </button>

        {/* Settings Button */}
        <button
          onClick={onOpenSettings}
          title="Settings (Themes & Preferences)"
          className="w-full h-10 flex items-center justify-center text-zinc-500 hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <Settings className="w-5 h-5 stroke-[1.6]" />
        </button>
      </div>
    </div>
  );
};
