import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Download,
  Copy,
  Check,
  FileCode,
  FileText,
  Clock,
  HardDrive,
  Film,
} from 'lucide-react';
import { toast } from 'sonner';

export interface RecordedEvent {
  time: number; // seconds offset from start
  type: string; // "o"
  data: string;
}

interface SessionRecorderModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionTitle: string;
  cols: number;
  rows: number;
  events: RecordedEvent[];
  totalDurationSeconds: number;
}

function stripAnsi(str: string): string {
  if (!str) return '';
  return str.replace(
    // eslint-disable-next-line no-control-regex
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  );
}

function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export const SessionRecorderModal: React.FC<SessionRecorderModalProps> = ({
  isOpen,
  onClose,
  sessionTitle,
  cols,
  rows,
  events,
  totalDurationSeconds,
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackTime, setPlaybackTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [copiedType, setCopiedType] = useState<string | null>(null);

  const animFrameRef = useRef<number | null>(null);
  const lastWallTimeRef = useRef<number>(0);
  const terminalPreRef = useRef<HTMLPreElement>(null);

  // Calculate full plain text
  const fullPlainText = useMemo(() => {
    return stripAnsi(events.map((e) => e.data).join(''));
  }, [events]);

  // Calculate Asciinema v2 format string
  const asciinemaCast = useMemo(() => {
    const header = JSON.stringify({
      version: 2,
      width: cols || 80,
      height: rows || 24,
      timestamp: Math.floor(Date.now() / 1000),
      title: sessionTitle || 'Termlet Terminal Session',
      env: { SHELL: '/bin/bash', TERM: 'xterm-256color' },
    });

    const lines = [header];
    for (const ev of events) {
      lines.push(JSON.stringify([Number(ev.time.toFixed(6)), ev.type, ev.data]));
    }
    return lines.join('\n');
  }, [events, cols, rows, sessionTitle]);

  // Compute text visible up to playbackTime
  const currentPlaybackText = useMemo(() => {
    let raw = '';
    for (const ev of events) {
      if (ev.time <= playbackTime) {
        raw += ev.data;
      } else {
        break;
      }
    }
    return stripAnsi(raw);
  }, [events, playbackTime]);

  // Auto-scroll playback terminal
  useEffect(() => {
    if (terminalPreRef.current) {
      terminalPreRef.current.scrollTop = terminalPreRef.current.scrollHeight;
    }
  }, [currentPlaybackText]);

  // Playback animation loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    lastWallTimeRef.current = performance.now();

    const loop = (now: number) => {
      const deltaSec = ((now - lastWallTimeRef.current) / 1000) * playbackSpeed;
      lastWallTimeRef.current = now;

      setPlaybackTime((prev) => {
        const next = prev + deltaSec;
        if (next >= totalDurationSeconds) {
          setIsPlaying(false);
          return totalDurationSeconds;
        }
        return next;
      });

      animFrameRef.current = requestAnimationFrame(loop);
    };

    animFrameRef.current = requestAnimationFrame(loop);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, playbackSpeed, totalDurationSeconds]);

  if (!isOpen) return null;

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Exported ${filename}`);
  };

  const handleDownloadCast = () => {
    downloadFile(asciinemaCast, `session-${Date.now()}.cast`, 'application/json');
  };

  const handleDownloadTxt = () => {
    downloadFile(fullPlainText, `session-${Date.now()}.txt`, 'text/plain');
  };

  const handleDownloadHtml = () => {
    const htmlContent = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${sessionTitle || 'Termlet Session Log'}</title>
  <style>
    body { background: #09090b; color: #f4f4f5; font-family: monospace; padding: 20px; line-height: 1.4; }
    pre { white-space: pre-wrap; word-break: break-all; }
  </style>
</head>
<body>
  <h2>${sessionTitle}</h2>
  <pre>${fullPlainText.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</pre>
</body>
</html>`;
    downloadFile(htmlContent, `session-${Date.now()}.html`, 'text/html');
  };

  const handleCopy = (type: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedType(type);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl max-w-3xl w-full flex flex-col shadow-2xl overflow-hidden max-h-[90vh]">
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
              <Film className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <span>Terminal Session Recording</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-800 text-zinc-400">
                  Asciinema v2 (.cast)
                </span>
              </h2>
              <div className="flex items-center gap-3 text-xs text-zinc-400 mt-0.5 font-mono">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3 text-zinc-500" />
                  {formatDuration(totalDurationSeconds)}
                </span>
                <span>•</span>
                <span>{events.length} stream events</span>
                <span>•</span>
                <span>{cols}x{rows} cols/rows</span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Player Viewport */}
        <div className="p-4 flex-1 flex flex-col min-h-0 bg-zinc-950/80">
          <div className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg p-3 font-mono text-xs overflow-hidden relative shadow-inner min-h-[220px] max-h-[360px] flex flex-col">
            <pre
              ref={terminalPreRef}
              className="flex-1 overflow-y-auto text-zinc-200 select-text whitespace-pre-wrap leading-relaxed pr-2 font-mono text-[11px]"
            >
              {currentPlaybackText || <span className="text-zinc-600 italic">No output captured in this timeframe...</span>}
            </pre>
          </div>

          {/* Controls Bar */}
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={() => {
                if (playbackTime >= totalDurationSeconds) {
                  setPlaybackTime(0);
                }
                setIsPlaying(!isPlaying);
              }}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer"
              title={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>

            <button
              onClick={() => {
                setIsPlaying(false);
                setPlaybackTime(0);
              }}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 transition-colors cursor-pointer"
              title="Restart from beginning"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            {/* Scrubber slider */}
            <div className="flex-1 flex items-center gap-2">
              <span className="text-[11px] font-mono text-zinc-400 min-w-[36px]">
                {formatDuration(playbackTime)}
              </span>
              <input
                type="range"
                min="0"
                max={totalDurationSeconds || 1}
                step="0.1"
                value={playbackTime}
                onChange={(e) => {
                  setPlaybackTime(parseFloat(e.target.value));
                }}
                className="flex-1 accent-blue-500 cursor-pointer h-1.5 bg-zinc-800 rounded-lg"
              />
              <span className="text-[11px] font-mono text-zinc-500 min-w-[36px]">
                {formatDuration(totalDurationSeconds)}
              </span>
            </div>

            {/* Playback speed selector */}
            <div className="flex rounded-md bg-zinc-800 p-0.5 text-[10px] font-mono">
              {[1, 2, 4].map((speed) => (
                <button
                  key={speed}
                  onClick={() => setPlaybackSpeed(speed)}
                  className={`px-1.5 py-0.5 rounded transition-colors cursor-pointer ${
                    playbackSpeed === speed
                      ? 'bg-zinc-700 text-white font-bold'
                      : 'text-zinc-400 hover:text-zinc-200'
                  }`}
                >
                  {speed}x
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Export / Download Options Footer */}
        <div className="px-5 py-4 border-t border-zinc-800 bg-zinc-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {/* Asciinema .cast download */}
            <button
              onClick={handleDownloadCast}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
            >
              <FileCode className="w-3.5 h-3.5" />
              <span>Download .cast (Asciinema)</span>
            </button>

            {/* Plain text download */}
            <button
              onClick={handleDownloadTxt}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download .txt</span>
            </button>

            {/* HTML download */}
            <button
              onClick={handleDownloadHtml}
              className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>HTML Log</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => handleCopy('cast', asciinemaCast)}
              className="px-2.5 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
              title="Copy Asciinema .cast JSON to clipboard"
            >
              {copiedType === 'cast' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>Copy .cast</span>
            </button>

            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-zinc-800/80 hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 text-xs font-medium transition-colors cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
