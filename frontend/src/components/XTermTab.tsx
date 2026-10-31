import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { EventsOn, EventsOff, ClipboardGetText, ClipboardSetText } from '../../wailsjs/runtime/runtime';
import {
  StartTerminalSession,
  SendTerminalInput,
  ResizeTerminal,
  CloseTerminal,
} from '../../wailsjs/go/main/App';
import { Copy, ClipboardPaste, Square, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface XTermTabProps {
  sessionId: string;
  tabId: string;
  isActive: boolean;
  onCommandExecuted?: () => void;
}

export const XTermTab: React.FC<XTermTabProps> = ({
  sessionId,
  tabId,
  isActive,
  onCommandExecuted,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const lastSelectionRef = useRef<string>('');
  const copyActionRef = useRef<() => void>(() => {});
  const pasteActionRef = useRef<() => void>(() => {});
  const menuRef = useRef<HTMLDivElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const copySelectionOrBuffer = useCallback(async () => {
    let sel = termRef.current?.getSelection() || lastSelectionRef.current;
    if (!sel) {
      const buf = termRef.current?.buffer.active;
      if (buf) {
        const lines: string[] = [];
        for (let i = 0; i < buf.length; i++) {
          const line = buf.getLine(i);
          if (line) lines.push(line.translateToString(true));
        }
        sel = lines.join('\n').trimEnd();
      }
    }

    if (sel && sel.length > 0) {
      try {
        await ClipboardSetText(sel);
      } catch {
        try {
          await navigator.clipboard.writeText(sel);
        } catch {}
      }
      toast.success('Copied to clipboard');
    }
    setContextMenu(null);
  }, []);

  const pasteClipboardText = useCallback(async () => {
    try {
      let text = '';
      try {
        text = await ClipboardGetText();
      } catch {
        try {
          text = await navigator.clipboard?.readText();
        } catch {}
      }
      if (text && termRef.current) {
        SendTerminalInput(sessionId, tabId, text).catch(() => {});
      }
    } catch {
      toast.error('Unable to paste text');
    }
    setContextMenu(null);
  }, [sessionId, tabId]);

  copyActionRef.current = copySelectionOrBuffer;
  pasteActionRef.current = pasteClipboardText;

  // Initialize xterm instance
  useEffect(() => {
    if (!containerRef.current || !sessionId || !tabId) return;

    const term = new Terminal({
      fontFamily: "'JetBrains Mono Variable', 'JetBrains Mono', Menlo, Monaco, monospace",
      fontSize: 12.5,
      lineHeight: 1.25,
      cursorBlink: true,
      cursorStyle: 'block',
      cursorInactiveStyle: 'outline',
      allowTransparency: true,
      scrollback: 10000,
      theme: {
        background: '#09090b',
        foreground: '#f4f4f5',
        cursor: '#34d399',
        cursorAccent: '#09090b',
        selectionBackground: 'rgba(59, 130, 246, 0.45)',
        black: '#18181b',
        red: '#f87171',
        green: '#4ade80',
        yellow: '#facc15',
        blue: '#60a5fa',
        magenta: '#c084fc',
        cyan: '#38bdf8',
        white: '#f4f4f5',
        brightBlack: '#71717a',
        brightRed: '#ef4444',
        brightGreen: '#22c55e',
        brightYellow: '#eab308',
        brightBlue: '#3b82f6',
        brightMagenta: '#a855f7',
        brightCyan: '#06b6d4',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    const webLinksAddon = new WebLinksAddon();

    term.loadAddon(fitAddon);
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    termRef.current = term;
    fitAddonRef.current = fitAddon;

    // Small delay to ensure container dimensions are calculated
    const initTimer = setTimeout(() => {
      try {
        fitAddon.fit();
        term.focus();
        const rows = term.rows || 24;
        const cols = term.cols || 80;
        StartTerminalSession(sessionId, tabId, rows, cols).catch((err) => {
          term.writeln(`\r\n\x1b[31m[Failed to start shell: ${err?.message || err}]\x1b[0m\r\n`);
        });
      } catch (e) {
        console.error('Terminal init error:', e);
      }
    }, 40);

    const handleFocusClick = () => {
      term.focus();
    };
    const el = containerRef.current;
    el.addEventListener('click', handleFocusClick);

    // Intercept xterm key events for shortcuts
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      if (e.type === 'keydown') {
        // Ctrl+Shift+C: copy selection or full buffer
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'C' || e.key === 'c')) {
          copyActionRef.current?.();
          return false;
        }

        // Ctrl+C with text selected: copy selection instead of sending SIGINT
        if ((e.ctrlKey || e.metaKey) && !e.shiftKey && (e.key === 'c' || e.key === 'c')) {
          if (term.hasSelection()) {
            copyActionRef.current?.();
            return false;
          }
        }

        // Ctrl+Shift+V: paste from clipboard
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'V' || e.key === 'v')) {
          pasteActionRef.current?.();
          return false;
        }
      }
      return true;
    });

    // Automatically copy selection to OS clipboard (standard terminal convention)
    const selectionDisposable = term.onSelectionChange(() => {
      const s = term.getSelection();
      if (s && s.length > 0) {
        lastSelectionRef.current = s;
        ClipboardSetText(s).catch(() => {});
      }
    });

    // Middle-click to paste
    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 1) {
        e.preventDefault();
        pasteActionRef.current?.();
      }
    };
    el.addEventListener('mouseup', handleMouseUp);

    // Forward user keystrokes to remote PTY
    const dataDisposable = term.onData((data) => {
      SendTerminalInput(sessionId, tabId, data).catch(() => {});
      // If user hit Enter, notify parent so file tree can check for refreshed files
      if (data === '\r' || data === '\n') {
        setTimeout(() => onCommandExecuted?.(), 400);
      }
    });

    // Notify backend on terminal dimensions change
    const resizeDisposable = term.onResize(({ rows, cols }) => {
      ResizeTerminal(sessionId, tabId, rows, cols).catch(() => {});
    });

    // Listen to streaming data from remote SSH PTY
    const dataEventName = `terminal:data:${sessionId}:${tabId}`;
    const exitEventName = `terminal:exit:${sessionId}:${tabId}`;

    const unsubData = EventsOn(dataEventName, (incoming: string) => {
      term.write(incoming);
    });

    const unsubExit = EventsOn(exitEventName, () => {
      term.writeln('\r\n\x1b[90m[Process finished]\x1b[0m');
    });

    // ResizeObserver to automatically fit terminal when container bounds change
    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        try {
          fitAddon.fit();
        } catch {}
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      clearTimeout(initTimer);
      el.removeEventListener('click', handleFocusClick);
      el.removeEventListener('mouseup', handleMouseUp);
      selectionDisposable.dispose();
      resizeObserver.disconnect();
      unsubData();
      unsubExit();
      EventsOff(dataEventName);
      EventsOff(exitEventName);
      dataDisposable.dispose();
      resizeDisposable.dispose();
      CloseTerminal(sessionId, tabId).catch(() => {});
      term.dispose();
      termRef.current = null;
      fitAddonRef.current = null;
    };
  }, [sessionId, tabId]);

  // When tab becomes active, fit and focus
  useEffect(() => {
    if (isActive && termRef.current && fitAddonRef.current) {
      setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          termRef.current?.focus();
        } catch {}
      }, 30);
    }
  }, [isActive]);

  // Context Menu handlers
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // If text was highlighted, immediately copy it on right-click (PuTTY / Linux terminal convention)
    const sel = termRef.current?.getSelection();
    if (sel && sel.length > 0) {
      lastSelectionRef.current = sel;
      ClipboardSetText(sel).catch(() => {});
    }

    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    if (!contextMenu) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setContextMenu(null);
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEsc);
    };
  }, [contextMenu]);

  const handleSelectAll = useCallback(() => {
    termRef.current?.selectAll();
    setContextMenu(null);
  }, []);

  const handleClearBuffer = useCallback(() => {
    termRef.current?.clear();
    setContextMenu(null);
  }, []);

  return (
    <div
      className={`relative w-full h-full flex flex-col bg-zinc-950 ${
        isActive ? 'block' : 'hidden'
      }`}
      onContextMenu={handleContextMenu}
    >
      <div
        ref={containerRef}
        className="w-full h-full px-2 py-1 overflow-hidden"
      />

      {/* Right Click Context Menu */}
      {contextMenu && (
        <div
          ref={menuRef}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          className="fixed z-50 min-w-[170px] bg-zinc-900 border border-zinc-700/80 rounded-md shadow-2xl py-1 text-xs text-zinc-200 select-none animate-in fade-in zoom-in-95 duration-100 font-sans"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => {
              copySelectionOrBuffer();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Copy className="w-3.5 h-3.5 text-zinc-400" />
              <span>Copy</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+C</span>
          </button>
          <button
            onClick={() => {
              pasteClipboardText();
            }}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <ClipboardPaste className="w-3.5 h-3.5 text-zinc-400" />
              <span>Paste</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+Shift+V</span>
          </button>
          <div className="h-px bg-zinc-800 my-1" />
          <button
            onClick={handleSelectAll}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 hover:text-white transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Square className="w-3.5 h-3.5 text-zinc-400" />
              <span>Select All</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+A</span>
          </button>
          <button
            onClick={handleClearBuffer}
            className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-zinc-800 hover:text-rose-400 transition-colors cursor-pointer text-left"
          >
            <div className="flex items-center gap-2">
              <Trash2 className="w-3.5 h-3.5 text-zinc-400" />
              <span>Clear Terminal</span>
            </div>
            <span className="text-[10px] text-zinc-500 font-mono">Ctrl+L</span>
          </button>
        </div>
      )}
    </div>
  );
};
