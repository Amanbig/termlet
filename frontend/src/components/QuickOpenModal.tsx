import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { RemoteFile, OpenFile } from '../types/remote';
import { SearchRemoteFiles } from '../../wailsjs/go/main/App';
import {
  Search,
  File,
  FileCode,
  FileText,
  FileArchive,
  FileImage,
  X,
  Loader2,
  Clock,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

interface QuickOpenModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string | null;
  startDirectory?: string;
  openFiles: OpenFile[];
  onOpenFile: (sessionId: string, file: RemoteFile) => void;
}

export const QuickOpenModal: React.FC<QuickOpenModalProps> = ({
  isOpen,
  onClose,
  sessionId,
  startDirectory = '.',
  openFiles,
  onOpenFile,
}) => {
  const [query, setQuery] = useState('');
  const [files, setFiles] = useState<RemoteFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchSeqRef = useRef<number>(0);
  const wasOpenRef = useRef<boolean>(false);

  // Fetch files from server with sequence tracking to prevent race conditions
  const fetchFiles = useCallback(
    async (searchQuery = '') => {
      if (!sessionId) {
        setErrorMessage('No active remote session');
        return;
      }

      const seq = ++searchSeqRef.current;
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const results = await SearchRemoteFiles(sessionId, startDirectory, searchQuery, 800);
        if (seq === searchSeqRef.current) {
          if (Array.isArray(results)) {
            setFiles(results);
          } else {
            setFiles([]);
          }
        }
      } catch (err: any) {
        if (seq === searchSeqRef.current) {
          const msg =
            err?.message ||
            (typeof err === 'string' ? err : 'Failed to search remote files. Please check session permissions.');
          console.warn('Failed to search remote files:', err);
          setErrorMessage(msg);
        }
      } finally {
        if (seq === searchSeqRef.current) {
          setIsLoading(false);
        }
      }
    },
    [sessionId, startDirectory]
  );

  // Focus input and reset query ONLY when the modal transitions from closed to open
  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      setQuery('');
      setSelectedIndex(0);
      setErrorMessage(null);

      // Focus input on next tick
      requestAnimationFrame(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      });

      // Index files if we don't have them yet or if session changed
      if (sessionId) {
        fetchFiles('');
      }
    }
    wasOpenRef.current = isOpen;
  }, [isOpen, sessionId, fetchFiles]);

  // Debounced server search when query changes (only after user stops typing)
  useEffect(() => {
    if (!isOpen || !sessionId) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    const trimmed = query.trim();
    if (trimmed.length >= 2) {
      searchTimeoutRef.current = setTimeout(() => {
        fetchFiles(trimmed);
      }, 350);
    }

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [query, isOpen, sessionId, fetchFiles]);

  // Combine and rank results (instant local fuzzy search across cached & open files)
  const filteredFiles = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    const openPaths = new Set(openFiles.map((f) => f.path));

    if (!trimmed) {
      // If query is empty, show open files first, then workspace files
      const recent: RemoteFile[] = openFiles.map((f) => ({
        name: f.name,
        path: f.path,
        is_dir: false,
        size: f.size,
        mod_time: f.modTime,
        permissions: 0,
      }));

      const others = files.filter((f) => !openPaths.has(f.path));
      return [...recent, ...others].slice(0, 100);
    }

    // Split search terms for multi-word matching (e.g. "auth ts")
    const terms = trimmed.split(/\s+/).filter(Boolean);

    // Score and filter files
    const scored = files
      .map((f) => {
        const nameLower = f.name.toLowerCase();
        const pathLower = f.path.toLowerCase();

        // Check if all terms match
        const matchesAll = terms.every((t) => pathLower.includes(t));
        if (!matchesAll) return null;

        let score = 0;
        // Exact name match gets highest score
        if (nameLower === trimmed) {
          score += 1000;
        } else if (nameLower.startsWith(trimmed)) {
          score += 500;
        } else if (nameLower.includes(trimmed)) {
          score += 200;
        } else {
          score += 50;
        }

        // Prefer recently opened files
        if (openPaths.has(f.path)) {
          score += 100;
        }

        // Shorter paths get slight boost
        score -= f.path.length * 0.1;

        return { file: f, score };
      })
      .filter((item): item is { file: RemoteFile; score: number } => item !== null)
      .sort((a, b) => b.score - a.score)
      .map((item) => item.file);

    return scored.slice(0, 100);
  }, [files, openFiles, query]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [filteredFiles.length, query]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedElement = listRef.current.children[selectedIndex] as HTMLElement;
    if (selectedElement) {
      selectedElement.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (filteredFiles.length > 0 ? (prev + 1) % filteredFiles.length : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) =>
        filteredFiles.length > 0 ? (prev - 1 + filteredFiles.length) % filteredFiles.length : 0
      );
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredFiles[selectedIndex]) {
        handleSelectFile(filteredFiles[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  const handleSelectFile = async (file: RemoteFile) => {
    if (!sessionId) return;
    try {
      await onOpenFile(sessionId, file);
      onClose();
    } catch (err: any) {
      console.error('Failed to open file:', err);
      toast.error(err?.message || 'Failed to open file');
    }
  };

  const renderFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'go':
      case 'py':
      case 'rs':
      case 'c':
      case 'cpp':
      case 'h':
      case 'html':
      case 'css':
      case 'json':
      case 'yaml':
      case 'yml':
      case 'toml':
      case 'sh':
      case 'bash':
        return <FileCode className="w-4 h-4 text-emerald-500 dark:text-emerald-400 shrink-0" />;
      case 'md':
      case 'txt':
      case 'log':
        return <FileText className="w-4 h-4 text-sky-500 dark:text-sky-400 shrink-0" />;
      case 'zip':
      case 'tar':
      case 'gz':
      case 'rar':
      case '7z':
        return <FileArchive className="w-4 h-4 text-amber-500 dark:text-amber-400 shrink-0" />;
      case 'png':
      case 'jpg':
      case 'jpeg':
      case 'svg':
      case 'gif':
      case 'webp':
        return <FileImage className="w-4 h-4 text-violet-500 dark:text-violet-400 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-zinc-400 dark:text-zinc-500 shrink-0" />;
    }
  };

  if (!isOpen) return null;

  const openPathsSet = new Set(openFiles.map((f) => f.path));

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-150 select-none"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl shadow-blue-500/10 overflow-hidden flex flex-col max-h-[70vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="shrink-0 text-zinc-400 dark:text-zinc-500">
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
            ) : (
              <Search className="w-4 h-4" />
            )}
          </div>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type a file name to open... (e.g. main.go, app.tsx)"
            className="flex-1 bg-transparent text-sm text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none border-none focus:ring-0 font-sans"
          />

          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
              title="Clear search"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            onClick={() => fetchFiles(query)}
            disabled={isLoading || !sessionId}
            className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 hover:bg-zinc-200/50 dark:hover:bg-zinc-800 disabled:opacity-40 transition-colors cursor-pointer"
            title="Refresh workspace index"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>

          <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 dark:text-zinc-500 shrink-0">
            <kbd className="px-1.5 py-0.5 rounded bg-zinc-200/60 dark:bg-zinc-800/80 font-mono text-[10px] text-zinc-600 dark:text-zinc-400">
              ESC
            </kbd>
            <span>to close</span>
          </div>
        </div>

        {/* Error Notification Banner if any */}
        {errorMessage && (
          <div className="px-4 py-2 bg-rose-50/80 dark:bg-rose-950/40 border-b border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 truncate">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="truncate">{errorMessage}</span>
            </div>
            <button
              onClick={() => fetchFiles(query)}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/60 dark:hover:bg-rose-800/80 text-rose-700 dark:text-rose-200 shrink-0 cursor-pointer transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* Results List */}
        <div ref={listRef} className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-900/60 p-1">
          {filteredFiles.length > 0 ? (
            filteredFiles.map((file, index) => {
              const isSelected = index === selectedIndex;
              const isOpenInTab = openPathsSet.has(file.path);
              const dirName = file.path.substring(0, file.path.lastIndexOf('/')) || '/';

              return (
                <div
                  key={file.path}
                  onClick={() => handleSelectFile(file)}
                  onMouseEnter={() => setSelectedIndex(index)}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer transition-colors text-xs ${
                    isSelected
                      ? 'bg-blue-500/10 dark:bg-blue-600/20 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-zinc-100 dark:hover:bg-zinc-900/70 text-zinc-700 dark:text-zinc-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-3">
                    {renderFileIcon(file.name)}
                    <span className="font-medium truncate text-zinc-900 dark:text-zinc-100">
                      {file.name}
                    </span>
                    <span className="text-[11px] text-zinc-400 dark:text-zinc-500 font-mono truncate">
                      {dirName}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isOpenInTab && (
                      <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/50">
                        <Clock className="w-2.5 h-2.5" />
                        Open
                      </span>
                    )}
                    {isSelected && (
                      <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono rounded bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800">
                        ↵ Enter
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          ) : (
            <div className="py-12 px-4 text-center">
              {isLoading ? (
                <div className="flex flex-col items-center justify-center gap-2 text-zinc-400 dark:text-zinc-500">
                  <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                  <p className="text-xs">Scanning remote workspace...</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 text-zinc-400 dark:text-zinc-500">
                  <Search className="w-6 h-6 stroke-[1.5] text-zinc-300 dark:text-zinc-600 mb-1" />
                  <p className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
                    {query ? `No files matching "${query}"` : 'No files found in remote workspace'}
                  </p>
                  <p className="text-[11px]">
                    {query
                      ? 'Try checking spelling or click refresh to re-index the remote workspace.'
                      : 'Click refresh or type a query to scan for files.'}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Navigation Bar */}
        <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/20 flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-3">
            <span>
              {filteredFiles.length} {filteredFiles.length === 1 ? 'file' : 'files'}
            </span>
            {files.length > 0 && (
              <span className="text-zinc-400 dark:text-zinc-600">
                ({files.length} indexed)
              </span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 font-mono text-[9px]">
                ↑↓
              </kbd>
              <span>navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-800 font-mono text-[9px]">
                ↵
              </kbd>
              <span>open</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
