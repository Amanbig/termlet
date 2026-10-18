import React from 'react';
import { Profile, SessionSummary } from '../types/remote';
import {
  Server,
  Plus,
  Power,
  Trash2,
  Edit,
  Radio,
  HardDrive,
  ChevronRight,
} from 'lucide-react';
import { Button } from './ui/button';
import { Badge } from './ui/badge';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface ConnectionSidebarProps {
  profiles: Profile[];
  activeSessions: SessionSummary[];
  currentSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onNewConnection: () => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (id: string) => void;
  onConnectProfile: (profile: Profile) => void;
  onDisconnectSession: (sessionId: string) => void;
}

export const ConnectionSidebar: React.FC<ConnectionSidebarProps> = ({
  profiles,
  activeSessions,
  currentSessionId,
  onSelectSession,
  onNewConnection,
  onEditProfile,
  onDeleteProfile,
  onConnectProfile,
  onDisconnectSession,
}) => {
  return (
    <div className="w-full bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full select-none">
      {/* Remote Explorer Header */}
      <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between">
        <span className="font-semibold text-xs tracking-wider uppercase text-zinc-700 dark:text-zinc-300">
          Remote Explorer
        </span>
        <Button
          size="icon"
          variant="ghost"
          onClick={onNewConnection}
          title="New Connection Profile"
          className="h-6 w-6 text-zinc-500 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {/* Active Sessions Section */}
      <div className="flex-1 overflow-y-auto p-2 space-y-4">
        {activeSessions.length > 0 && (
          <div>
            <div className="px-2 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-emerald-400 animate-pulse" />
              Active Connections ({activeSessions.length})
            </div>
            <div className="mt-1 space-y-1">
              {activeSessions.map((session) => {
                const isActive = session.id === currentSessionId;
                return (
                  <div
                    key={session.id}
                    onClick={() => onSelectSession(session.id)}
                    className={`group flex items-center justify-between p-2 rounded-md cursor-pointer transition-colors text-xs border ${
                      isActive
                        ? 'bg-blue-50 dark:bg-blue-950/40 border-blue-300 dark:border-blue-800/80 text-blue-900 dark:text-blue-100 shadow-2xs'
                        : 'bg-white dark:bg-zinc-900/40 border-zinc-200 dark:border-zinc-800/40 text-zinc-800 dark:text-zinc-300 hover:bg-zinc-100/80 dark:hover:bg-zinc-900/80'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                      <div className="truncate">
                        <div className="font-medium truncate">{session.profile_name}</div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {session.username}@{session.host}:{session.port}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Disconnect"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDisconnectSession(session.id);
                        }}
                        className="h-6 w-6 text-zinc-500 hover:text-rose-500 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer"
                      >
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Saved Profiles Section */}
        <div>
          <div className="px-2 py-1 text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">
            Saved Profiles ({profiles.length})
          </div>

          {profiles.length === 0 ? (
            <div className="px-2 py-6 text-center text-xs text-zinc-500">
              No saved profiles yet. Click &quot;New&quot; to connect to an SSH server.
            </div>
          ) : (
            <div className="mt-1 space-y-1">
              {profiles.map((profile) => {
                const isConnected = activeSessions.some((s) => s.profile_id === profile.id);
                return (
                  <div
                    key={profile.id}
                    className="group flex items-center justify-between p-2 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-900/80 text-xs text-zinc-700 dark:text-zinc-300 transition-colors border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800/60"
                  >
                    <div
                      className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
                      onClick={() => onConnectProfile(profile)}
                    >
                      <Server className="w-4 h-4 text-zinc-400 shrink-0 group-hover:text-blue-500 transition-colors" />
                      <div className="truncate min-w-0">
                        <div className="font-medium truncate text-zinc-900 dark:text-zinc-200">
                          {profile.name}
                        </div>
                        <div className="text-[10px] text-zinc-500 truncate">
                          {profile.username}@{profile.host}:{profile.port}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      {isConnected ? (
                        <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/40 h-5 px-1.5">
                          Online
                        </Badge>
                      ) : (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onConnectProfile(profile)}
                          className="h-6 px-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer"
                        >
                          Connect
                        </Button>
                      )}

                      <DropdownMenu>
                        <DropdownMenuTrigger className="p-1 rounded text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-200/70 dark:hover:bg-zinc-800 cursor-pointer">
                          <span className="text-xs">•••</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs shadow-lg">
                          <DropdownMenuItem onClick={() => onEditProfile(profile)}>
                            <Edit className="w-3.5 h-3.5 mr-2" /> Edit Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => onDeleteProfile(profile.id)}
                            className="text-rose-500 dark:text-rose-400 focus:text-rose-600 dark:focus:text-rose-300"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete Profile
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
