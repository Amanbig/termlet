import React from 'react';
import { WifiOff, Loader2, RotateCw, X, AlertTriangle } from 'lucide-react';
import { Button } from './ui/button';

export interface DroppedSessionInfo {
  sessionId: string;
  profileId: string;
  profileName: string;
  host: string;
  port: number;
  error: string;
  attempt: number;
  maxAttempts: number;
  secondsRemaining: number;
  isReconnecting: boolean;
  failedPermanently: boolean;
}

interface ReconnectBannerProps {
  info: DroppedSessionInfo;
  onReconnectNow: () => void;
  onCancel: () => void;
}

export const ReconnectBanner: React.FC<ReconnectBannerProps> = ({
  info,
  onReconnectNow,
  onCancel,
}) => {
  return (
    <aside
      aria-label="Connection Status"
      className="relative z-30 w-full border-b bg-amber-500/10 dark:bg-amber-950/40 border-amber-500/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 transition-all duration-200 animate-in slide-in-from-top-1"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Left: Status Icon and Details */}
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-1 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-400 shrink-0">
            {info.isReconnecting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : info.failedPermanently ? (
              <AlertTriangle className="w-4 h-4 text-rose-500" />
            ) : (
              <WifiOff className="w-4 h-4" />
            )}
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-zinc-900 dark:text-zinc-100">
                Connection lost to {info.profileName || info.host}
              </span>
              <span className="text-[11px] text-zinc-500 dark:text-zinc-400 font-mono">
                ({info.host}:{info.port})
              </span>
            </div>

            <p className="text-[11px] text-zinc-600 dark:text-zinc-400 mt-0.5 truncate max-w-[450px]">
              {info.isReconnecting
                ? `Re-establishing SSH & SFTP session (Attempt ${info.attempt}/${info.maxAttempts})...`
                : info.failedPermanently
                ? `Reconnection attempts failed: ${info.error || 'Host unreachable'}`
                : `Keep-alive failed: ${info.error || 'Server stopped responding'}. Retrying in ${info.secondsRemaining}s (Attempt ${info.attempt}/${info.maxAttempts})`}
            </p>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            variant="outline"
            onClick={onReconnectNow}
            disabled={info.isReconnecting}
            className="h-7 text-xs gap-1.5 bg-amber-500/20 hover:bg-amber-500/30 border-amber-500/40 text-amber-950 dark:text-amber-100 cursor-pointer"
          >
            {info.isReconnecting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Reconnecting...</span>
              </>
            ) : (
              <>
                <RotateCw className="w-3.5 h-3.5" />
                <span>Reconnect Now</span>
              </>
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={onCancel}
            title="Dismiss / Cancel Auto-Reconnect"
            className="h-7 w-7 p-0 text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </aside>
  );
};
