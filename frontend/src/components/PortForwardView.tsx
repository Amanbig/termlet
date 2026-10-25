import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Radio,
  Plus,
  Play,
  Square,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  Search,
  RefreshCw,
  Globe,
  Server,
  Zap,
  ArrowRight,
  AlertTriangle,
  Info,
  Activity,
  Loader2,
} from 'lucide-react';
import { tunnel, connections } from '../../wailsjs/go/models';
import {
  StartPortForward,
  SavePortForwardConfig,
  StopPortForward,
  RestartPortForward,
  DeletePortForward,
  ListPortForwards,
  CheckAllPortsHealth,
  CheckPortHealth,
} from '../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';
import { toast } from 'sonner';
import { formatErrorMessage } from '../utils/errors';
import { useConfirm } from '../context/ConfirmContext';

interface PortForwardViewProps {
  sessionId: string | null;
  activeSession: connections.SessionSummary | null;
  onOpenConnectDialog: () => void;
  onTunnelsChange?: (count: number) => void;
}

const PRESETS = [
  { name: 'Traefik Dashboard', localPort: 8080, remoteHost: '127.0.0.1', remotePort: 8080 },
  { name: 'Web Server (HTTP)', localPort: 8080, remoteHost: '127.0.0.1', remotePort: 80 },
  { name: 'Node / Vite Dev', localPort: 3000, remoteHost: '127.0.0.1', remotePort: 3000 },
  { name: 'PostgreSQL DB', localPort: 5432, remoteHost: '127.0.0.1', remotePort: 5432 },
  { name: 'MySQL / MariaDB', localPort: 3306, remoteHost: '127.0.0.1', remotePort: 3306 },
  { name: 'Redis Cache', localPort: 6379, remoteHost: '127.0.0.1', remotePort: 6379 },
];

export const PortForwardView: React.FC<PortForwardViewProps> = ({
  sessionId,
  activeSession,
  onOpenConnectDialog,
  onTunnelsChange,
}) => {
  const confirm = useConfirm();
  const [tunnels, setTunnels] = useState<tunnel.TunnelInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [healthMap, setHealthMap] = useState<Record<string, tunnel.PortHealthStatus>>({});
  const [isCheckingHealth, setIsCheckingHealth] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [localPort, setLocalPort] = useState('');
  const [remoteHost, setRemoteHost] = useState('127.0.0.1');
  const [remotePort, setRemotePort] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Probe health for active tunnels
  const probeHealth = useCallback(async (listToProbe?: tunnel.TunnelInfo[]) => {
    const list = listToProbe || tunnels;
    const activeIds = list.filter((t) => t.status === 'active').map((t) => t.id);
    if (activeIds.length === 0) return;

    setIsCheckingHealth(true);
    try {
      const results = await CheckAllPortsHealth(activeIds);
      if (Array.isArray(results)) {
        const nextMap: Record<string, tunnel.PortHealthStatus> = {};
        for (const res of results) {
          nextMap[res.tunnelId] = res;
        }
        setHealthMap((prev) => ({ ...prev, ...nextMap }));
      }
    } catch (err) {
      console.warn('Failed to probe port health:', err);
    } finally {
      setIsCheckingHealth(false);
    }
  }, [tunnels]);

  // Fetch tunnels
  const fetchTunnels = useCallback(async () => {
    if (!sessionId) {
      setTunnels([]);
      onTunnelsChange?.(0);
      return;
    }
    setIsLoading(true);
    try {
      const list = await ListPortForwards(sessionId);
      const safeList = list || [];
      setTunnels(safeList);
      const activeCount = safeList.filter((t) => t.status === 'active').length;
      onTunnelsChange?.(activeCount);
      probeHealth(safeList);
    } catch (err: any) {
      console.warn('Failed to load port forwards:', err);
    } finally {
      setIsLoading(false);
    }
  }, [sessionId, onTunnelsChange, probeHealth]);

  useEffect(() => {
    fetchTunnels();
    // Refresh periodically if we have active session
    if (!sessionId) return;
    const interval = setInterval(fetchTunnels, 4000);
    return () => clearInterval(interval);
  }, [sessionId, fetchTunnels]);

  // Apply a preset
  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setName(preset.name);
    setLocalPort(preset.localPort.toString());
    setRemoteHost(preset.remoteHost);
    setRemotePort(preset.remotePort.toString());
    setFormError(null);
  };

  // Submit new port forward
  const handleStartForward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sessionId) {
      toast.error('No active SSH connection to establish tunnel.');
      return;
    }

    const lPort = parseInt(localPort.trim(), 10);
    const rPort = parseInt(remotePort.trim(), 10);
    const rHost = remoteHost.trim() || '127.0.0.1';

    if (isNaN(lPort) || lPort < 1 || lPort > 65535) {
      setFormError('Local port must be a valid number between 1 and 65535.');
      return;
    }
    if (isNaN(rPort) || rPort < 1 || rPort > 65535) {
      setFormError('Remote port must be a valid number between 1 and 65535.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const created = await StartPortForward(sessionId, lPort, rHost, rPort, name.trim());
      toast.success(`Port forward started on localhost:${lPort}`, {
        description: `Forwarding to ${rHost}:${rPort} on ${activeSession?.host || 'server'}`,
      });
      setIsFormOpen(false);
      setName('');
      setLocalPort('');
      setRemotePort('');
      setRemoteHost('127.0.0.1');
      await fetchTunnels();
    } catch (err: any) {
      const formatted = formatErrorMessage(err, 'Port Forward');
      setFormError(`${formatted.message}${formatted.hint ? ` — ${formatted.hint}` : ''}`);
      toast.error(formatted.title, { description: formatted.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Save tunnel configuration to profile without immediately binding local port
  const handleSaveOnly = async () => {
    if (!sessionId) {
      toast.error('No active SSH connection to save port forwarding.');
      return;
    }

    const lPort = parseInt(localPort.trim(), 10);
    const rPort = parseInt(remotePort.trim(), 10);
    const rHost = remoteHost.trim() || '127.0.0.1';

    if (isNaN(lPort) || lPort < 1 || lPort > 65535) {
      setFormError('Local port must be a valid number between 1 and 65535.');
      return;
    }
    if (isNaN(rPort) || rPort < 1 || rPort > 65535) {
      setFormError('Remote port must be a valid number between 1 and 65535.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      await SavePortForwardConfig(sessionId, lPort, rHost, rPort, name.trim());
      toast.success(`Port forward saved to profile (stopped)`, {
        description: `Turn on localhost:${lPort} anytime by clicking the Play button.`,
      });
      setIsFormOpen(false);
      setName('');
      setLocalPort('');
      setRemotePort('');
      setRemoteHost('127.0.0.1');
      await fetchTunnels();
    } catch (err: any) {
      const formatted = formatErrorMessage(err, 'Save Port Forward');
      setFormError(`${formatted.message}${formatted.hint ? ` — ${formatted.hint}` : ''}`);
      toast.error(formatted.title, { description: formatted.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Stop tunnel
  const handleStopTunnel = async (tunnelId: string, port: number) => {
    try {
      await StopPortForward(tunnelId);
      toast.info(`Stopped port forward on localhost:${port}`);
      await fetchTunnels();
    } catch (err: any) {
      const formatted = formatErrorMessage(err, 'Stop Tunnel');
      toast.error(formatted.title, { description: formatted.message });
    }
  };

  // Restart tunnel
  const handleRestartTunnel = async (tunnelId: string, port: number) => {
    if (!sessionId) {
      toast.error('Cannot restart tunnel: session is not connected.');
      return;
    }
    try {
      await RestartPortForward(sessionId, tunnelId);
      toast.success(`Resumed port forward on localhost:${port}`);
      await fetchTunnels();
    } catch (err: any) {
      const formatted = formatErrorMessage(err, 'Resume Tunnel');
      toast.error(formatted.title, { description: formatted.message });
    }
  };

  // Delete tunnel
  const handleDeleteTunnel = async (tunnelId: string, port: number) => {
    const ok = await confirm({
      title: 'Remove Port Forward',
      description: `Are you sure you want to remove the port forward on localhost:${port}? This will also remove it from your saved profile.`,
      confirmText: 'Remove',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await DeletePortForward(tunnelId);
      toast.success(`Removed port forward on localhost:${port}`);
      await fetchTunnels();
    } catch (err: any) {
      const formatted = formatErrorMessage(err, 'Delete Tunnel');
      toast.error(formatted.title, { description: formatted.message });
    }
  };

  // Open in default browser
  const handleOpenBrowser = (port: number) => {
    const url = `http://localhost:${port}`;
    try {
      BrowserOpenURL(url);
    } catch {
      window.open(url, '_blank');
    }
  };

  // Copy URL
  const handleCopyUrl = (port: number, id: string) => {
    const url = `http://localhost:${port}`;
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    toast.success('Copied URL to clipboard', { description: url });
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered & stably sorted tunnels (prevents layout jumping on periodic refresh)
  const sortedTunnels = useMemo(() => {
    const list = tunnels.filter((t) => {
      if (!searchQuery) return true;
      const q = searchQuery.toLowerCase();
      return (
        t.name.toLowerCase().includes(q) ||
        t.localPort.toString().includes(q) ||
        t.remotePort.toString().includes(q) ||
        t.remoteHost.toLowerCase().includes(q)
      );
    });

    return list.sort((a, b) => {
      if (a.localPort !== b.localPort) {
        return a.localPort - b.localPort;
      }
      return a.id.localeCompare(b.id);
    });
  }, [tunnels, searchQuery]);

  if (!sessionId) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center select-none bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/80">
        <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900/60 flex items-center justify-center text-blue-500 mb-3 shadow-xs">
          <Radio className="w-6 h-6 stroke-[1.8]" />
        </div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
          No Active SSH Connection
        </h3>
        <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 max-w-[240px] leading-relaxed">
          Connect to an SSH server to forward local ports to internal remote services like Traefik, Docker, or databases.
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

  return (
    <div className="w-full bg-zinc-50 dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800/80 flex flex-col h-full select-none">
      {/* View Header - matching Remote Explorer & Connections */}
      <div className="px-3 py-2.5 border-b border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-xs tracking-wider uppercase text-zinc-700 dark:text-zinc-300 truncate">
            Port Forwarding
          </span>
          {activeSession && (
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Connected" />
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={fetchTunnels}
            title="Refresh Tunnels"
            className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => {
              setIsFormOpen(!isFormOpen);
              setFormError(null);
            }}
            title={isFormOpen ? 'Cancel' : 'Forward New Port'}
            className={`h-6 w-6 inline-flex items-center justify-center rounded transition-colors cursor-pointer ${
              isFormOpen
                ? 'bg-blue-600 text-white'
                : 'text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800'
            }`}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Creation Drawer / Form */}
      {isFormOpen && (
        <form
          onSubmit={handleStartForward}
          className="p-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-100/60 dark:bg-zinc-900/60 text-xs shrink-0 flex flex-col gap-2.5 animate-in slide-in-from-top-2 duration-150"
        >
          <div className="flex items-center justify-between">
            <span className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-blue-500" />
              New SSH Local Port Forward
            </span>
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="text-[10px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 cursor-pointer"
            >
              Cancel
            </button>
          </div>

          {/* Quick Presets */}
          <div>
            <label className="text-[10px] text-zinc-500 dark:text-zinc-400 font-medium block mb-1">
              Quick Presets:
            </label>
            <div className="flex flex-wrap gap-1">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleApplyPreset(p)}
                  className="px-2 py-0.5 rounded text-[10px] bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 hover:border-blue-500 dark:hover:border-blue-500 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Form Inputs Grid */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-600 dark:text-zinc-400 block mb-0.5">
                Local Port <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                placeholder="e.g. 8080"
                value={localPort}
                onChange={(e) => setLocalPort(e.target.value)}
                required
                className="w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 dark:text-zinc-400 block mb-0.5">
                Remote Port <span className="text-rose-500">*</span>
              </label>
              <input
                type="number"
                min="1"
                max="65535"
                placeholder="e.g. 80 or 8080"
                value={remotePort}
                onChange={(e) => setRemotePort(e.target.value)}
                required
                className="w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-zinc-600 dark:text-zinc-400 block mb-0.5">
                Remote Host
              </label>
              <input
                type="text"
                placeholder="127.0.0.1 or localhost"
                value={remoteHost}
                onChange={(e) => setRemoteHost(e.target.value)}
                className="w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="text-[10px] text-zinc-600 dark:text-zinc-400 block mb-0.5">
                Label / Name
              </label>
              <input
                type="text"
                placeholder="e.g. Traefik Dashboard"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-2 py-1 rounded border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-hidden focus:ring-1 focus:ring-blue-500"
              />
            </div>
          </div>

          {formError && (
            <div className="p-2 rounded bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-[11px] flex items-start gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              <span className="leading-tight">{formError}</span>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-2.5 py-1 rounded text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </button>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleSaveOnly}
                title="Save this port forwarding to profile in stopped state without opening it now"
                className="px-2.5 py-1 rounded bg-zinc-200/70 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700/80 disabled:opacity-50 text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
              >
                Save for Later
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-3 py-1 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-medium shadow-xs transition-colors cursor-pointer flex items-center gap-1"
              >
                {isSubmitting ? 'Starting...' : 'Start Forwarding'}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter / Search */}
      {tunnels.length > 3 && (
        <div className="px-3 py-2 border-b border-zinc-200 dark:border-zinc-800/80 shrink-0">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-zinc-400" />
            <input
              type="text"
              placeholder="Filter forwarded ports..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-7 pr-2 py-1 rounded text-xs bg-white dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800/80 text-zinc-900 dark:text-zinc-100 focus:outline-hidden"
            />
          </div>
        </div>
      )}

      {/* Tunnels List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5">
        {tunnels.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-center text-zinc-400">
            <Globe className="w-8 h-8 stroke-[1.2] text-zinc-300 dark:text-zinc-600 mb-2" />
            <p className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
              No Ports Forwarded Yet
            </p>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-[200px] leading-relaxed">
              Click &quot;Forward Port&quot; above to map any remote server service directly to your localhost.
            </p>
          </div>
        ) : sortedTunnels.length === 0 ? (
          <div className="py-8 text-center text-xs text-zinc-400">
            No port forwards match &quot;{searchQuery}&quot;
          </div>
        ) : (
          sortedTunnels.map((t) => {
            const isActive = t.status === 'active';
            const isError = t.status === 'error';

            return (
              <div
                key={t.id}
                className="p-3 rounded-lg border border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-900/40 shadow-2xs hover:border-zinc-300 dark:hover:border-zinc-700/80 transition-all flex flex-col gap-2"
              >
                {/* Card Top: Name & Status */}
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full shrink-0 ${
                        isActive
                          ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse'
                          : isError
                          ? 'bg-rose-500'
                          : 'bg-zinc-400'
                      }`}
                    />
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                      {t.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      title={
                        isActive
                          ? t.connections > 0
                            ? `${t.connections} active TCP connection${t.connections === 1 ? '' : 's'}`
                            : 'Listening for connections'
                          : isError
                          ? t.errorMsg || 'Tunnel error'
                          : 'Tunnel stopped'
                      }
                      className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                        isActive
                          ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                          : isError
                          ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                          : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700'
                      }`}
                    >
                      {isActive
                        ? t.connections > 0
                          ? `Active • ${t.connections} ${t.connections === 1 ? 'conn' : 'conns'}`
                          : 'Active'
                        : isError
                        ? 'Error'
                        : 'Stopped'}
                    </span>
                  </div>
                </div>

                {/* Card Middle: Routing Route */}
                <div className="flex items-center gap-2 py-1 px-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800/80 font-mono text-[11px] text-zinc-800 dark:text-zinc-200">
                  <span className="font-bold text-blue-600 dark:text-blue-400">
                    127.0.0.1:{t.localPort}
                  </span>
                  <ArrowRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  <span className="text-zinc-600 dark:text-zinc-400 truncate">
                    {t.remoteHost}:{t.remotePort}
                  </span>
                </div>

                {/* Health Status Indicator */}
                {isActive && (
                  <div className="flex items-center justify-between text-[10px] px-1">
                    <span className="text-zinc-500 flex items-center gap-1">
                      <Activity className="w-3 h-3 text-zinc-400" />
                      Status:
                    </span>
                    {healthMap[t.id] ? (
                      <span
                        className={`font-mono px-1.5 py-0.5 rounded flex items-center gap-1.5 border text-[10px] ${
                          healthMap[t.id].status === 'healthy'
                            ? healthMap[t.id].protocol === 'http'
                              ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800/60'
                              : 'bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-400 border-sky-200 dark:border-sky-800/60'
                            : healthMap[t.id].status === 'warning'
                            ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800/60'
                            : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-800/60'
                        }`}
                        title={healthMap[t.id].error || healthMap[t.id].statusText}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            healthMap[t.id].status === 'healthy'
                              ? 'bg-emerald-500 animate-pulse'
                              : healthMap[t.id].status === 'warning'
                              ? 'bg-amber-500'
                              : 'bg-rose-500'
                          }`}
                        />
                        <span>
                          {healthMap[t.id].statusText ||
                            (healthMap[t.id].status === 'unreachable' ? 'Unreachable' : healthMap[t.id].status)}
                        </span>
                        {healthMap[t.id].latencyMs > 0 && (
                          <span className="opacity-70 text-[9px]">({healthMap[t.id].latencyMs}ms)</span>
                        )}
                      </span>
                    ) : (
                      <span className="text-zinc-400 flex items-center gap-1 text-[10px]">
                        <Loader2 className="w-2.5 h-2.5 animate-spin" /> Checking...
                      </span>
                    )}
                  </div>
                )}

                {t.errorMsg && (
                  <div className="p-2 rounded bg-rose-50/80 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 text-[10px] flex items-start gap-1.5 leading-tight">
                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                    <span>{t.errorMsg}</span>
                  </div>
                )}

                {/* Card Actions Footer */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-200/60 dark:border-zinc-800/60">
                  <div className="flex items-center gap-1.5">
                    {/* 1-Click Open in Browser */}
                    <button
                      onClick={() => handleOpenBrowser(t.localPort)}
                      disabled={!isActive}
                      title={`Open http://localhost:${t.localPort} in browser`}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded bg-zinc-200/60 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-300 disabled:opacity-40 text-[11px] font-medium transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3 h-3 text-blue-500" />
                      <span>Open</span>
                    </button>

                    {/* Copy URL */}
                    <button
                      onClick={() => handleCopyUrl(t.localPort, t.id)}
                      title="Copy URL (http://localhost:...)"
                      className="p-1 rounded text-zinc-500 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      {copiedId === t.id ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Toggle Start/Stop */}
                    {isActive ? (
                      <button
                        onClick={() => handleStopTunnel(t.id, t.localPort)}
                        title="Stop Port Forward"
                        className="p-1 rounded text-zinc-500 hover:text-amber-600 dark:text-zinc-400 dark:hover:text-amber-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRestartTunnel(t.id, t.localPort)}
                        title="Turn on Port Forward"
                        className="p-1 rounded text-zinc-500 hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => handleDeleteTunnel(t.id, t.localPort)}
                      title="Delete Port Forward"
                      className="p-1 rounded text-zinc-500 hover:text-rose-600 dark:text-zinc-400 dark:hover:text-rose-400 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Helpful Tip Footer */}
      <div className="px-3 py-2 border-t border-zinc-200 dark:border-zinc-800/80 text-[10px] text-zinc-500 dark:text-zinc-400 bg-transparent flex items-center gap-1.5 shrink-0">
        <Info className="w-3 h-3 text-zinc-400 shrink-0" />
        <span className="truncate">
          Traffic is securely tunneled over encrypted SSH channel directly to 127.0.0.1.
        </span>
      </div>
    </div>
  );
};
