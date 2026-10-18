import React from 'react';
import { Profile } from '../types/remote';
import {
  HardDrive,
  Plus,
  Server,
  Terminal,
  ShieldCheck,
  FileCode,
  ArrowRight,
  Clock,
  Trash2,
  Edit2,
  ExternalLink,
} from 'lucide-react';
import { Button } from './ui/button';

interface WelcomeScreenProps {
  profiles: Profile[];
  onOpenProfile: (profile: Profile) => void;
  onNewConnection: () => void;
  onEditProfile: (profile: Profile) => void;
  onDeleteProfile: (id: string) => void;
}

export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  profiles,
  onOpenProfile,
  onNewConnection,
  onEditProfile,
  onDeleteProfile,
}) => {
  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 text-zinc-100 overflow-y-auto select-none">
      <div className="max-w-4xl w-full mx-auto px-8 py-12 flex-1 flex flex-col justify-center">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-zinc-100">Termlet</h1>
              <p className="text-xs text-zinc-400">SSH Remote Workspace & Code Editor</p>
            </div>
          </div>
        </div>

        {/* 2-Column VS Code Style Layout */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Left Column: Start & Saved Profiles (7 cols) */}
          <div className="md:col-span-7 space-y-6">
            {/* Start Section */}
            <div>
              <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-3">
                Start
              </h2>
              <div className="space-y-1.5">
                <button
                  onClick={onNewConnection}
                  className="w-full flex items-center justify-between p-3 rounded-md bg-zinc-900/60 hover:bg-zinc-900 border border-zinc-800/80 hover:border-blue-500/50 text-left transition-all group cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded bg-blue-500/10 text-blue-400 flex items-center justify-center group-hover:bg-blue-500 group-hover:text-white transition-colors">
                      <Plus className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-zinc-200 group-hover:text-white">
                        Connect to SSH Host...
                      </div>
                      <div className="text-xs text-zinc-500">
                        Open a remote server profile or enter new host details
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 group-hover:translate-x-0.5 transition-all" />
                </button>
              </div>
            </div>

            {/* Saved Profiles (like VS Code Recent Projects) */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
                  Recent Profiles ({profiles.length})
                </h2>
                {profiles.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onNewConnection}
                    className="h-6 px-2 text-xs text-blue-400 hover:text-blue-300 hover:bg-zinc-900"
                  >
                    + New Profile
                  </Button>
                )}
              </div>

              {profiles.length === 0 ? (
                <div className="p-6 rounded-md bg-zinc-900/40 border border-dashed border-zinc-800 text-center">
                  <Server className="w-8 h-8 text-zinc-600 mx-auto mb-2" />
                  <p className="text-xs text-zinc-400">No saved connection profiles yet</p>
                  <p className="text-[11px] text-zinc-600 mt-1">
                    Create your first SSH connection above to quickly access your remote workspace.
                  </p>
                </div>
              ) : (
                <div className="space-y-1.5 max-h-[340px] overflow-y-auto pr-1">
                  {profiles.map((profile) => (
                    <div
                      key={profile.id}
                      onClick={() => onOpenProfile(profile)}
                      className="group flex items-center justify-between p-2.5 rounded-md bg-zinc-900/40 hover:bg-zinc-900 border border-zinc-800/60 hover:border-zinc-700 cursor-pointer transition-all"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <div className="w-8 h-8 rounded bg-zinc-800 group-hover:bg-blue-950/60 border border-zinc-700/60 group-hover:border-blue-800/60 flex items-center justify-center shrink-0 transition-colors">
                          <Server className="w-4 h-4 text-zinc-400 group-hover:text-blue-400" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-zinc-200 group-hover:text-blue-300 truncate">
                            {profile.name}
                          </div>
                          <div className="text-xs text-zinc-500 font-mono truncate">
                            {profile.username}@{profile.host}:{profile.port}
                            {profile.start_directory && profile.start_directory !== '.' && (
                              <span className="text-zinc-600 ml-1.5">({profile.start_directory})</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Edit Profile"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEditProfile(profile);
                          }}
                          className="h-7 w-7 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title="Delete Profile"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteProfile(profile.id);
                          }}
                          className="h-7 w-7 text-zinc-400 hover:text-rose-400 hover:bg-zinc-800"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Key Capabilities & Help (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">
              Workspace Features
            </h2>

            <div className="p-4 rounded-md bg-zinc-900/40 border border-zinc-800/80 space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                <FileCode className="w-4 h-4 text-emerald-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-zinc-200">140+ Languages Supported</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    CodeMirror 6 with syntax highlighting, bracket matching, and auto-completion.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                <ShieldCheck className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-zinc-200">Host Key Verification</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    Strict fingerprint checks against <code className="text-zinc-400">known_hosts</code> to protect against MITM.
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 text-xs text-zinc-300">
                <Terminal className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium text-zinc-200">Safe Atomic Saves & Conflicts</div>
                  <div className="text-zinc-500 text-[11px] mt-0.5">
                    Remote timestamp validation prevents accidentally overwriting concurrent changes.
                  </div>
                </div>
              </div>
            </div>

            <div className="p-3 rounded-md bg-zinc-900/20 border border-zinc-800/40 text-[11px] text-zinc-500 flex items-center justify-between">
              <span>Press <kbd className="px-1.5 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono text-[10px]">Ctrl+S</kbd> to save remote files</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
