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
  ChevronLeft,
  ChevronRight,
  ClipboardPaste,
  Columns2,
  Rows2,
  Disc,
  MoreHorizontal,
  ChevronDown,
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
import { ClipboardGetText, ClipboardSetText, EventsOn, EventsOff } from '../../wailsjs/runtime/runtime';
import { XTermTab } from './XTermTab';
import { SessionRecorderModal, RecordedEvent } from './SessionRecorderModal';

interface RemoteTerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentSession: connections.SessionSummary | null;
  onDirectoryChanged?: (newDir: string) => void;
  onCommandExecuted?: () => void;
  onOpenSnippets?: () => void;
  onActiveTabChange?: (tabId: string) => void;
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
  splitPaneId?: string;
  splitDirection?: 'horizontal' | 'vertical';
  activePaneId?: string;
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
  onCommandExecuted,
  onOpenSnippets,
  onActiveTabChange,
}) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (activeTabId) {
      onActiveTabChange?.(activeTabId);
    }
  }, [activeTabId, onActiveTabChange]);

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

  // Tabs sidebar width with drag-to-resize
  const [tabsSidebarWidth, setTabsSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('termlet_terminal_tabs_width');
      if (saved) {
        const val = parseInt(saved, 10);
        if (!isNaN(val) && val >= 80 && val <= 400) return val;
      }
    } catch {}
    return 130; // compact default width
  });
  const [isResizingSidebar, setIsResizingSidebar] = useState(false);
  const isResizingSidebarRef = useRef(false);

  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const activeTabButtonRef = useRef<HTMLDivElement>(null);
  const prevSessionIdRef = useRef<string | null>(null);
  const isCancelledRef = useRef<Record<string, boolean>>({});
  const nextTabNumRef = useRef<number>(1);
  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  type PanelTab = 'problems' | 'output' | 'debug' | 'terminal' | 'ports';
  const [activePanelTab, setActivePanelTab] = useState<PanelTab>('terminal');

  // Close more menu on outside click
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleOutside = () => setIsMoreMenuOpen(false);
    window.addEventListener('click', handleOutside);
    return () => window.removeEventListener('click', handleOutside);
  }, [isMoreMenuOpen]);

  // Derive active tab
  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0] || null;

  // Split pane handlers
  const handleSplitVertical = () => {
    if (!activeTab || !currentSession) return;
    if (activeTab.splitPaneId) {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, splitDirection: 'vertical' } : t))
      );
      toast.info('Switched to side-by-side split');
      return;
    }
    const paneId = `${activeTab.id}-pane-${Date.now().toString().slice(-4)}`;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? { ...t, splitPaneId: paneId, splitDirection: 'vertical', activePaneId: paneId }
          : t
      )
    );
    toast.success('Split terminal side-by-side');
  };

  const handleSplitHorizontal = () => {
    if (!activeTab || !currentSession) return;
    if (activeTab.splitPaneId) {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTab.id ? { ...t, splitDirection: 'horizontal' } : t))
      );
      toast.info('Switched to top-and-bottom split');
      return;
    }
    const paneId = `${activeTab.id}-pane-${Date.now().toString().slice(-4)}`;
    setTabs((prev) =>
      prev.map((t) =>
        t.id === activeTab.id
          ? { ...t, splitPaneId: paneId, splitDirection: 'horizontal', activePaneId: paneId }
          : t
      )
    );
    toast.success('Split terminal top-and-bottom');
  };

  const handleCloseSplitPane = (tabId: string) => {
    setTabs((prev) =>
      prev.map((t) => {
        if (t.id === tabId && t.splitPaneId) {
          if (currentSession) {
            CloseTerminal(currentSession.id, t.splitPaneId).catch(() => {});
          }
          return { ...t, splitPaneId: undefined, activePaneId: t.id };
        }
        return t;
      })
    );
    toast.info('Closed split pane');
  };

  // Session recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingEventsRef = useRef<RecordedEvent[]>([]);
  const recordingStartTimeRef = useRef<number>(0);
  const [recordedModalData, setRecordedModalData] = useState<{
    events: RecordedEvent[];
    duration: number;
    title: string;
  } | null>(null);

  // Timer while recording
  useEffect(() => {
    if (!isRecording) return;
    const interval = setInterval(() => {
      setRecordingSeconds((s) => s + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRecording]);

  // Capture terminal stream while recording
  useEffect(() => {
    if (!isRecording || !currentSession || !activeTab) return;
    const targetPaneId = activeTab.activePaneId || activeTab.id;
    const eventName = `terminal:data:${currentSession.id}:${targetPaneId}`;

    const unsub = EventsOn(eventName, (incoming: string) => {
      const now = performance.now();
      const offset = (now - recordingStartTimeRef.current) / 1000;
      recordingEventsRef.current.push({
        time: offset,
        type: 'o',
        data: incoming,
      });
    });

    return () => {
      unsub();
      EventsOff(eventName);
    };
  }, [isRecording, currentSession, activeTab]);

  const handleToggleRecording = () => {
    if (!isRecording) {
      if (!currentSession || !activeTab) return;
      recordingEventsRef.current = [];
      recordingStartTimeRef.current = performance.now();
      setRecordingSeconds(0);
      setIsRecording(true);
      toast.success('Session recording started', {
        description: 'Capturing terminal stream in Asciinema format',
      });
    } else {
      setIsRecording(false);
      const events = [...recordingEventsRef.current];
      const dur = recordingSeconds;
      setRecordedModalData({
        events,
        duration: dur,
        title: `${currentSession?.profile_name || currentSession?.host || 'Remote'} - ${activeTab?.title || 'Terminal'}`,
      });
    }
  };

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
        title: 'bash',
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

  // Ensure active tab is visible in tab bar
  useEffect(() => {
    if (activeTabButtonRef.current) {
      activeTabButtonRef.current.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'nearest',
      });
    }
  }, [activeTabId]);

  const handleTabsWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && tabsContainerRef.current) {
      tabsContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  const handleScrollTabs = (direction: 'left' | 'right') => {
    if (tabsContainerRef.current) {
      const offset = direction === 'left' ? -160 : 160;
      tabsContainerRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

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
      title: 'bash',
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

  const handleCopyAll = useCallback(() => {
    if (!activeTab) return;
    const text = activeTab.history
      .map((h) => {
        if (h.type === 'cmd') {
          return `${currentSession ? `${currentSession.username}@${currentSession.host}:` : ''}${shortenPath(h.cwd || '~')}$ ${h.text}`;
        }
        return h.text;
      })
      .join('\n');
    try {
      ClipboardSetText(text);
    } catch {
      navigator.clipboard?.writeText(text);
    }
    setCopied(true);
    toast.success('Terminal output copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  }, [activeTab, currentSession]);

  const pasteText = useCallback(
    (text: string) => {
      if (!text) return;
      if (text.includes('\n')) {
        const rawLines = text.split(/\r?\n/);
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
      } else {
        setTabs((prev) =>
          prev.map((t) => {
            if (t.id !== activeTabId) return t;
            return {
              ...t,
              commandInput: (t.commandInput || '') + text,
            };
          })
        );
      }
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
    },
    [activeTab, activeTabId]
  );

  // Context Menu State for right click inside terminal
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleClose = () => setContextMenu(null);
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };
    window.addEventListener('click', handleClose);
    window.addEventListener('contextmenu', handleClose);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('click', handleClose);
      window.removeEventListener('contextmenu', handleClose);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  const handleContextCopy = () => {
    const selection = window.getSelection()?.toString();
    if (selection && selection.length > 0) {
      try {
        ClipboardSetText(selection);
      } catch {
        navigator.clipboard?.writeText(selection);
      }
      toast.success('Selection copied');
    } else {
      handleCopyAll();
    }
    setContextMenu(null);
  };

  const handleContextPaste = async () => {
    try {
      let text = '';
      try {
        text = await ClipboardGetText();
      } catch {
        text = await navigator.clipboard?.readText();
      }
      if (text) {
        pasteText(text);
      }
    } catch {
      toast.error('Unable to paste text');
    }
    setContextMenu(null);
  };

  const handleContextSelectAll = () => {
    if (terminalScrollRef.current) {
      const range = document.createRange();
      range.selectNodeContents(terminalScrollRef.current);
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
    }
    setContextMenu(null);
  };

  const handleContextClear = () => {
    if (activeTabId) {
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, history: [] } : t))
      );
    }
    setContextMenu(null);
  };

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

      // Ctrl+Shift+C: Terminal copy active selection (standard terminal shortcut)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
        e.preventDefault();
        const selection = window.getSelection()?.toString();
        if (selection && selection.length > 0) {
          try {
            ClipboardSetText(selection);
          } catch {
            navigator.clipboard?.writeText(selection);
          }
          toast.success('Selection copied to clipboard');
        } else {
          handleCopyAll();
        }
        return;
      }

      // Ctrl+Shift+V: Terminal paste (standard terminal shortcut)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
        e.preventDefault();
        ClipboardGetText()
          .then((text) => {
            if (text) pasteText(text);
          })
          .catch(async () => {
            try {
              const text = await navigator.clipboard?.readText();
              if (text) pasteText(text);
            } catch {}
          });
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
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'c' || e.key === 'C')) {
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
  }, [isOpen, activeTab, activeTabId, handleCancelCommand, handleNewTab, handleCopyAll, pasteText]);

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
      onCommandExecuted?.();
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
    pasteText(text);
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

  const handleMouseDownResizeSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      isResizingSidebarRef.current = true;
      setIsResizingSidebar(true);

      const startX = e.clientX;
      const startWidth = tabsSidebarWidth;

      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizingSidebarRef.current) return;
        const deltaX = startX - moveEvent.clientX;
        const minAllowed = 80;
        const maxAllowed = Math.min(360, window.innerWidth * 0.45);
        const newW = Math.max(minAllowed, Math.min(startWidth + deltaX, maxAllowed));

        setTabsSidebarWidth(newW);
      };

      const handleMouseUp = (upEvent: MouseEvent) => {
        isResizingSidebarRef.current = false;
        setIsResizingSidebar(false);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);

        const deltaX = startX - upEvent.clientX;
        const minAllowed = 80;
        const maxAllowed = Math.min(360, window.innerWidth * 0.45);
        const finalW = Math.max(minAllowed, Math.min(startWidth + deltaX, maxAllowed));

        setTabsSidebarWidth(finalW);
        try {
          localStorage.setItem('termlet_terminal_tabs_width', String(finalW));
        } catch {}
      };

      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    },
    [tabsSidebarWidth]
  );

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

      {/* VS Code Panel Header Bar */}
      <div className="h-9 min-h-[35px] px-3 border-b border-zinc-800 bg-[#181818] flex items-center justify-between text-xs select-none shrink-0">
        {/* Left: VS Code Panel Tabs (PROBLEMS, OUTPUT, DEBUG CONSOLE, TERMINAL, PORTS) */}
        <div className="flex items-center gap-5 h-full min-w-0">
          {(
            [
              { id: 'problems', label: 'PROBLEMS' },
              { id: 'output', label: 'OUTPUT' },
              { id: 'debug', label: 'DEBUG CONSOLE' },
              { id: 'terminal', label: 'TERMINAL' },
              { id: 'ports', label: 'PORTS' },
            ] as const
          ).map((pt) => {
            const isActive = activePanelTab === pt.id;
            return (
              <button
                key={pt.id}
                onClick={() => setActivePanelTab(pt.id)}
                className={`h-full flex items-center text-[11px] font-sans tracking-wider uppercase transition-colors cursor-pointer relative pb-0.5 ${
                  isActive
                    ? 'text-zinc-100 font-semibold'
                    : 'text-zinc-400 hover:text-zinc-200 font-medium'
                }`}
              >
                <span>{pt.label}</span>
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-white rounded-full" />
                )}
              </button>
            );
          })}

          {isRecording && (
            <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-rose-500/20 text-rose-400 border border-rose-500/30 text-[10px] font-mono font-bold animate-pulse shrink-0 ml-2">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
              <span>
                REC {Math.floor(recordingSeconds / 60).toString().padStart(2, '0')}:{(recordingSeconds % 60).toString().padStart(2, '0')}
              </span>
            </div>
          )}
        </div>

        {/* Right: VS Code Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {/* New Terminal (+ ⌵) */}
          <button
            onClick={handleNewTab}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer flex items-center"
            title="New Terminal"
          >
            <Plus className="w-3.5 h-3.5" />
            <ChevronDown className="w-2.5 h-2.5 ml-0.5 text-zinc-500" />
          </button>

          {/* More Actions (...) */}
          <div className="relative">
            <button
              onClick={(e) => {
                e.stopPropagation();
                setIsMoreMenuOpen(!isMoreMenuOpen);
              }}
              className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
              title="More Actions..."
            >
              <MoreHorizontal className="w-3.5 h-3.5" />
            </button>

            {isMoreMenuOpen && (
              <div
                className="absolute right-0 top-full mt-1 w-48 bg-zinc-900 border border-zinc-700/80 rounded-lg shadow-2xl py-1 z-50 text-xs font-sans text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-100"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Record Toggle */}
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    handleToggleRecording();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Disc className={`w-3.5 h-3.5 ${isRecording ? 'text-rose-500 animate-pulse' : 'text-zinc-400'}`} />
                  <span>{isRecording ? 'Stop Recording' : 'Record Session (.cast)'}</span>
                </button>

                {/* Split Horizontal */}
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    handleSplitHorizontal();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Rows2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Split Terminal Down</span>
                </button>

                <div className="h-px bg-zinc-800 my-1" />

                {/* Clear Buffer */}
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    if (activeTabId) {
                      setTabs((prev) =>
                        prev.map((t) => (t.id === activeTabId ? { ...t, history: [] } : t))
                      );
                    }
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Clear Buffer</span>
                </button>

                {/* Copy All Output */}
                <button
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    handleCopyAll();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left"
                >
                  <Copy className="w-3.5 h-3.5 text-zinc-400" />
                  <span>Copy All Output</span>
                </button>
              </div>
            )}
          </div>

          {/* Separator | */}
          <div className="w-px h-3.5 bg-zinc-700/80 mx-1" />

          {/* Maximize / Restore Toggle [ ] */}
          <button
            onClick={handleToggleMaximize}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            title={isMaximized ? 'Restore Panel Size' : 'Maximize Panel Size'}
          >
            {isMaximized ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Square className="w-3.5 h-3.5" />
            )}
          </button>

          {/* Close Panel (X) */}
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-100 transition-colors cursor-pointer"
            title="Close Panel (Ctrl+`)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Panel Content Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden bg-[#181818]">
        {activePanelTab === 'terminal' && (
          <>
            {/* Left: Terminal Viewport */}
            <div className="flex-1 min-w-0 h-full relative overflow-hidden bg-zinc-950">
          {!currentSession && (
            <div className="flex items-center gap-2 text-zinc-500 py-4 px-4 font-mono text-xs">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span>No active SSH connection. Connect to a server to use the terminal.</span>
            </div>
          )}

          {currentSession &&
            tabs.map((tab) => {
              const isTabActive = tab.id === (activeTab?.id || tabs[0]?.id);

              if (!tab.splitPaneId) {
                return (
                  <XTermTab
                    key={tab.id}
                    sessionId={currentSession.id}
                    tabId={tab.id}
                    isActive={isTabActive}
                    onCommandExecuted={onCommandExecuted}
                    onFocus={() => {
                      setTabs((prev) =>
                        prev.map((t) => (t.id === tab.id ? { ...t, activePaneId: tab.id } : t))
                      );
                    }}
                  />
                );
              }

              // Render Split Panes for this tab
              return (
                <div
                  key={tab.id}
                  className={`w-full h-full ${isTabActive ? 'flex' : 'hidden'} ${
                    tab.splitDirection === 'horizontal' ? 'flex-col divide-y' : 'flex-row divide-x'
                  } divide-zinc-800 bg-zinc-950`}
                >
                  {/* Pane 1 */}
                  <div className="flex-1 min-w-0 min-h-0 relative flex flex-col">
                    <div className="px-2 py-0.5 bg-zinc-900/90 border-b border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between select-none">
                      <span className="font-mono flex items-center gap-1.5 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            !tab.activePaneId || tab.activePaneId === tab.id
                              ? 'bg-blue-500'
                              : 'bg-zinc-600'
                          }`}
                        />
                        <span>Pane 1: {tab.title}</span>
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 relative">
                      <XTermTab
                        sessionId={currentSession.id}
                        tabId={tab.id}
                        isActive={isTabActive}
                        onCommandExecuted={onCommandExecuted}
                        onFocus={() => {
                          setTabs((prev) =>
                            prev.map((t) => (t.id === tab.id ? { ...t, activePaneId: tab.id } : t))
                          );
                        }}
                      />
                    </div>
                  </div>

                  {/* Pane 2 */}
                  <div className="flex-1 min-w-0 min-h-0 relative flex flex-col">
                    <div className="px-2 py-0.5 bg-zinc-900/90 border-b border-zinc-800 text-[10px] text-zinc-400 flex items-center justify-between select-none">
                      <span className="font-mono flex items-center gap-1.5 truncate">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            tab.activePaneId === tab.splitPaneId ? 'bg-blue-500' : 'bg-zinc-600'
                          }`}
                        />
                        <span>Pane 2: Split Shell</span>
                      </span>
                      <button
                        onClick={() => handleCloseSplitPane(tab.id)}
                        className="p-0.5 rounded hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer"
                        title="Close split pane"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="flex-1 min-h-0 relative">
                      <XTermTab
                        sessionId={currentSession.id}
                        tabId={tab.splitPaneId}
                        isActive={isTabActive}
                        onCommandExecuted={onCommandExecuted}
                        onFocus={() => {
                          setTabs((prev) =>
                            prev.map((t) =>
                              t.id === tab.id ? { ...t, activePaneId: tab.splitPaneId } : t
                            )
                          );
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
        </div>

        {/* Vertical Drag Handle between Terminal Viewport and Tabs Sidebar */}
        <div
          onMouseDown={handleMouseDownResizeSidebar}
          className="w-1.5 -ml-1 hover:w-1.5 cursor-col-resize z-20 group flex items-center justify-center shrink-0 select-none relative"
          title="Drag to resize terminal tabs list"
        >
          <div
            className={`w-0.5 h-full transition-colors ${
              isResizingSidebar
                ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]'
                : 'bg-zinc-800 group-hover:bg-blue-500/80'
            }`}
          />
        </div>

        {/* Right: VS Code Style Vertical Terminal Tabs Sidebar */}
        <div
          style={{
            width: `${tabsSidebarWidth}px`,
            transition: isResizingSidebar ? 'none' : 'width 100ms ease-out',
          }}
          className="bg-[#181818] border-l border-zinc-800 flex flex-col shrink-0 select-none overflow-hidden"
        >
          <div className="flex-1 overflow-y-auto p-1 space-y-0.5">
            {tabs.map((tab) => {
              const isActive = tab.id === (activeTab?.id || tabs[0]?.id);
              return (
                <div
                  key={tab.id}
                  onClick={() => setActiveTabId(tab.id)}
                  onDoubleClick={() => {
                    setEditingTabId(tab.id);
                    setEditingTitle(tab.title);
                  }}
                  className={`group flex items-center justify-between px-1.5 py-1 rounded text-xs transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#2a2d2e] text-zinc-100 font-medium'
                      : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/40'
                  }`}
                  title={`${tab.title} (${tab.cwd})`}
                >
                  {/* Left: Terminal [>_] Badge and Title */}
                  <div className="flex items-center gap-1.5 truncate min-w-0 flex-1">
                    <span className="inline-flex items-center justify-center w-4 h-4 rounded border border-zinc-600 bg-zinc-900/80 text-[8.5px] font-bold text-zinc-300 shrink-0 font-mono leading-none">
                      &gt;_
                    </span>
                    {editingTabId === tab.id ? (
                      <input
                        type="text"
                        value={editingTitle}
                        autoFocus
                        onChange={(e) => setEditingTitle(e.target.value)}
                        onBlur={() => {
                          if (editingTitle.trim()) {
                            setTabs((prev) =>
                              prev.map((t) => (t.id === tab.id ? { ...t, title: editingTitle.trim() } : t))
                            );
                          }
                          setEditingTabId(null);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            if (editingTitle.trim()) {
                              setTabs((prev) =>
                                prev.map((t) => (t.id === tab.id ? { ...t, title: editingTitle.trim() } : t))
                              );
                            }
                            setEditingTabId(null);
                          }
                          if (e.key === 'Escape') setEditingTabId(null);
                        }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-zinc-950 text-zinc-100 px-1 py-0.5 rounded border border-blue-500 text-xs font-mono outline-hidden"
                      />
                    ) : (
                      <span className="truncate text-[11px] font-sans">{tab.title}</span>
                    )}
                  </div>

                  {/* Right: Inline Hover Actions (Split & Kill) */}
                  <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity ml-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSplitVertical();
                      }}
                      className="p-0.5 rounded hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-100 cursor-pointer"
                      title="Split Terminal"
                    >
                      <Columns2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCloseTab(e, tab.id);
                      }}
                      className="p-0.5 rounded hover:bg-zinc-700/80 text-zinc-400 hover:text-rose-300 cursor-pointer"
                      title="Kill Terminal (Del)"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
          </>
        )}

        {/* If Active Panel is PORTS */}
        {activePanelTab === 'ports' && (
          <div className="flex-1 min-w-0 h-full p-4 overflow-y-auto bg-[#181818] text-xs font-sans text-zinc-300">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div>
                <h3 className="text-sm font-semibold text-zinc-100">Forwarded Ports</h3>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Ports forwarded through active SSH connection ({currentSession?.username}@{currentSession?.host})
                </p>
              </div>
            </div>
            <div className="mt-4 border border-zinc-800 rounded-lg overflow-hidden bg-zinc-900/40">
              <div className="grid grid-cols-4 px-3 py-2 bg-zinc-900/80 text-zinc-400 font-medium text-[11px] border-b border-zinc-800">
                <span>Port</span>
                <span>Type</span>
                <span>Destination</span>
                <span>Status</span>
              </div>
              <div className="px-3 py-6 text-center text-zinc-500 font-mono text-xs">
                Configure Local, Remote (ssh -R), or Dynamic tunnels in the Port Forwarding tab.
              </div>
            </div>
          </div>
        )}

        {/* If Active Panel is OUTPUT */}
        {activePanelTab === 'output' && (
          <div className="flex-1 min-w-0 h-full p-3 overflow-y-auto bg-[#181818] font-mono text-xs text-zinc-300 select-text">
            <div className="text-zinc-500 mb-2 pb-1 border-b border-zinc-800 flex items-center justify-between">
              <span>[Termlet SSH Connection Log]</span>
              <span className="text-[11px] text-zinc-400">
                {currentSession ? `${currentSession.username}@${currentSession.host}:${currentSession.port}` : 'Disconnected'}
              </span>
            </div>
            {currentSession ? (
              <div className="space-y-1 text-zinc-400">
                <div><span className="text-blue-400">[INFO]</span> Session established: {currentSession.id}</div>
                <div><span className="text-blue-400">[INFO]</span> Remote Host: {currentSession.host}:{currentSession.port}</div>
                <div><span className="text-blue-400">[INFO]</span> Connected User: {currentSession.username}</div>
                <div><span className="text-emerald-400">[INFO]</span> Pseudo-terminal (PTY) interactive session online</div>
                <div><span className="text-zinc-500">[DEBUG]</span> CWD initialized to: {activeTab?.cwd || '~'}</div>
                <div><span className="text-emerald-400">[READY]</span> Terminal ready for commands</div>
              </div>
            ) : (
              <div className="text-zinc-500">No active SSH session log available.</div>
            )}
          </div>
        )}

        {/* If Active Panel is PROBLEMS */}
        {activePanelTab === 'problems' && (
          <div className="flex-1 min-w-0 h-full flex flex-col items-center justify-center bg-[#181818] text-xs text-zinc-500 p-4">
            <Check className="w-5 h-5 text-emerald-500/80 mb-2" />
            <span>No problems have been detected in the workspace.</span>
          </div>
        )}

        {/* If Active Panel is DEBUG CONSOLE */}
        {activePanelTab === 'debug' && (
          <div className="flex-1 min-w-0 h-full flex flex-col items-center justify-center bg-[#181818] text-xs text-zinc-500 p-4">
            <span>Debug console is not active.</span>
          </div>
        )}
      </div>

      {/* Session Recorder Modal */}
      {recordedModalData && (
        <SessionRecorderModal
          isOpen={true}
          onClose={() => setRecordedModalData(null)}
          sessionTitle={recordedModalData.title}
          cols={80}
          rows={24}
          events={recordedModalData.events}
          totalDurationSeconds={recordedModalData.duration}
        />
      )}
    </div>
  );
};
