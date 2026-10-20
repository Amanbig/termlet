import React, { useState, useEffect, useCallback } from 'react';
import { Profile } from '../types/remote';
import {
  GetDefaultSSHConfigPath,
  ParseSSHConfig,
  ImportSSHConfigProfiles,
} from '../../wailsjs/go/main/App';
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
import { Badge } from './ui/badge';
import {
  FileText,
  Key,
  Server,
  Loader2,
  Check,
  Radio,
  RefreshCw,
  FolderDown,
  AlertCircle,
  CheckSquare,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';

interface ImportSSHConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  existingProfiles: Profile[];
  onProfilesImported: () => void;
}

export const ImportSSHConfigModal: React.FC<ImportSSHConfigModalProps> = ({
  open,
  onOpenChange,
  existingProfiles,
  onProfilesImported,
}) => {
  const [configPath, setConfigPath] = useState('');
  const [discoveredProfiles, setDiscoveredProfiles] = useState<Profile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [overwriteExisting, setOverwriteExisting] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const existingNamesSet = new Set(existingProfiles.map((p) => p.name.toLowerCase()));

  const loadConfig = useCallback(async (path?: string) => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      let targetPath = path;
      if (!targetPath) {
        targetPath = await GetDefaultSSHConfigPath();
        setConfigPath(targetPath);
      }

      if (!targetPath) {
        setErrorMessage('Unable to determine default ~/.ssh/config location');
        setDiscoveredProfiles([]);
        return;
      }

      const profiles = await ParseSSHConfig(targetPath);
      if (Array.isArray(profiles)) {
        setDiscoveredProfiles(profiles);
        // Pre-select profiles that don't already exist
        const toSelect = new Set<string>();
        for (const p of profiles) {
          if (!existingNamesSet.has(p.name.toLowerCase())) {
            toSelect.add(p.id);
          }
        }
        // If all already exist, select all anyway
        if (toSelect.size === 0 && profiles.length > 0) {
          profiles.forEach((p) => toSelect.add(p.id));
        }
        setSelectedIds(toSelect);
      } else {
        setDiscoveredProfiles([]);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to read SSH configuration');
      setDiscoveredProfiles([]);
    } finally {
      setIsLoading(false);
    }
  }, [existingProfiles]);

  useEffect(() => {
    if (open) {
      loadConfig();
    }
  }, [open, loadConfig]);

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(discoveredProfiles.map((p) => p.id)));
  };

  const deselectAll = () => {
    setSelectedIds(new Set());
  };

  const handleImport = async () => {
    const toImport = discoveredProfiles.filter((p) => selectedIds.has(p.id));
    if (toImport.length === 0) {
      toast.warning('No profiles selected for import');
      return;
    }

    setIsImporting(true);
    try {
      const count = await ImportSSHConfigProfiles(toImport, overwriteExisting);
      toast.success(`Successfully imported ${count} connection profile${count === 1 ? '' : 's'}!`);
      onProfilesImported();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(`Import failed: ${err?.message || err}`);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[620px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] p-0 select-none">
        <DialogHeader className="p-5 pb-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <FolderDown className="w-4 h-4" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold text-zinc-900 dark:text-zinc-100">
                Import from SSH Config
              </DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Automatically parse and import host aliases from your local OpenSSH configuration.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Config File Path Bar */}
        <div className="px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/30 dark:bg-zinc-900/10 flex items-center gap-2">
          <div className="flex-1 min-w-0">
            <label className="text-[10px] uppercase font-semibold tracking-wider text-zinc-500 block mb-1">
              Configuration File Path
            </label>
            <div className="flex items-center gap-2">
              <Input
                type="text"
                value={configPath}
                onChange={(e) => setConfigPath(e.target.value)}
                placeholder="~/.ssh/config"
                className="h-8 text-xs font-mono bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800"
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => loadConfig(configPath)}
                disabled={isLoading}
                className="h-8 px-2.5 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 shrink-0 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
                Scan
              </Button>
            </div>
          </div>
        </div>

        {/* Host List Area */}
        <div className="flex-1 overflow-y-auto p-5 space-y-2">
          {isLoading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <p className="text-xs">Parsing SSH configuration file...</p>
            </div>
          ) : errorMessage ? (
            <div className="py-8 px-4 text-center">
              <AlertCircle className="w-8 h-8 text-amber-500 mx-auto mb-2 opacity-80" />
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">{errorMessage}</p>
              <p className="text-[11px] text-zinc-500 mt-1 max-w-sm mx-auto">
                Check that your SSH config file exists and has read permissions.
              </p>
            </div>
          ) : discoveredProfiles.length === 0 ? (
            <div className="py-8 px-4 text-center text-zinc-500">
              <FileText className="w-8 h-8 mx-auto mb-2 opacity-40 text-zinc-400" />
              <p className="text-xs font-medium text-zinc-800 dark:text-zinc-200">
                No Host entries found
              </p>
              <p className="text-[11px] text-zinc-500 mt-1">
                The specified config file contains no concrete Host configurations to import.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between pb-1 text-xs text-zinc-500">
                <span>
                  Found {discoveredProfiles.length} host{discoveredProfiles.length === 1 ? '' : 's'}
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={selectAll}
                    className="hover:text-blue-500 text-[11px] cursor-pointer"
                  >
                    Select All
                  </button>
                  <span>•</span>
                  <button
                    onClick={deselectAll}
                    className="hover:text-blue-500 text-[11px] cursor-pointer"
                  >
                    Deselect All
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                {discoveredProfiles.map((p) => {
                  const isSelected = selectedIds.has(p.id);
                  const isExisting = existingNamesSet.has(p.name.toLowerCase());

                  return (
                    <div
                      key={p.id}
                      onClick={() => toggleSelect(p.id)}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all cursor-pointer text-xs ${
                        isSelected
                          ? 'border-blue-500/50 bg-blue-50/40 dark:bg-blue-950/20 text-zinc-900 dark:text-zinc-100'
                          : 'border-zinc-200 dark:border-zinc-800/80 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 text-zinc-600 dark:text-zinc-400'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1 mr-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleSelect(p.id);
                          }}
                          className="text-blue-600 dark:text-blue-400 shrink-0"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 fill-blue-600 text-white dark:fill-blue-500 dark:text-zinc-950" />
                          ) : (
                            <Square className="w-4 h-4 text-zinc-400" />
                          )}
                        </button>

                        <Server className="w-4 h-4 text-zinc-400 shrink-0" />

                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold truncate text-zinc-900 dark:text-zinc-100">
                              {p.name}
                            </span>
                            {isExisting ? (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-300 dark:border-amber-800/50"
                              >
                                Exists
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[10px] px-1.5 py-0 h-4 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-800/50"
                              >
                                New
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-zinc-500 font-mono truncate mt-0.5">
                            {p.username ? `${p.username}@` : ''}
                            {p.host}:{p.port}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {p.key_path ? (
                          <span
                            className="flex items-center gap-1 text-[11px] text-zinc-500 font-mono max-w-[140px] truncate"
                            title={p.key_path}
                          >
                            <Key className="w-3 h-3 text-amber-500 shrink-0" />
                            <span className="truncate">{p.key_path.split('/').pop()}</span>
                          </span>
                        ) : null}

                        {p.port_forwards && p.port_forwards.length > 0 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] px-1.5 py-0 h-4 bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800/60"
                          >
                            <Radio className="w-2.5 h-2.5 mr-1" />
                            {p.port_forwards.length} tunnel
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20 flex flex-row items-center justify-between sm:justify-between">
          <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
            <input
              type="checkbox"
              checked={overwriteExisting}
              onChange={(e) => setOverwriteExisting(e.target.checked)}
              className="rounded border-zinc-300 dark:border-zinc-700 text-blue-600 focus:ring-blue-500 w-3.5 h-3.5 cursor-pointer"
            />
            <span>Overwrite existing profiles</span>
          </label>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="text-xs h-8 px-3 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleImport}
              disabled={isImporting || selectedIds.size === 0}
              className="text-xs h-8 px-3 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              {isImporting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  Importing...
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5 mr-1.5" />
                  Import Selected ({selectedIds.size})
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
