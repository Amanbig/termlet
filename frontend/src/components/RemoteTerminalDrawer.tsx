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
} from 'lucide-react';
import { toast } from 'sonner';
import {
  ExecRemoteCommand,
  CancelRemoteCommand,
  GetRemoteCwd,
  SetRemoteCwd,
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
  const [cwd, setCwd] = useState('~');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [executing, setExecuting] = useState(false);
  const [cmdHistory, setCmdHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [isMaximized, setIsMaximized] = useState(false);
  const [copied, setCopied] = useState(false);

  const terminalScrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const prevSessionIdRef = useRef<string | null>(null);
  const isCancelledRef = useRef(false);

  // Initialize or reset session history
  useEffect(() => {
    if (!currentSession) {
      setHistory([]);
      setCwd('~');
      prevSessionIdRef.current = null;
      return;
    }

    if (prevSessionIdRef.current !== currentSession.id) {
      prevSessionIdRef.current = currentSession.id;
      const initialDir = currentSession.start_directory || '~';
      setCwd(initialDir);
      setHistory([
        {
          id: 'welcome-' + Date.now(),
          type: 'system',
          text: `Connected to ${currentSession.profile_name || currentSession.host} (${currentSession.username}@${currentSession.host}:${currentSession.port})\nType any remote shell command (e.g. ls, ps aux, uname -a) or "clear" to clear screen.`,
          timestamp: Date.now(),
        },
      ]);

      // Fetch remote current working directory
      GetRemoteCwd(currentSession.id)
        .then((dir) => {
          if (dir) setCwd(dir);
        })
        .catch(() => {});
    }
  }, [currentSession]);

  // Auto-scroll when new output arrives
  useEffect(() => {
    if (isOpen && terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [history, executing, isOpen]);

  // Auto-focus input when opened
  useEffect(() => {
    if (isOpen && !executing) {
      const timer = setTimeout(() => {
        inputRef.current?.focus({ preventScroll: true });
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isOpen, executing]);

  const appendHistory = useCallback((entry: Omit<HistoryEntry, 'id'>) => {
    setHistory((prev) => {
      const next = [...prev, { ...entry, id: 'h-' + Math.random().toString(36).slice(2) }];
      return next.length > MAX_HISTORY_ENTRIES ? next.slice(-MAX_HISTORY_ENTRIES) : next;
    });
  }, []);

  const appendCmdHistory = useCallback((cmd: string) => {
    setCmdHistory((prev) => {
      const next = [...prev, cmd];
      return next.length > MAX_CMD_HISTORY ? next.slice(-MAX_CMD_HISTORY) : next;
    });
  }, []);

  const shortenPath = (path: string) => {
    if (!path) return '~';
    const parts = path.split('/');
    if (parts.length > 4) {
      return parts[0] + '/…/' + parts.slice(-2).join('/');
    }
    return path;
  };

  const handleCancelCommand = useCallback(async () => {
    if (!currentSession) return;
    isCancelledRef.current = true;
    try {
      await CancelRemoteCommand(currentSession.id);
      appendHistory({
        type: 'err',
        text: '^C (remote command canceled)',
        timestamp: Date.now(),
      });
    } catch {
      // Ignore
    } finally {
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
    }
  }, [currentSession, appendHistory]);

  // Global keydown listeners for Ctrl+C and shortcuts
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ctrl+L clears terminal
      if ((e.ctrlKey || e.metaKey) && (e.key === 'l' || e.key === 'L')) {
        e.preventDefault();
        setHistory([]);
        return;
      }

      // Ctrl+C handling
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        const selection = window.getSelection()?.toString();
        if (selection && selection.length > 0) {
          return; // Native copy
        }

        if (executing) {
          e.preventDefault();
          handleCancelCommand();
          return;
        }

        if (
          drawerRef.current?.contains(document.activeElement) ||
          document.activeElement === inputRef.current
        ) {
          e.preventDefault();
          appendHistory({
            type: 'cmd',
            text: commandInput ? `${commandInput}^C` : '^C',
            cwd,
            timestamp: Date.now(),
          });
          setCommandInput('');
          setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 30);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, executing, commandInput, cwd, handleCancelCommand, appendHistory]);

  const handleRunCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (executing || !currentSession) return;
    const cmdStr = commandInput.trim();

    if (!cmdStr) {
      appendHistory({
        type: 'cmd',
        text: '',
        cwd,
        timestamp: Date.now(),
      });
      setCommandInput('');
      setHistoryIndex(-1);
      return;
    }

    if (cmdStr.toLowerCase() === 'clear') {
      setHistory([]);
      setCommandInput('');
      appendCmdHistory('clear');
      setHistoryIndex(-1);
      return;
    }

    setExecuting(true);
    appendHistory({
      type: 'cmd',
      text: cmdStr,
      cwd,
      timestamp: Date.now(),
    });
    appendCmdHistory(cmdStr);
    setHistoryIndex(-1);
    setCommandInput('');

    try {
      const res = await ExecRemoteCommand(currentSession.id, cmdStr);
      if (isCancelledRef.current) {
        return;
      }
      if (res) {
        if (res.cwd && res.cwd !== cwd) {
          setCwd(res.cwd);
          if (onDirectoryChanged) {
            onDirectoryChanged(res.cwd);
          }
        }

        if (res.output) {
          const clean = stripAnsi(res.output);
          appendHistory({
            type: 'out',
            text: truncateOutput(clean),
            timestamp: Date.now(),
            exitCode: res.exit_code,
          });
        }

        if (res.error) {
          appendHistory({
            type: 'err',
            text: res.error,
            timestamp: Date.now(),
            exitCode: res.exit_code,
          });
        } else if (!res.output && res.exit_code !== 0) {
          appendHistory({
            type: 'err',
            text: `[Process exited with code ${res.exit_code}]`,
            timestamp: Date.now(),
            exitCode: res.exit_code,
          });
        }
      }
    } catch (err: any) {
      if (!isCancelledRef.current) {
        appendHistory({
          type: 'err',
          text: `Execution failed: ${err?.message || err}`,
          timestamp: Date.now(),
        });
      }
    } finally {
      isCancelledRef.current = false;
      setExecuting(false);
      setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 40);
    }
  };

  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (cmdHistory.length === 0) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx < cmdHistory.length) {
        setHistoryIndex(nextIdx);
        setCommandInput(cmdHistory[cmdHistory.length - 1 - nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommandInput(cmdHistory[cmdHistory.length - 1 - nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      }
    }
  };

  const handleCopyAll = () => {
    const text = history
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
      className={`absolute bottom-0 left-0 right-0 z-30 flex flex-col bg-zinc-950/95 dark:bg-zinc-950/98 text-zinc-100 border-t border-zinc-800 shadow-2xl backdrop-blur-md transition-all duration-200 select-text ${
        isMaximized ? 'h-[85%]' : 'h-80 sm:h-96 max-h-[85%]'
      }`}
    >
      {/* Header Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-zinc-900 border-b border-zinc-800 shrink-0 select-none">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-zinc-200">
            <Terminal className="w-3.5 h-3.5 text-emerald-400" />
            <span>Terminal</span>
          </div>

          {currentSession && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono font-medium border border-zinc-700/60 truncate max-w-[200px]">
                {currentSession.username}@{currentSession.host}
              </span>
              <div
                className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/80 text-zinc-400 font-mono text-[10px] border border-zinc-700/40 truncate max-w-[240px]"
                title={`Remote CWD: ${cwd}`}
              >
                <Folder className="w-2.5 h-2.5 text-amber-400/80 shrink-0" />
                <span className="truncate">{shortenPath(cwd)}</span>
              </div>
            </div>
          )}

          {executing && (
            <div className="flex items-center gap-1 text-[11px] text-amber-400 animate-pulse">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Running...</span>
            </div>
          )}
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1 shrink-0">
          {executing && (
            <button
              onClick={handleCancelCommand}
              className="flex items-center gap-1 px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800/70 text-rose-300 hover:bg-rose-900 text-[11px] font-medium transition-colors cursor-pointer mr-1.5"
              title="Cancel running command (Ctrl+C)"
            >
              <Square className="w-2.5 h-2.5 fill-rose-300" />
              <span>Cancel</span>
            </button>
          )}

          <button
            onClick={() => setHistory([])}
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
            onClick={() => setIsMaximized((prev) => !prev)}
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

      {/* Terminal Output & Inline Command Stream */}
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

        {history.map((item) => {
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
              <div key={item.id} className="flex items-start gap-1.5 text-zinc-200 pt-1">
                <span className="text-emerald-400 font-bold select-none shrink-0">
                  {currentSession ? `${currentSession.username}@${currentSession.host}` : 'ssh'}:
                  <span className="text-blue-400 font-normal">{shortenPath(item.cwd || '~')}</span>$
                </span>
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

        {executing && (
          <div className="flex items-center gap-2 text-amber-400/90 py-1 text-[11px] pl-1">
            <Loader2 className="w-3 h-3 animate-spin" />
            <span className="italic">Running remote command...</span>
          </div>
        )}

        {/* Active Inline Command Prompt */}
        {currentSession && !executing && (
          <form
            onSubmit={handleRunCommand}
            className="flex items-start gap-1.5 text-zinc-200 pt-1"
          >
            <span className="text-emerald-400 font-bold select-none shrink-0">
              {currentSession.username}@{currentSession.host}:
              <span className="text-blue-400 font-normal">{shortenPath(cwd)}</span>$
            </span>
            <input
              ref={inputRef}
              type="text"
              value={commandInput}
              onChange={(e) => setCommandInput(e.target.value)}
              onKeyDown={handleKeyDownInput}
              className="flex-1 min-w-[60px] bg-transparent border-0 outline-none text-zinc-100 font-mono text-xs p-0 m-0 shadow-none focus:outline-none focus:ring-0 focus:border-none caret-emerald-400"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck="false"
              autoFocus
            />
          </form>
        )}
      </div>
    </div>
  );
};
