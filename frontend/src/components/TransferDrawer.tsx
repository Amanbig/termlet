import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { transfer } from '../../wailsjs/go/models';
import {
  ListTransfers,
  CancelTransfer,
  ClearFinishedTransfers,
  OpenLocalFile,
} from '../../wailsjs/go/main/App';
import { EventsOn } from '../../wailsjs/runtime/runtime';
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  X,
  Trash2,
  FolderOpen,
  CheckCircle2,
  AlertTriangle,
  Minus,
  Maximize2,
  Minimize2,
  FileCode,
  FileArchive,
  FileText,
  FileImage,
  File,
  Loader2,
  ArrowUpDown,
} from 'lucide-react';
import { Button } from './ui/button';
import { toast } from 'sonner';

interface TransferDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onActiveCountChange?: (count: number) => void;
}

export const TransferDrawer: React.FC<TransferDrawerProps> = ({
  isOpen,
  onClose,
  onActiveCountChange,
}) => {
  const [transfers, setTransfers] = useState<transfer.Item[]>([]);
  const [filterTab, setFilterTab] = useState<'all' | 'active' | 'completed'>('all');
  const [isExpanded, setIsExpanded] = useState(false);

  // Load existing transfers from Go backend
  const loadTransfers = useCallback(async () => {
    try {
      const list = await ListTransfers();
      if (Array.isArray(list)) {
        setTransfers(list);
        const active = list.filter((t) => t.status === 'in_progress' || t.status === 'queued').length;
        onActiveCountChange?.(active);
      }
    } catch (err) {
      console.warn('Failed to list transfers:', err);
    }
  }, [onActiveCountChange]);

  useEffect(() => {
    loadTransfers();

    // Listen to real-time events from Go backend
    const cancelUpdateSub = EventsOn('transfer:update', (updated: transfer.Item) => {
      setTransfers((prev) => {
        const index = prev.findIndex((t) => t.id === updated.id);
        let next: transfer.Item[];
        if (index >= 0) {
          next = [...prev];
          next[index] = updated;
        } else {
          next = [updated, ...prev];
        }
        const active = next.filter((t) => t.status === 'in_progress' || t.status === 'queued').length;
        onActiveCountChange?.(active);
        return next;
      });
    });

    const cancelClearedSub = EventsOn('transfer:cleared', () => {
      loadTransfers();
    });

    return () => {
      if (typeof cancelUpdateSub === 'function') cancelUpdateSub();
      if (typeof cancelClearedSub === 'function') cancelClearedSub();
    };
  }, [loadTransfers, onActiveCountChange]);

  // Actions
  const handleCancel = async (id: string, name: string) => {
    try {
      await CancelTransfer(id);
      toast.info(`Transfer cancelled: ${name}`);
    } catch (err: any) {
      toast.error(`Failed to cancel transfer: ${err?.message || err}`);
    }
  };

  const handleClearFinished = async () => {
    try {
      await ClearFinishedTransfers();
      loadTransfers();
    } catch (err: any) {
      console.warn('Failed to clear finished transfers:', err);
    }
  };

  const handleOpenFolder = async (destPath: string) => {
    try {
      await OpenLocalFile(destPath);
    } catch (err: any) {
      toast.error(`Could not reveal file: ${err?.message || err}`);
    }
  };

  // Filtered transfers
  const filteredTransfers = useMemo(() => {
    if (filterTab === 'active') {
      return transfers.filter((t) => t.status === 'in_progress' || t.status === 'queued');
    }
    if (filterTab === 'completed') {
      return transfers.filter((t) => t.status === 'completed');
    }
    return transfers;
  }, [transfers, filterTab]);

  const activeCount = useMemo(
    () => transfers.filter((t) => t.status === 'in_progress' || t.status === 'queued').length,
    [transfers]
  );

  const completedCount = useMemo(
    () => transfers.filter((t) => t.status === 'completed').length,
    [transfers]
  );

  // Formatting utilities
  const formatBytes = (bytes: number): string => {
    if (bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
  };

  const formatSpeed = (bytesPerSec: number): string => {
    if (!bytesPerSec || bytesPerSec <= 0) return '';
    return `${formatBytes(bytesPerSec)}/s`;
  };

  const formatETA = (item: transfer.Item): string => {
    if (item.status !== 'in_progress' || !item.speedBytesPerSec || item.speedBytesPerSec <= 0) {
      return '';
    }
    if (!item.totalBytes || item.totalBytes <= item.bytesTransferred) {
      return '';
    }
    const remainingBytes = item.totalBytes - item.bytesTransferred;
    const seconds = Math.ceil(remainingBytes / item.speedBytesPerSec);
    if (seconds < 60) {
      return `ETA: ${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `ETA: ${mins}m ${secs}s`;
  };

  const renderFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'zip':
      case 'tar':
      case 'gz':
      case 'rar':
      case '7z':
        return <FileArchive className="w-4 h-4 text-amber-500 shrink-0" />;
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'go':
      case 'py':
      case 'json':
        return <FileCode className="w-4 h-4 text-emerald-500 shrink-0" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'svg':
        return <FileImage className="w-4 h-4 text-violet-500 shrink-0" />;
      case 'md':
      case 'txt':
      case 'log':
        return <FileText className="w-4 h-4 text-sky-500 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-zinc-400 shrink-0" />;
    }
  };

  if (!isOpen) return null;

  return (
    <div
      role="region"
      aria-label="Transfer Queue"
      className={`fixed bottom-6 right-6 z-40 flex flex-col bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl transition-all duration-200 select-none overflow-hidden ${
        isExpanded ? 'w-[520px] h-[460px]' : 'w-[450px] h-[310px]'
      }`}
    >
      {/* Header */}
      <div className="h-10 px-3 bg-zinc-50/80 dark:bg-zinc-950/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ArrowUpDown className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
            Transfers
          </span>
          {activeCount > 0 && (
            <span className="bg-blue-500 text-white rounded-full px-1.5 py-0.2 text-[9px] font-bold animate-pulse">
              {activeCount}
            </span>
          )}
        </div>

        {/* Tab Filter Pills */}
        <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-800/60 p-0.5 rounded-md text-[10px]">
          <button
            onClick={() => setFilterTab('all')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              filterTab === 'all'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            All ({transfers.length})
          </button>
          <button
            onClick={() => setFilterTab('active')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              filterTab === 'active'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            Active ({activeCount})
          </button>
          <button
            onClick={() => setFilterTab('completed')}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors ${
              filterTab === 'completed'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium shadow-2xs'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900'
            }`}
          >
            Done ({completedCount})
          </button>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-1">
          {transfers.some(
            (t) => t.status === 'completed' || t.status === 'failed' || t.status === 'cancelled'
          ) && (
            <button
              onClick={handleClearFinished}
              title="Clear finished transfers"
              className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => setIsExpanded((prev) => !prev)}
            title={isExpanded ? 'Restore size' : 'Expand drawer'}
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            {isExpanded ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={onClose}
            title="Close drawer"
            className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Transfer List */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 p-2">
        {filteredTransfers.length > 0 ? (
          filteredTransfers.map((item) => {
            const isDownloading = item.type === 'download';
            const isInProgress = item.status === 'in_progress';
            const isCompleted = item.status === 'completed';
            const isFailed = item.status === 'failed';
            const isCancelled = item.status === 'cancelled';

            const speedText = formatSpeed(item.speedBytesPerSec);
            const etaText = formatETA(item);

            return (
              <div
                key={item.id}
                className="py-2.5 px-2 rounded-lg hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition-colors flex flex-col gap-1.5"
              >
                {/* Top Row: Type Icon, File Name, and Status Badge */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <div
                      className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${
                        isDownloading
                          ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400'
                          : 'bg-purple-100 dark:bg-purple-950/60 text-purple-600 dark:text-purple-400'
                      }`}
                      title={isDownloading ? 'Download' : 'Upload'}
                    >
                      {isDownloading ? (
                        <ArrowDownToLine className="w-3.5 h-3.5" />
                      ) : (
                        <ArrowUpFromLine className="w-3.5 h-3.5" />
                      )}
                    </div>

                    {renderFileIcon(item.name)}

                    <span
                      className="font-medium text-xs text-zinc-900 dark:text-zinc-100 truncate"
                      title={item.name}
                    >
                      {item.name}
                    </span>
                  </div>

                  {/* Actions & Status */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    {isInProgress && (
                      <button
                        onClick={() => handleCancel(item.id, item.name)}
                        className="p-1 rounded text-zinc-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/50 cursor-pointer transition-colors"
                        title="Cancel transfer"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}

                    {isCompleted && item.type === 'download' && item.destPath && (
                      <button
                        onClick={() => handleOpenFolder(item.destPath)}
                        className="px-2 py-0.5 rounded text-[10px] font-medium text-blue-600 dark:text-blue-400 bg-blue-50 hover:bg-blue-100 dark:bg-blue-950/60 dark:hover:bg-blue-900/60 flex items-center gap-1 cursor-pointer transition-colors"
                        title="Show in Folder"
                      >
                        <FolderOpen className="w-3 h-3" />
                        Show
                      </button>
                    )}

                    {isCompleted && (
                      <span className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">
                        <CheckCircle2 className="w-3 h-3" />
                        Done
                      </span>
                    )}

                    {isFailed && (
                      <span className="flex items-center gap-1 text-[10px] text-rose-500 font-medium">
                        <AlertTriangle className="w-3 h-3" />
                        Failed
                      </span>
                    )}

                    {isCancelled && (
                      <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
                        Cancelled
                      </span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full transition-all duration-150 rounded-full ${
                      isCompleted
                        ? 'bg-emerald-500'
                        : isFailed
                        ? 'bg-rose-500'
                        : isCancelled
                        ? 'bg-zinc-400'
                        : isDownloading
                        ? 'bg-blue-500'
                        : 'bg-purple-500'
                    }`}
                    style={{
                      width: `${Math.max(item.percentage || 0, isCompleted ? 100 : 0)}%`,
                    }}
                  />
                </div>

                {/* Bottom Row: Metrics & File Sizes */}
                <div className="flex items-center justify-between text-[10px] font-mono text-zinc-500 dark:text-zinc-400">
                  <div className="flex items-center gap-1.5 truncate">
                    <span>
                      {formatBytes(item.bytesTransferred)}
                      {item.totalBytes > 0 && ` / ${formatBytes(item.totalBytes)}`}
                    </span>
                    {item.percentage > 0 && <span>({item.percentage.toFixed(0)}%)</span>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {speedText && <span>{speedText}</span>}
                    {etaText && <span className="opacity-80">{etaText}</span>}
                    {isFailed && item.error && (
                      <span className="text-rose-500 truncate max-w-[150px]" title={item.error}>
                        {item.error}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center text-zinc-400 dark:text-zinc-600">
            <ArrowUpDown className="w-8 h-8 stroke-[1.2] mb-2 opacity-50" />
            <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
              No transfers {filterTab !== 'all' ? `(${filterTab})` : 'yet'}
            </p>
            <p className="text-[11px] mt-0.5">
              Downloads and uploads will appear here with live speed and progress.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
