import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Cpu,
  HardDrive,
  RefreshCw,
  Server,
  Zap,
  Radio,
  Globe,
  Terminal,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  Clock,
  Shield,
  Layers,
  ArrowRight,
} from 'lucide-react';
import { toast } from 'sonner';
import { GetSystemStats, RunNetworkDiag } from '../../wailsjs/go/main/App';
import { models, connections } from '../../wailsjs/go/models';

interface DiagnosticsViewProps {
  sessionId: string | null;
  activeSession: connections.SessionSummary | null;
  onOpenConnectDialog: () => void;
}

type DiagTab = 'system' | 'network' | 'ports';
type NetTool = 'ping' | 'dns' | 'port_check' | 'listening_ports' | 'traceroute';

export const DiagnosticsView: React.FC<DiagnosticsViewProps> = ({
  sessionId,
  activeSession,
  onOpenConnectDialog,
}) => {
  const [activeTab, setActiveTab] = useState<DiagTab>('system');
  const [stats, setStats] = useState<models.SystemStats | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Network Tools state
  const [selectedTool, setSelectedTool] = useState<NetTool>('ping');
  const [targetInput, setTargetInput] = useState('1.1.1.1');
  const [toolRunning, setToolRunning] = useState(false);
  const [diagResult, setDiagResult] = useState<models.NetworkDiagResult | null>(null);
  const [copied, setCopied] = useState(false);

  // Fetch system statistics
  const fetchStats = useCallback(async () => {
    if (!sessionId) return;
    setLoadingStats(true);
    try {
      const data = await GetSystemStats(sessionId);
      setStats(data);
    } catch (err: any) {
      toast.error('Failed to query system stats', { description: err?.message || String(err) });
    } finally {
      setLoadingStats(false);
    }
  }, [sessionId]);

  // Initial fetch on mount or session change
  useEffect(() => {
    if (sessionId) {
      fetchStats();
    } else {
      setStats(null);
    }
  }, [sessionId, fetchStats]);

  // Auto-refresh interval (every 8 seconds when active)
  useEffect(() => {
    if (!autoRefresh || !sessionId) return;
    const interval = setInterval(() => {
      fetchStats();
    }, 8000);
    return () => clearInterval(interval);
  }, [autoRefresh, sessionId, fetchStats]);

  // Run Network Diagnostic Tool
  const handleRunTool = async (overrideTool?: NetTool, overrideTarget?: string) => {
    if (!sessionId) {
      toast.error('No active SSH connection');
      return;
    }

    const tool = overrideTool || selectedTool;
    const target = overrideTarget !== undefined ? overrideTarget : targetInput;

    setToolRunning(true);
    setDiagResult(null);

    try {
      const res = await RunNetworkDiag(sessionId, tool, target);
      setDiagResult(res);
      if (res.error) {
        toast.warning(`Diagnostic tool completed with warnings`);
      } else {
        toast.success(`Completed ${tool} probe in ${res.duration_ms}ms`);
      }
    } catch (err: any) {
      toast.error(`Error running ${tool}`, { description: err?.message || String(err) });
    } finally {
      setToolRunning(false);
    }
  };

  const handleCopyOutput = () => {
    if (!diagResult?.output) return;
    navigator.clipboard.writeText(diagResult.output);
    setCopied(true);
    toast.success('Copied output to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  if (!sessionId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/80">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-500 mb-3 shadow-xs">
          <Activity className="w-6 h-6 stroke-[1.8]" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          No Active SSH Connection
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[240px] leading-relaxed">
          Connect to an SSH server to inspect live CPU, memory, disk usage, and network diagnostics.
        </p>
        <button
          onClick={onOpenConnectDialog}
          className="mt-4 px-3.5 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
        >
          <Server className="w-3.5 h-3.5" />
          <span>Connect to Server</span>
        </button>
      </div>
    );
  }

  // Calculate RAM usage percentage
  const memTotal = stats?.mem_total_mb || 0;
  const memUsed = stats?.mem_used_mb || 0;
  const memPct = memTotal > 0 ? Math.round((memUsed / memTotal) * 100) : 0;

  // Calculate Swap usage percentage
  const swapTotal = stats?.swap_total_mb || 0;
  const swapUsed = stats?.swap_used_mb || 0;
  const swapPct = swapTotal > 0 ? Math.round((swapUsed / swapTotal) * 100) : 0;

  return (
    <div className="w-full bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full select-none text-xs">
      {/* View Header */}
      <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-xs tracking-wider uppercase text-zinc-700 dark:text-zinc-300 truncate">
            Server Diagnostics
          </span>
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Connected" />
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={fetchStats}
            title="Refresh System Stats"
            className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingStats ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div className="px-3 pt-2.5 pb-2 shrink-0">
        <div className="flex rounded-lg bg-zinc-200/80 dark:bg-zinc-800/90 p-0.5 text-[11px] font-medium border border-zinc-200/50 dark:border-zinc-700/50">
          <button
            onClick={() => setActiveTab('system')}
            className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'system'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5 text-blue-500" />
            <span>Overview</span>
          </button>

          <button
            onClick={() => setActiveTab('network')}
            className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'network'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Globe className="w-3.5 h-3.5 text-emerald-500" />
            <span>Network Tools</span>
          </button>

          <button
            onClick={() => {
              setActiveTab('ports');
              handleRunTool('listening_ports', '');
            }}
            className={`flex-1 py-1 px-2 rounded-md transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
              activeTab === 'ports'
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
            }`}
          >
            <Radio className="w-3.5 h-3.5 text-violet-500" />
            <span>Open Sockets</span>
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {activeTab === 'system' && (
          <>
            {/* Host Info Banner */}
            <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-2xs">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  <Server className="w-3.5 h-3.5 text-blue-500" />
                  {stats?.hostname || activeSession?.host || 'Remote Server'}
                </span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                  {stats?.os || 'Linux'}
                </span>
              </div>

              <div className="space-y-1.5 text-[11px] text-zinc-600 dark:text-zinc-400 font-mono">
                {stats?.uptime && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Uptime:</span>
                    <span className="text-zinc-900 dark:text-zinc-200">{stats.uptime}</span>
                  </div>
                )}
                {stats?.load_avg && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Load Average:</span>
                    <span className="text-zinc-900 dark:text-zinc-200 font-semibold">{stats.load_avg}</span>
                  </div>
                )}
                {stats?.kernel && (
                  <div className="flex items-center justify-between">
                    <span className="text-zinc-500">Kernel:</span>
                    <span className="truncate max-w-[180px]" title={stats.kernel}>{stats.kernel}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Memory & Disk Meters */}
            <div className="grid grid-cols-1 gap-2.5">
              {/* RAM */}
              <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-2xs">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Cpu className="w-3.5 h-3.5 text-blue-500" />
                    Memory (RAM)
                  </span>
                  <span className="font-mono text-zinc-500 text-[10px]">
                    {memUsed} MB / {memTotal} MB ({memPct}%)
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      memPct > 85 ? 'bg-rose-500' : memPct > 65 ? 'bg-amber-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(memPct, 100)}%` }}
                  />
                </div>
              </div>

              {/* Disk Usage */}
              {stats?.disk_total && (
                <div className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-2xs">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                      <HardDrive className="w-3.5 h-3.5 text-emerald-500" />
                      Disk Usage (/)
                    </span>
                    <span className="font-mono text-zinc-500 text-[10px]">
                      {stats.disk_used} / {stats.disk_total} ({stats.disk_usage_percent})
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-zinc-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        parseInt(stats.disk_usage_percent) > 85
                          ? 'bg-rose-500'
                          : parseInt(stats.disk_usage_percent) > 70
                          ? 'bg-amber-500'
                          : 'bg-emerald-500'
                      }`}
                      style={{ width: `${stats.disk_usage_percent}` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Top Processes Table */}
            {stats?.top_processes && stats.top_processes.length > 0 && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-2xs overflow-hidden">
                <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
                  <span className="font-semibold text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                    <Layers className="w-3.5 h-3.5 text-zinc-400" />
                    Top Processes
                  </span>
                  <span className="text-[10px] text-zinc-500">by %CPU</span>
                </div>
                <div className="divide-y divide-zinc-200/60 dark:divide-zinc-800/60">
                  {stats.top_processes.map((proc, idx) => (
                    <div key={idx} className="p-2.5 flex items-center justify-between gap-2 font-mono text-[10px]">
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                          {proc.command}
                        </div>
                        <div className="text-zinc-500 flex items-center gap-2 mt-0.5">
                          <span>PID: {proc.pid}</span>
                          <span>•</span>
                          <span>{proc.user}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="px-1.5 py-0.5 rounded bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                          {proc.cpu}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
                          {proc.mem}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {activeTab === 'network' && (
          <div className="space-y-3">
            {/* Tool Selection */}
            <div className="grid grid-cols-4 gap-1">
              {(
                [
                  { id: 'ping', label: 'Ping', preset: '1.1.1.1' },
                  { id: 'dns', label: 'DNS', preset: 'google.com' },
                  { id: 'port_check', label: 'Port', preset: 'localhost:80' },
                  { id: 'traceroute', label: 'Trace', preset: '8.8.8.8' },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTool(t.id);
                    setTargetInput(t.preset);
                    setDiagResult(null);
                  }}
                  className={`py-1.5 px-2 rounded-lg border text-center font-medium transition-all cursor-pointer ${
                    selectedTool === t.id
                      ? 'bg-blue-50 dark:bg-blue-950/50 border-blue-500 text-blue-600 dark:text-blue-400 font-semibold'
                      : 'bg-white dark:bg-zinc-900/60 border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:border-zinc-300'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Target input form */}
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={
                  selectedTool === 'port_check'
                    ? 'e.g. localhost:8080 or 1.1.1.1:443'
                    : selectedTool === 'dns'
                    ? 'e.g. google.com or github.com'
                    : 'Target IP or Hostname...'
                }
                value={targetInput}
                onChange={(e) => setTargetInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRunTool();
                }}
                className="flex-1 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
              <button
                onClick={() => handleRunTool()}
                disabled={toolRunning}
                className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
              >
                {toolRunning ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Running...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5" />
                    <span>Run</span>
                  </>
                )}
              </button>
            </div>

            {/* Quick target presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] text-zinc-500">Quick Targets:</span>
              {(selectedTool === 'port_check'
                ? ['localhost:80', 'localhost:443', 'localhost:8080', 'localhost:5432']
                : ['1.1.1.1', '8.8.8.8', 'google.com', 'github.com']
              ).map((p) => (
                <button
                  key={p}
                  onClick={() => {
                    setTargetInput(p);
                    handleRunTool(selectedTool, p);
                  }}
                  className="px-2 py-0.5 rounded text-[10px] bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 hover:text-blue-500 transition-colors cursor-pointer font-mono"
                >
                  {p}
                </button>
              ))}
            </div>

            {/* Tool Output Box */}
            {diagResult && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xs">
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-zinc-200 uppercase">{diagResult.tool}</span>
                    <span>•</span>
                    <span>{diagResult.duration_ms}ms</span>
                    <span>•</span>
                    <span className={diagResult.exit_code === 0 ? 'text-emerald-400' : 'text-amber-400'}>
                      Exit {diagResult.exit_code}
                    </span>
                  </div>
                  <button
                    onClick={handleCopyOutput}
                    className="flex items-center gap-1 hover:text-zinc-200 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-3 font-mono text-[11px] text-zinc-200 whitespace-pre-wrap leading-relaxed max-h-[300px] overflow-y-auto select-text">
                  {diagResult.output || diagResult.error || 'No output produced.'}
                </pre>
              </div>
            )}
          </div>
        )}

        {activeTab === 'ports' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-zinc-500 text-[11px]">
                Listening sockets detected on remote host:
              </span>
              <button
                onClick={() => handleRunTool('listening_ports', '')}
                disabled={toolRunning}
                className="px-2.5 py-1 rounded bg-zinc-200/80 dark:bg-zinc-800 hover:bg-zinc-200 text-zinc-800 dark:text-zinc-200 text-[10px] font-medium flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className={`w-3 h-3 ${toolRunning ? 'animate-spin' : ''}`} />
                <span>Re-scan</span>
              </button>
            </div>

            {diagResult && (
              <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-950 overflow-hidden shadow-2xs">
                <div className="px-3 py-2 border-b border-zinc-800 flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                  <span>Listening Ports (ss/netstat)</span>
                  <button
                    onClick={handleCopyOutput}
                    className="flex items-center gap-1 hover:text-zinc-200 cursor-pointer"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
                <pre className="p-3 font-mono text-[10px] text-zinc-300 whitespace-pre-wrap leading-relaxed max-h-[380px] overflow-y-auto select-text">
                  {diagResult.output || 'Scanning sockets...'}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Auto-refresh bottom toggle */}
      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800/80 bg-transparent flex items-center justify-between shrink-0 text-[10px] text-zinc-500">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={autoRefresh}
            onChange={(e) => setAutoRefresh(e.target.checked)}
            className="rounded accent-blue-600"
          />
          <span>Auto-refresh metrics (8s)</span>
        </label>
        {loadingStats && (
          <span className="text-blue-500 flex items-center gap-1">
            <Loader2 className="w-2.5 h-2.5 animate-spin" /> Updating...
          </span>
        )}
      </div>
    </div>
  );
};
