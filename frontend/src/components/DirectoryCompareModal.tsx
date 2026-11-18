import React, { useState } from 'react';
import {
  X,
  FolderSync,
  Folder,
  File,
  ArrowRight,
  ArrowLeft,
  ArrowUpDown,
  Check,
  AlertTriangle,
  Loader2,
  HardDrive,
  Server,
  Download,
  Upload,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  SelectLocalDirectory,
  CompareDirectories,
  SyncDirectories,
} from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';

interface DirectoryCompareModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
  initialRemoteDir: string;
  onSyncCompleted?: () => void;
}

const SyncStatus = {
  Match: 'match',
  Modified: 'modified',
  RemoteOnly: 'remote_only',
  LocalOnly: 'local_only',
} as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(unixSec: number): string {
  if (!unixSec) return '-';
  const d = new Date(unixSec * 1000);
  return d.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const DirectoryCompareModal: React.FC<DirectoryCompareModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  initialRemoteDir,
  onSyncCompleted,
}) => {
  const [remoteDir, setRemoteDir] = useState(initialRemoteDir || '.');
  const [localDir, setLocalDir] = useState('');
  const [isComparing, setIsComparing] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [result, setResult] = useState<models.DirectoryCompareResult | null>(null);
  const [filter, setFilter] = useState<'all' | 'diff' | 'remote' | 'local'>('all');
  const [selectedPaths, setSelectedPaths] = useState<Record<string, boolean>>({});

  if (!isOpen) return null;

  // Pick local folder via native folder dialog
  const handleBrowseLocal = async () => {
    try {
      const dir = await SelectLocalDirectory();
      if (dir) {
        setLocalDir(dir);
      }
    } catch (err: any) {
      toast.error('Could not select directory', { description: err?.message || String(err) });
    }
  };

  // Run directory comparison
  const handleCompare = async () => {
    if (!localDir) {
      toast.error('Please choose a local directory first.');
      return;
    }
    setIsComparing(true);
    setResult(null);
    setSelectedPaths({});

    try {
      const comp = await CompareDirectories(sessionId, remoteDir.trim() || '.', localDir.trim());
      setResult(comp);
      // Auto-select all differing files
      const initialSelected: Record<string, boolean> = {};
      for (const it of comp.items) {
        if (it.status !== SyncStatus.Match) {
          initialSelected[it.path] = true;
        }
      }
      setSelectedPaths(initialSelected);
      toast.success(
        `Comparison complete: ${comp.differences} modified, ${comp.remote_only} remote-only, ${comp.local_only} local-only.`
      );
    } catch (err: any) {
      toast.error('Directory comparison failed', { description: err?.message || String(err) });
    } finally {
      setIsComparing(false);
    }
  };

  // Execute sync
  const handleExecuteSync = async (direction: 'to_local' | 'to_remote' | 'mirror') => {
    if (!result || !sessionId || !localDir) return;

    const actions: models.SyncAction[] = [];

    for (const item of result.items) {
      if (!selectedPaths[item.path]) continue;

      if (direction === 'to_local') {
        // Only pull files that exist on remote
        if (item.status === SyncStatus.Modified || item.status === SyncStatus.RemoteOnly) {
          actions.push({
            path: item.path,
            direction: 'to_local',
            is_dir: item.is_dir,
          });
        }
      } else if (direction === 'to_remote') {
        // Only push files that exist on local
        if (item.status === SyncStatus.Modified || item.status === SyncStatus.LocalOnly) {
          actions.push({
            path: item.path,
            direction: 'to_remote',
            is_dir: item.is_dir,
          });
        }
      } else if (direction === 'mirror') {
        // Two-way sync: remote-only to local, local-only to remote, modified newer wins
        if (item.status === SyncStatus.RemoteOnly) {
          actions.push({ path: item.path, direction: 'to_local', is_dir: item.is_dir });
        } else if (item.status === SyncStatus.LocalOnly) {
          actions.push({ path: item.path, direction: 'to_remote', is_dir: item.is_dir });
        } else if (item.status === SyncStatus.Modified) {
          const toLocal = item.remote_mod_time > item.local_mod_time;
          actions.push({
            path: item.path,
            direction: toLocal ? 'to_local' : 'to_remote',
            is_dir: item.is_dir,
          });
        }
      }
    }

    if (actions.length === 0) {
      toast.info('No files selected for this sync direction.');
      return;
    }

    setIsSyncing(true);
    try {
      const syncRes = await SyncDirectories(sessionId, remoteDir.trim() || '.', localDir.trim(), actions);
      if (syncRes.success) {
        toast.success(`Synced ${syncRes.transferred_files} files successfully!`, {
          description: `Transferred ${formatBytes(syncRes.transferred_bytes)}`,
        });
        onSyncCompleted?.();
        // Re-run comparison to refresh status
        await handleCompare();
      } else {
        toast.warning(`Sync finished with ${syncRes.errors?.length || 0} errors.`);
      }
    } catch (err: any) {
      toast.error('Sync failed', { description: err?.message || String(err) });
    } finally {
      setIsSyncing(false);
    }
  };

  // Filter items
  const filteredItems = (result?.items || []).filter((it) => {
    if (filter === 'all') return true;
    if (filter === 'diff') return it.status === SyncStatus.Modified;
    if (filter === 'remote') return it.status === SyncStatus.RemoteOnly;
    if (filter === 'local') return it.status === SyncStatus.LocalOnly;
    return true;
  });

  const toggleSelectAll = (checked: boolean) => {
    const updated: Record<string, boolean> = {};
    if (checked) {
      for (const it of filteredItems) {
        updated[it.path] = true;
      }
    }
    setSelectedPaths(updated);
  };

  const selectedCount = Object.values(selectedPaths).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-4xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-500">
              <FolderSync className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>SFTP Directory Compare & Sync</span>
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Compare local files with remote server directory and synchronize differences
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Path Selectors Card */}
        <div className="p-4 bg-zinc-950/60 border-b border-zinc-800 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Remote Directory */}
            <div>
              <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5 mb-1">
                <Server className="w-3.5 h-3.5 text-blue-400" />
                <span>Remote Directory (Server)</span>
              </label>
              <input
                type="text"
                placeholder="e.g. /var/www/html or ~/project"
                value={remoteDir}
                onChange={(e) => setRemoteDir(e.target.value)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>

            {/* Local Directory */}
            <div>
              <label className="text-[11px] font-medium text-zinc-400 flex items-center gap-1.5 mb-1">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                <span>Local Directory (Your Computer)</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Select local folder..."
                  value={localDir}
                  onChange={(e) => setLocalDir(e.target.value)}
                  className="flex-1 px-2.5 py-1.5 rounded-lg border border-zinc-700 bg-zinc-900 text-zinc-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
                />
                <button
                  onClick={handleBrowseLocal}
                  className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium cursor-pointer transition-colors shrink-0"
                >
                  Browse...
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <span className="text-[11px] text-zinc-500">
              Scans recursively up to 5,000 files (ignores .git and node_modules).
            </span>
            <button
              onClick={handleCompare}
              disabled={isComparing || !localDir}
              className="px-4 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium text-xs shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
            >
              {isComparing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Scanning & Comparing...</span>
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Compare Directories</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Results Body */}
        <div className="flex-1 min-h-0 flex flex-col p-4 overflow-hidden bg-zinc-950">
          {result && (
            <>
              {/* Summary Badges & Filters */}
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setFilter('all')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      filter === 'all'
                        ? 'bg-zinc-800 text-white'
                        : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    All ({result.total_files})
                  </button>
                  <button
                    onClick={() => setFilter('diff')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      filter === 'diff'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'text-zinc-400 hover:text-amber-300'
                    }`}
                  >
                    Modified ({result.differences})
                  </button>
                  <button
                    onClick={() => setFilter('remote')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      filter === 'remote'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : 'text-zinc-400 hover:text-blue-300'
                    }`}
                  >
                    Remote Only ({result.remote_only})
                  </button>
                  <button
                    onClick={() => setFilter('local')}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors cursor-pointer ${
                      filter === 'local'
                        ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                        : 'text-zinc-400 hover:text-violet-300'
                    }`}
                  >
                    Local Only ({result.local_only})
                  </button>
                </div>

                <div className="text-[11px] text-zinc-400 font-mono">
                  <span>{selectedCount} selected</span>
                </div>
              </div>

              {/* Table of File Diffs */}
              <div className="flex-1 overflow-y-auto border border-zinc-800 rounded-lg bg-zinc-900/60 min-h-[220px]">
                <table className="w-full text-left text-xs text-zinc-300">
                  <thead className="bg-zinc-800/80 sticky top-0 border-b border-zinc-700/80 text-[10px] uppercase font-mono text-zinc-400 select-none">
                    <tr>
                      <th className="py-2 px-3 w-8">
                        <input
                          type="checkbox"
                          checked={
                            filteredItems.length > 0 &&
                            filteredItems.every((it) => selectedPaths[it.path])
                          }
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                          className="rounded accent-blue-600"
                        />
                      </th>
                      <th className="py-2 px-3">Path</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3">Local Info</th>
                      <th className="py-2 px-3">Remote Info</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/80 font-mono text-[11px]">
                    {filteredItems.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-zinc-500">
                          No files match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredItems.map((item) => (
                        <tr
                          key={item.path}
                          className={`hover:bg-zinc-800/50 transition-colors ${
                            selectedPaths[item.path] ? 'bg-zinc-800/30' : ''
                          }`}
                        >
                          <td className="py-2 px-3">
                            <input
                              type="checkbox"
                              checked={!!selectedPaths[item.path]}
                              onChange={(e) => {
                                setSelectedPaths((prev) => ({
                                  ...prev,
                                  [item.path]: e.target.checked,
                                }));
                              }}
                              className="rounded accent-blue-600"
                            />
                          </td>
                          <td className="py-2 px-3 flex items-center gap-1.5 truncate max-w-[280px]">
                            {item.is_dir ? (
                              <Folder className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                            ) : (
                              <File className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                            )}
                            <span className="truncate text-zinc-100" title={item.path}>
                              {item.path}
                            </span>
                          </td>
                          <td className="py-2 px-3">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-sans font-medium border ${
                                item.status === SyncStatus.Match
                                  ? 'bg-emerald-950/40 text-emerald-400 border-emerald-800/60'
                                  : item.status === SyncStatus.Modified
                                  ? 'bg-amber-950/40 text-amber-400 border-amber-800/60'
                                  : item.status === SyncStatus.RemoteOnly
                                  ? 'bg-blue-950/40 text-blue-400 border-blue-800/60'
                                  : 'bg-violet-950/40 text-violet-400 border-violet-800/60'
                              }`}
                            >
                              {item.status === SyncStatus.Match
                                ? 'Identical'
                                : item.status === SyncStatus.Modified
                                ? 'Modified'
                                : item.status === SyncStatus.RemoteOnly
                                ? 'Remote Only'
                                : 'Local Only'}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-zinc-400 text-[10px]">
                            {item.status !== SyncStatus.RemoteOnly ? (
                              <span>
                                {formatBytes(item.local_size)} • {formatDate(item.local_mod_time)}
                              </span>
                            ) : (
                              <span className="text-zinc-600 italic">Not in local</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-zinc-400 text-[10px]">
                            {item.status !== SyncStatus.LocalOnly ? (
                              <span>
                                {formatBytes(item.remote_size)} • {formatDate(item.remote_mod_time)}
                              </span>
                            ) : (
                              <span className="text-zinc-600 italic">Not in remote</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {!result && !isComparing && (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-zinc-500">
              <FolderSync className="w-10 h-10 text-zinc-700 mb-2 stroke-[1.2]" />
              <p className="text-sm font-medium text-zinc-300">Compare Remote and Local Directories</p>
              <p className="text-xs text-zinc-500 max-w-sm mt-1">
                Select your local repository or folder above and click &quot;Compare Directories&quot; to review differences and synchronize.
              </p>
            </div>
          )}
        </div>

        {/* Sync Actions Footer */}
        {result && (
          <div className="px-5 py-3.5 border-t border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {/* Pull Remote -> Local */}
              <button
                onClick={() => handleExecuteSync('to_local')}
                disabled={isSyncing || selectedCount === 0}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Download selected remote files to local directory"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Pull from Server ({selectedCount})</span>
              </button>

              {/* Push Local -> Remote */}
              <button
                onClick={() => handleExecuteSync('to_remote')}
                disabled={isSyncing || selectedCount === 0}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                title="Upload selected local files to remote server"
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Push to Server ({selectedCount})</span>
              </button>

              {/* Two-Way Sync / Mirror */}
              <button
                onClick={() => handleExecuteSync('mirror')}
                disabled={isSyncing || selectedCount === 0}
                className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Two-way sync: newer file overwrites older file"
              >
                <ArrowUpDown className="w-3.5 h-3.5 text-zinc-400" />
                <span>Two-Way Sync</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
