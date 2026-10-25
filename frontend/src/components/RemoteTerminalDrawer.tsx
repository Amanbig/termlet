import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Terminal,
  Maximize2,
  Minimize2,
  X,
  Trash2,
  Copy,
  Check,
  Folder,
  Loader2,
  AlertCircle,
  Square,
  Plus,
  CopyPlus,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ExecRemoteCommand,
  CancelRemoteCommand,
  GetRemoteCwd,
  SetRemoteCwd,
  CloseTerminal,
} from '../../wailsjs/go/main/App';
import { connections } from '../../wailsjs/go/models';

interface RemoteTerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: connections.SessionSummary | null;
  onDirectoryChanged?: (newDir: string) => void;
}

interface HistoryEntry {
  id: string;
  type: 'cmd' | 'out' | 'err' | 'system';
  text: string;
  cwd?: string;
  timestamp?: number;
  exitCode?: number;
  isContinuation?: boolean;
}

export interface TerminalTab {
  id: string;
  title: string;
  cwd: string;
  history: HistoryEntry[];
  commandInput: string;
  continuationLines: string[];
  executing: boolean;
  cmdHistory: string[];
  historyIndex: number;
}

const MAX_HISTORY_ENTRIES = 200;
const MAX_CMD_HISTORY = 100;
const MAX_OUTPUT_CHARS = 100000;

function stripAnsi(str: string): string {
  if (!str) return '';
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}

function truncateOutput(str: string, max = MAX_OUTPUT_CHARS): string {
  if (!str) return '';
  if (str.length <= max) return str;
  return (
    str.slice(0, max) +
    '\n\n[...output truncated to 100,000 characters to conserve memory...]'
  );
}

export const RemoteTerminalDrawer: React.FC<RemoteTerminalDrawerProps> = ({
  isOpen,
  onClose,
  currentSession,
  onDirectoryChanged,
}) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Height state with drag-to-resize
  const [height, setHeight] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('termlet_terminal_height');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 120 && val <= 1600) return val;
      }
    } catch {}
    return 320;
  });
  const [isDragging, setIsDragging] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const preMaximizedHeightRef = useRef<number>(320);
  const isDraggingRef = useRef(false);

  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const prevSessionIdRef = useRef<string | null>(null);
  const isCancelledRef = useRef<Record<string, boolean>>({});
  const nextTabNumRef = useRef<number>(1);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Derive active tab
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || null;

  // Initialize or reset session history
  useEffect(() => {
    if (!currentSession) {
      setTabs([]);
      setActiveTabId('');
      prevSessionIdRef.current = null;
      nextTabNumRef.current = 1;
      return;
    }

    if (prevSessionIdRef.current !== currentSession.id) {
      prevSessionIdRef.current = currentSession.id;
      nextTabNumRef.current = 1;
      const initialDir = currentSession.start_directory || '~';
      const firstTabId = 'term-1';
      nextTabNumRef.current = 2;

      const firstTab: TerminalTab = {
        id: firstTabId,
        title: 'Terminal 1',
        cwd: initialDir,
        history: [
          {
            id: 'welcome-' + Date.now(),
            type: 'system',
            text: `Connected to ${currentSession.profile_name || currentSession.host} (${currentSession.username}@${currentSession.host}:${currentSession.port})\nType any remote shell command (e.g. ls, ps aux, uname -a) or "clear" to clear screen.`,
            timestamp: Date.now(),
          },
        ],
        commandInput: '',
        continuationLines: [],
        executing: false,
        cmdHistory: [],
        historyIndex: -1,
      };

      setTabs([firstTab]);
      setActiveTabId(firstTabId);

      // Fetch remote current working directory
      GetRemoteCwd(currentSession.id, firstTabId)
        .then((dir) => {
          if (dir) {
            setTabs((prev) =>
              prev.map((t) => (t.id === firstTabId ? { ...t, cwd: dir } : t))
            );
          }
        })
        .catch(() => {});
    }
  }, [currentSession]);

  // Auto-scroll when new output arrives or active tab changes
  useEffect(() => {
    if (isOpen && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [activeTab?.history, activeTab?.executing, activeTabId, isOpen]);

  // Auto-focus input when opened or tab switches
  useEffect(() => {
    if (isOpen && activeTab && !activeTab.executing) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, activeTabId, activeTab?.executing]);

  const shortenPath = (path: string) => {
    if (!path) return '~';
    const parts = path.split('/');
    if (parts.length > 4) {
      return parts[0] + '/…/' + parts.slice(-2).join('/');
    }
    return path;
  };

  // Create new terminal tab
  const handleNewTab = useCallback(() => {
    if (!currentSession) return;
    const tabNum = nextTabNumRef.current++;
    const newId = `term-${tabNum}`;
    const startDir = activeTab ? activeTab.cwd : (currentSession.start_directory || '~');

    const newTab: TerminalTab = {
      id: newId,
      title: `Terminal ${tabNum}`,
      cwd: startDir,
      history: [
        {
          id: 'welcome-' + Date.now(),
          type: 'system',
          text: `Terminal ${tabNum} opened for ${currentSession.profile_name || currentSession.host}`,
          timestamp: Date.now(),
        },
      ],
      commandInput: '',
      continuationLines: [],
      executing: false,
      cmdHistory: [],
      historyIndex: -1,
    };

    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(newId);
    SetRemoteCwd(currentSession.id, newId, startDir).catch(() => {});
    setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
  }, [currentSession, activeTab]);

  // Duplicate an existing terminal tab in its current directory
  const handleDuplicateTab = useCallback(
    (sourceTabId?: string) => {
      if (!currentSession) return;
      const src = tabs.find((t) => t.id === sourceTabId) || activeTab;
      const tabNum = nextTabNumRef.current++;
      const newId = `term-${tabNum}`;
      const startDir = src ? src.cwd : (currentSession.start_directory || '~');

      const newTab: TerminalTab = {
        id: newId,
        title: src ? `${src.title} (copy)` : `Terminal ${tabNum}`,
        cwd: startDir,
        history: [
          {
            id: 'welcome-' + Date.now(),
            type: 'system',
            text: `Terminal duplicated from ${src?.title || 'active tab'} in ${startDir}`,
            timestamp: Date.now(),
          },
        ],
        commandInput: '',
        continuationLines: [],
        executing: false,
        cmdHistory: src ? [...src.cmdHistory] : [],
        historyIndex: -1,
      };

      setTabs((prev) => [...prev, newTab]);
      setActiveTabId(newId);
      SetRemoteCwd(currentSession.id, newId, startDir).catch(() => {});
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
    },
    [currentSession, tabs, activeTab]
  );

  // Tab renaming
  const handleStartRenameTab = (e: React.MouseEvent, tab: TerminalTab) => {
    e.stopPropagation();
    setEditingTabId(tab.id);
    setEditingTitle(tab.title);
  };

  const handleSaveRenameTab = (tabId: string) => {
    const trimmed = editingTitle.trim();
    if (trimmed) {
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, title: trimmed } : t))
      );
    }
    setEditingTabId(null);
  };

  // Close a terminal tab
  const handleCloseTab = useCallback(
    (e: React.MouseEvent | null, tabId: string) => {
      if (e) e.stopPropagation();
      if (!currentSession) return;

      CloseTerminal(currentSession.id, tabId).catch(() => {});

      if (tabs.length <= 1) {
        onClose();
        return;
      }

      const idx = tabs.findIndex((t) => t.id === tabId);
      const remaining = tabs.filter((t) => t.id !== tabId);
      if (activeTabId === tabId) {
        const nextActive = remaining[Math.max(0, idx - 1)] || remaining[0];
        setActiveTabId(nextActive.id);
      }
      setTabs(remaining);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
    },
    [currentSession, tabs, activeTabId, onClose]
  );

  const handleCancelCommand = useCallback(async () => {
    if (!currentSession || !activeTab) return;
    const tabId = activeTab.id;
    isCancelledRef.current[tabId] = true;
    try {
      await CancelRemoteCommand(currentSession.id, tabId);
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                executing: false,
                continuationLines: [],
                history: [
                  ...t.history,
                  {
                    id: 'h-' + Math.random().toString(36).slice(2),
                    type: 'err' as const,
                    text: '^C (remote command canceled)',
                    timestamp: Date.now(),
                  },
                ].slice(-MAX_HISTORY_ENTRIES),
              }
            : t
        )
      );
    } catch {
      // Ignore
    } finally {
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
    }
  }, [currentSession, activeTab]);

  // Global keydown listeners for Ctrl+C, Ctrl+L, and tab shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+Shift+` or Ctrl+Shift+T creates new tab
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '`' || e.key === '~' || e.key === 'T' || e.key === 't')) {
        e.preventDefault();
        handleNewTab();
        return;
      }

      // Ctrl+L clears active terminal
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        if (activeTabId) {
          setTabs((prev) =>
            prev.map((t) => (t.id === activeTabId ? { ...t, history: [] } : t))
          );
        }
        return;
      }

      // Ctrl+C handling
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const selection = window.getSelection()?.toString();
        if (selection && selection.length > 0) {
          return; // Native copy
        }

        if (activeTab?.executing) {
          e.preventDefault();
          handleCancelCommand();
          return;
        }

        if (
          drawerRef.current?.contains(document.activeElement) ||
          document.activeElement === inputRef.current
        ) {
          e.preventDefault();
          if (activeTabId) {
            setTabs((prev) =>
              prev.map((t) => {
                if (t.id !== activeTabId) return t;
                const text = t.commandInput ? `${t.commandInput}^C` : '^C';
                return {
                  ...t,
                  commandInput: '',
                  continuationLines: [],
                  history: [
                    ...t.history,
                    {
                      id: 'h-' + Math.random().toString(36).slice(2),
                      type: 'cmd' as const,
                      text,
                      cwd: t.cwd,
                      isContinuation: (t.continuationLines || []).length > 0,
                      timestamp: Date.now(),
                    },
                  ],
                };
              })
            );
          }
          setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, activeTab, activeTabId, handleCancelCommand, handleNewTab]);

  const setCommandInput = useCallback(
    (val: string) => {
      if (!activeTabId) return;
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, commandInput: val } : t))
      );
    },
    [activeTabId]
  );

  const handleRunCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!activeTab || activeTab.executing || !currentSession) return;
    const tabId = activeTab.id;

    const currentLine = activeTab.commandInput;
    const contLines = activeTab.continuationLines || [];
    const hasContinuation = contLines.length > 0;
    const fullCommand = hasContinuation
      ? [...contLines, currentLine].join('\n')
      : currentLine;

    const trimmed = fullCommand.trim();

    // Check exit or logout command to close tab
    if (trimmed === 'exit' || trimmed === 'logout') {
      handleCloseTab(null, tabId);
      return;
    }

    if (!trimmed) {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                commandInput: '',
                continuationLines: [],
                historyIndex: -1,
                history: [
                  ...t.history,
                  {
                    id: 'h-' + Math.random().toString(36).slice(2),
                    type: 'cmd' as const,
                    text: '',
                    cwd: t.cwd,
                    timestamp: Date.now(),
                  },
                ],
              }
            : t
        )
      );
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
      return;
    }

    if (trimmed.toLowerCase() === 'clear') {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                history: [],
                commandInput: '',
                continuationLines: [],
                historyIndex: -1,
                cmdHistory: [...t.cmdHistory, 'clear'].slice(-MAX_CMD_HISTORY),
              }
            : t
        )
      );
      return;
    }

    // Build history entries for the command
    const cmdHistoryEntries: HistoryEntry[] = [];
    if (hasContinuation) {
      cmdHistoryEntries.push({
        id: 'h-' + Math.random().toString(36).slice(2),
        type: 'cmd' as const,
        text: contLines[0],
        cwd: activeTab.cwd,
        isContinuation: false,
        timestamp: Date.now(),
      });
      for (let i = 1; i < contLines.length; i++) {
        cmdHistoryEntries.push({
          id: 'h-' + Math.random().toString(36).slice(2) + '-' + i,
          type: 'cmd' as const,
          text: contLines[i],
          cwd: activeTab.cwd,
          isContinuation: true,
          timestamp: Date.now(),
        });
      }
      cmdHistoryEntries.push({
        id: 'h-' + Math.random().toString(36).slice(2) + '-final',
        type: 'cmd' as const,
        text: currentLine,
        cwd: activeTab.cwd,
        isContinuation: true,
        timestamp: Date.now(),
      });
    } else {
      cmdHistoryEntries.push({
        id: 'h-' + Math.random().toString(36).slice(2),
        type: 'cmd' as const,
        text: trimmed,
        cwd: activeTab.cwd,
        isContinuation: false,
        timestamp: Date.now(),
      });
    }

    // Mark tab as executing and add command to history
    setTabs((prev) =>
      prev.map((t) =>
        t.id === tabId
          ? {
              ...t,
              executing: true,
              commandInput: '',
              continuationLines: [],
              historyIndex: -1,
              cmdHistory: [...t.cmdHistory, fullCommand].slice(-MAX_CMD_HISTORY),
              history: [
                ...t.history,
                ...cmdHistoryEntries,
              ].slice(-MAX_HISTORY_ENTRIES),
            }
          : t
      )
    );

    try {
      const res = await ExecRemoteCommand(currentSession.id, tabId, fullCommand);
      if (isCancelledRef.current[tabId]) {
        return;
      }

      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== tabId) return t;

          const newCwd = res?.cwd && res.cwd !== t.cwd ? res.cwd : t.cwd;
          if (newCwd !== t.cwd && onDirectoryChanged) {
            onDirectoryChanged(newCwd);
          }

          const newEntries: HistoryEntry[] = [];
          if (res?.output) {
            const clean = stripAnsi(res.output);
            newEntries.push({
              id: 'h-' + Math.random().toString(36).slice(2),
              type: 'out',
              text: truncateOutput(clean),
              timestamp: Date.now(),
              exitCode: res.exit_code,
            });
          }

          if (res?.error) {
            newEntries.push({
              id: 'h-' + Math.random().toString(36).slice(2),
              type: 'err',
              text: res.error,
              timestamp: Date.now(),
              exitCode: res.exit_code,
            });
          } else if (!res?.output && res?.exit_code !== 0 && res?.exit_code !== undefined) {
            newEntries.push({
              id: 'h-' + Math.random().toString(36).slice(2),
              type: 'err',
              text: `[Process exited with code ${res.exit_code}]`,
              timestamp: Date.now(),
              exitCode: res.exit_code,
            });
          }

          return {
            ...t,
            cwd: newCwd,
            history: [...t.history, ...newEntries].slice(-MAX_HISTORY_ENTRIES),
          };
        })
      );
    } catch (err: any) {
      if (!isCancelledRef.current[tabId]) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === tabId
              ? {
                  ...t,
                  history: [
                    ...t.history,
                    {
                      id: 'h-' + Math.random().toString(36).slice(2),
                      type: 'err' as const,
                      text: `Execution failed: ${err?.message || err}`,
                      timestamp: Date.now(),
                    },
                  ].slice(-MAX_HISTORY_ENTRIES),
                }
              : t
          )
        );
      }
    } finally {
      delete isCancelledRef.current[tabId];
      setTabs((prev) =>
        prev.map((t) => (t.id === tabId ? { ...t, executing: false } : t))
      );
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
    }
  };

  const handlePasteInput = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text || !text.includes('\n')) return;

    e.preventDefault();
    const rawLines = text.split(/\r?\n/);
    if (rawLines.length <= 1) return;

    const firstLine = (activeTab?.commandInput || '') + rawLines[0];
    const allLines = [firstLine, ...rawLines.slice(1)];
    const prevLines = allLines.slice(0, -1);
    const lastLine = allLines[allLines.length - 1];

    setTabs((prev) =>
      prev.map((t) => {
        if (t.id !== activeTabId) return t;
        return {
          ...t,
          continuationLines: [...(t.continuationLines || []), ...prevLines],
          commandInput: lastLine,
        };
      })
    );
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!activeTab) return;

    // Shift+Enter or trailing backslash \ continues command onto next line
    if (e.key === 'Enter') {
      const rawVal = activeTab.commandInput;
      const isShift = e.shiftKey;
      const endsWithBackslash = rawVal.trimEnd().endsWith('\\');

      if (isShift || endsWithBackslash) {
        e.preventDefault();
        const lineToSave = rawVal;
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== activeTab.id) return t;
            return {
              ...t,
              continuationLines: [...(t.continuationLines || []), lineToSave],
              commandInput: '',
            };
          })
        );
        return;
      }
      return;
    }

    // Backspace on empty input pops previous continuation line
    if (
      e.key === 'Backspace' &&
      activeTab.commandInput === '' &&
      (activeTab.continuationLines || []).length > 0
    ) {
      e.preventDefault();
      const lines = activeTab.continuationLines;
      const lastLine = lines[lines.length - 1];
      setTabs((prev) =>
        prev.map((t) => {
          if (t.id !== activeTab.id) return t;
          return {
            ...t,
            continuationLines: t.continuationLines.slice(0, -1),
            commandInput: lastLine,
          };
        })
      );
      return;
    }

    // Tab key: prevent focus loss from terminal input
    if (e.key === 'Tab') {
      e.preventDefault();
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeTab.cmdHistory.length === 0) return;
      const nextIdx = activeTab.historyIndex + 1;
      if (nextIdx < activeTab.cmdHistory.length) {
        const histCmd = activeTab.cmdHistory[activeTab.cmdHistory.length - 1 - nextIdx];
        const lines = histCmd.split('\n');
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  historyIndex: nextIdx,
                  continuationLines: lines.length > 1 ? lines.slice(0, -1) : [],
                  commandInput: lines[lines.length - 1],
                }
              : t
          )
        );
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (activeTab.historyIndex > 0) {
        const nextIdx = activeTab.historyIndex - 1;
        const histCmd = activeTab.cmdHistory[activeTab.cmdHistory.length - 1 - nextIdx];
        const lines = histCmd.split('\n');
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  historyIndex: nextIdx,
                  continuationLines: lines.length > 1 ? lines.slice(0, -1) : [],
                  commandInput: lines[lines.length - 1],
                }
              : t
          )
        );
      } else if (activeTab.historyIndex === 0) {
        setTabs((prev) =>
          prev.map((t) =>
            t.id === activeTab.id
              ? {
                  ...t,
                  historyIndex: -1,
                  continuationLines: [],
                  commandInput: '',
                }
              : t
          )
        );
      }
    }
  };

  const handleToggleMaximize = useCallback(() => {
    setIsMaximized((prev) => {
      if (!prev) {
        preMaximizedHeightRef.current = height;
        return true;
      }
      return false;
    });
  }, [height]);

  const handleMouseDownResize = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isDraggingRef.current = true;
      setIsDragging(true);

      const startY = e.clientY;
      const startHeight = drawerRef.current ? drawerRef.current.clientHeight : height;

      if (isMaximized) {
        setIsMaximized(false);
      }

      document.body.style.cursor = 'row-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isDraggingRef.current) return;
        const deltaY = startY - moveEvent.clientY;
        const parentHeight =
          drawerRef.current?.parentElement?.clientHeight || window.innerHeight;
        const maxAllowed = Math.max(180, parentHeight - 50);
        const minAllowed = 100;
        const newH = Math.max(minAllowed, Math.min(startHeight + deltaY, maxAllowed));

        setHeight(newH);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        isDraggingRef.current = false;
        setIsDragging(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        const deltaY = startY - upEvent.clientY;
        const parentHeight =
          drawerRef.current?.parentElement?.clientHeight || window.innerHeight;
        const maxAllowed = Math.max(180, parentHeight - 50);
        const minAllowed = 100;
        const finalH = Math.max(minAllowed, Math.min(startHeight + deltaY, maxAllowed));

        setHeight(finalH);
        try {
          localStorage.setItem('termlet_terminal_height', String(finalH));
        } catch {}
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [height, isMaximized]
  );

  const handleCopyAll = () => {
    if (!activeTab) return;
    const text = activeTab.history
      .map((h) => {
        if (h.type === 'cmd') {
          return `${currentSession ? `${currentSession.username}@${currentSession.host}:` : ''}${shortenPath(h.cwd || '~')}$ ${h.text}`;
        }
        return h.text;
      })
      .join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Terminal output copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      ref={drawerRef}
      style={{
        height: isMaximized ? '85%' : `${height}px`,
        transition: isDragging ? 'none' : 'height 150ms cubic-bezier(0.16, 1, 0.3, 1)',
      }}
      className="absolute bottom-0 left-0 right-0 z-30 flex flex-col bg-zinc-950/95 dark:bg-zinc-950/98 text-zinc-100 border-t border-zinc-800 shadow-2xl backdrop-blur-md select-text"
    >
      {/* Resizable Top Border Handle (VS Code style drag-to-resize) */}
      <div
        onMouseDown={handleMouseDownResize}
        onDoubleClick={handleToggleMaximize}
        className="absolute -top-1.5 left-0 right-0 h-3 cursor-row-resize z-40 group flex items-center justify-center select-none"
        title="Drag to resize, double-click to toggle maximize"
      >
        <div
          className={`w-full h-0.5 transition-colors ${
            isDragging
              ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
              : 'bg-transparent group-hover:bg-blue-500/70'
          }`}
        />
      </div>

      {/* Header Bar with Terminal Tabs */}
      <div className="flex items-center justify-between px-2 py-1 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none gap-2 min-h-[34px]">
        {/* Left: Terminal Tab Strip & New Tab Button */}
        <div className="flex items-center gap-1 min-w-0 overflow-x-auto scrollbar-none py-0.5">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => {
                  setActiveTabId(tab.id);
                  setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
                }}
                className={`group flex items-center gap-1.5 px-2.5 py-1 rounded text-xs cursor-pointer transition-colors shrink-0 ${
                  isActive
                    ? 'bg-zinc-800/90 text-zinc-100 font-semibold border border-zinc-700/70 shadow-xs'
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
                }`}
                title={`${tab.title} (${tab.cwd})`}
              >
                <Terminal className={`w-3 h-3 ${isActive ? 'text-emerald-400' : 'text-zinc-500'}`} />
                {editingTabId === tab.id ? (
                  <input
                    type="text"
                    value={editingTitle}
                    autoFocus
                    onChange={(e) => setEditingTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.stopPropagation();
                        handleSaveRenameTab(tab.id);
                      } else if (e.key === 'Escape') {
                        e.stopPropagation();
                        setEditingTabId(null);
                      }
                    }}
                    onBlur={() => handleSaveRenameTab(tab.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="bg-zinc-950 border border-blue-500 rounded px-1 py-0 text-xs text-zinc-100 outline-none w-20"
                  />
                ) : (
                  <span
                    onDoubleClick={(e) => handleStartRenameTab(e, tab)}
                    className="truncate max-w-[120px]"
                    title="Double-click to rename"
                  >
                    {tab.title}
                  </span>
                )}

                {tab.executing && (
                  <span
                    className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse shrink-0"
                    title="Running remote command"
                  />
                )}

                {tabs.length > 1 && (
                  <button
                    onClick={(e) => handleCloseTab(e, tab.id)}
                    className="p-0.5 rounded hover:bg-zinc-700 text-zinc-500 hover:text-zinc-200 opacity-60 group-hover:opacity-100 transition-opacity ml-0.5 cursor-pointer"
                    title="Close Terminal"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                )}
              </div>
            );
          })}

          {/* New Terminal Tab Button */}
          <button
            onClick={handleNewTab}
            className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 text-xs transition-colors cursor-pointer shrink-0"
            title="New Terminal Tab (Ctrl+Shift+`)"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>

          {/* Duplicate Active Tab Button */}
          <button
            onClick={() => handleDuplicateTab(activeTab?.id)}
            className="flex items-center gap-1 px-1.5 py-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 text-xs transition-colors cursor-pointer shrink-0"
            title="Duplicate Active Tab in Current CWD"
          >
            <CopyPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Active Session Info & Action Controls */}
        <div className="flex items-center gap-1.5 shrink-0">
          {currentSession && activeTab && (
            <div className="hidden sm:flex items-center gap-1 text-[11px]">
              <span className="px-1.5 py-0.5 rounded bg-zinc-800/70 text-zinc-300 font-mono text-[10px] border border-zinc-700/50 truncate max-w-[180px]">
                {currentSession.username}@{currentSession.host}
              </span>
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/70 text-zinc-400 font-mono text-[10px] border border-zinc-700/40 truncate max-w-[180px]"
                title={`CWD: ${activeTab.cwd}`}
              >
                <Folder className="w-2.5 h-2.5 text-amber-400/80 shrink-0" />
                <span className="truncate">{shortenPath(activeTab.cwd)}</span>
              </div>
            </div>
          )}

          {activeTab?.executing && (
            <button
              onClick={handleCancelCommand}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/70 text-rose-300 hover:bg-rose-900 text-[11px] font-medium transition-colors cursor-pointer mr-1"
              title="Cancel running command (Ctrl+C)"
            >
              <Square className="w-2.5 h-2.5 fill-rose-300" />
              <span>Cancel</span>
            </button>
          )}

          <button
            onClick={() => {
              if (activeTabId) {
                setTabs((prev) =>
                  prev.map((t) => (t.id === activeTabId ? { ...t, history: [] } : t))
                );
              }
            }}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Clear terminal (Ctrl+L)"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleCopyAll}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Copy all output"
          >
            {copied ? (
              <Check className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Copy className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={handleToggleMaximize}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title={isMaximized ? 'Restore height' : 'Maximize terminal'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>

          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors cursor-pointer"
            title="Close terminal (Ctrl+`)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output & Inline Command Stream for Active Tab */}
      <div
        ref={terminalScrollRef}
        onClick={() => {
          const selection = window.getSelection()?.toString();
          if (!selection) {
            inputRef.current?.focus({ preventScroll: true });
          }
        }}
        className="flex-1 overflow-y-auto px-4 py-2 pb-5 font-mono text-xs leading-relaxed space-y-1.5 cursor-text divide-y-0"
      >
        {!currentSession && (
          <div className="flex items-center gap-2 text-zinc-500 py-4">
            <AlertCircle className="w-4 h-4 text-amber-400" />
            <span>No active SSH connection. Connect to a server to use the terminal.</span>
          </div>
        )}

        {activeTab &&
          activeTab.history.map((item) => {
            if (item.type === 'system') {
              return (
                <div
                  key={item.id}
                  className="text-zinc-500 border-l-2 border-emerald-500/60 pl-2.5 py-1 my-1 text-[11px] whitespace-pre-wrap select-all font-sans"
                >
                  {item.text}
                </div>
              );
            }

            if (item.type === 'cmd') {
              return (
                <div
                  key={item.id}
                  className={`flex items-start gap-1.5 text-zinc-100 font-mono text-xs ${
                    item.isContinuation ? 'pl-2' : 'pt-1'
                  }`}
                >
                  {item.isContinuation ? (
                    <span className="text-zinc-500 font-bold select-none shrink-0">
                      &gt;
                    </span>
                  ) : (
                    <span className="text-emerald-400 font-bold select-none shrink-0">
                      {currentSession ? `${currentSession.username}@${currentSession.host}` : 'ssh'}:
                      <span className="text-blue-400 font-normal">{shortenPath(item.cwd || '~')}</span>$
                    </span>
                  )}
                  <span className="text-zinc-100 font-semibold select-all break-all">
                    {item.text}
                  </span>
                </div>
              );
            }

            if (item.type === 'err') {
              return (
                <div
                  key={item.id}
                  className="text-rose-400/90 whitespace-pre-wrap break-all pl-3 border-l border-rose-500/40 text-[11px] select-all"
                >
                  {item.text}
                </div>
              );
            }

            return (
              <div
                key={item.id}
                className={`whitespace-pre-wrap break-all pl-3 select-all text-[11px] ${
                  item.exitCode !== undefined && item.exitCode !== 0
                    ? 'text-rose-300/90 border-l border-rose-500/30'
                    : 'text-zinc-300'
                }`}
              >
                {item.text}
              </div>
            );
          })}

        {activeTab?.executing && (
          <div className="flex items-center gap-2 text-amber-400/90 py-1 text-[11px] pl-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="italic">Running remote command...</span>
          </div>
        )}

        {/* Active Inline Command Prompt */}
        {currentSession && activeTab && !activeTab.executing && (
          <div className="flex flex-col gap-0.5 text-zinc-200 pt-1">
            {activeTab.continuationLines.length > 0 && (
              <>
                <div className="flex items-start gap-1.5 text-zinc-100 font-mono text-xs">
                  <span className="text-emerald-400 font-bold select-none shrink-0">
                    {currentSession.username}@{currentSession.host}:
                    <span className="text-blue-400 font-normal">{shortenPath(activeTab.cwd)}</span>$
                  </span>
                  <span className="text-zinc-100 select-all break-all">
                    {activeTab.continuationLines[0]}
                  </span>
                </div>
                {activeTab.continuationLines.slice(1).map((line, idx) => (
                  <div key={idx} className="flex items-start gap-1.5 text-zinc-100 font-mono text-xs pl-2">
                    <span className="text-zinc-500 font-bold select-none shrink-0">&gt;</span>
                    <span className="text-zinc-100 select-all break-all">{line}</span>
                  </div>
                ))}
              </>
            )}

            <form
              onSubmit={handleRunCommand}
              className={`flex items-start gap-1.5 text-zinc-200 ${
                activeTab.continuationLines.length > 0 ? 'pl-2' : ''
              }`}
            >
              {activeTab.continuationLines.length > 0 ? (
                <span className="text-zinc-500 font-bold select-none shrink-0">&gt;</span>
              ) : (
                <span className="text-emerald-400 font-bold select-none shrink-0">
                  {currentSession.username}@{currentSession.host}:
                  <span className="text-blue-400 font-normal">{shortenPath(activeTab.cwd)}</span>$
                </span>
              )}
              <input
                ref={inputRef}
                type="text"
                value={activeTab.commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDownInput}
                onPaste={handlePasteInput}
                className="flex-1 min-w-[60px] bg-transparent border-0 outline-none text-zinc-100 font-mono text-xs p-0 m-0 shadow-none focus:outline-none focus:ring-0 focus:border-none caret-emerald-400"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck="false"
                autoFocus
              />
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
