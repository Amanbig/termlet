import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  Search,
  X,
  RefreshCw,
  Trash2,
  Copy,
  Check,
  Loader2,
  Lock,
  Hash,
  ExternalLink,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { toast } from 'sonner';
import {
  GetKnownHosts,
  RemoveKnownHostByLine,
  ClearKnownHosts,
} from '../../wailsjs/go/main/App';
import { models } from '../../wailsjs/go/models';
import { useConfirm } from '../context/ConfirmContext';

interface KnownHostsViewProps {
  onClose?: () => void;
}

export const KnownHostsView: React.FC<KnownHostsViewProps> = ({ onClose }) => {
  const confirm = useConfirm();
  const [knownHosts, setKnownHosts] = useState<models.KnownHostEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | 'termlet' | 'system'>('all');
  const [copiedFingerprint, setCopiedFingerprint] = useState<string | null>(null);

  const loadKnownHosts = async () => {
    setLoading(true);
    try {
      const list = await GetKnownHosts();
      setKnownHosts(list || []);
    } catch (err: any) {
      console.error('Failed to load known hosts:', err);
      toast.error('Failed to load known hosts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadKnownHosts();
  }, []);

  const handleRemoveEntry = async (entry: models.KnownHostEntry) => {
    const isHashed = entry.host.startsWith('|1|');
    const displayHost = isHashed ? 'Hashed Host Record' : entry.host;
    const sourceLabel = entry.source === 'termlet' ? 'Termlet known_hosts' : 'System ~/.ssh/known_hosts';

    const ok = await confirm({
      title: 'Remove Known Host Key?',
      description: `Are you sure you want to remove the host key for "${displayHost}" from ${sourceLabel}? You will be prompted to verify the host key the next time you connect.`,
      confirmText: 'Remove Key',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await RemoveKnownHostByLine(entry.source, entry.line_number);
      toast.success(`Removed host key (${displayHost})`);
      await loadKnownHosts();
    } catch (err: any) {
      toast.error(`Failed to remove host key: ${err?.message || err}`);
    }
  };

  const handleClearTermlet = async () => {
    const ok = await confirm({
      title: 'Clear All Termlet Known Hosts?',
      description:
        'This will purge all host keys stored in Termlet (~/.config/termlet/known_hosts). System ~/.ssh/known_hosts keys will remain untouched. You will be prompted to approve host keys again on future connections.',
      confirmText: 'Clear Cache',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await ClearKnownHosts('termlet');
      toast.success('Cleared Termlet known_hosts cache');
      await loadKnownHosts();
    } catch (err: any) {
      toast.error(`Failed to clear known hosts: ${err?.message || err}`);
    }
  };

  const copyFingerprint = (fp: string, id: string) => {
    navigator.clipboard.writeText(fp);
    setCopiedFingerprint(id);
    toast.success('Fingerprint copied to clipboard');
    setTimeout(() => setCopiedFingerprint(null), 2000);
  };

  const filteredHosts = knownHosts.filter((entry) => {
    if (sourceFilter !== 'all' && entry.source !== sourceFilter) {
      return false;
    }
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      entry.host.toLowerCase().includes(q) ||
      entry.key_type.toLowerCase().includes(q) ||
      entry.fingerprint.toLowerCase().includes(q) ||
      (entry.comment && entry.comment.toLowerCase().includes(q))
    );
  });

  const termletCount = knownHosts.filter((k) => k.source === 'termlet').length;
  const systemCount = knownHosts.filter((k) => k.source === 'system').length;

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden select-none">
      {/* Top Header Bar & Search Bar */}
      <div className="px-6 sm:px-8 lg:px-12 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shrink-0">
        <div className="w-full max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-emerald-500" />
                <h1 className="text-lg font-bold tracking-tight">SSH Known Hosts &amp; Security</h1>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono text-[11px] font-semibold">
                  {knownHosts.length} {knownHosts.length === 1 ? 'Key' : 'Keys'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Inspect and manage cryptographic remote host public keys to protect against man-in-the-middle attacks
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadKnownHosts}
                disabled={loading}
                className="h-8 text-xs px-3 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearTermlet}
                disabled={termletCount === 0}
                className="h-8 text-xs px-3 text-rose-600 dark:text-rose-400 border-rose-300 dark:border-rose-900/60 hover:bg-rose-50 dark:hover:bg-rose-950/30 cursor-pointer shadow-xs disabled:opacity-40"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                Clear Termlet Cache
              </Button>
            </div>
          </div>

          {/* Centered Search & Source Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1">
            <div className="relative w-full sm:max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400" />
              <Input
                placeholder="Search by hostname, algorithm (ed25519, rsa), or fingerprint..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 pr-9 h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 rounded-lg focus:ring-1 focus:ring-blue-500 w-full shadow-xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 cursor-pointer p-0.5"
                  title="Clear search"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Source tabs filter */}
            <div className="flex items-center gap-1.5 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 self-stretch sm:self-auto justify-center">
              {(['all', 'termlet', 'system'] as const).map((src) => {
                const count = src === 'all' ? knownHosts.length : src === 'termlet' ? termletCount : systemCount;
                const active = sourceFilter === src;
                const label = src === 'all' ? 'All' : src === 'termlet' ? 'Termlet' : 'System (~/.ssh)';
                return (
                  <button
                    key={src}
                    onClick={() => setSourceFilter(src)}
                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all cursor-pointer ${
                      active
                        ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                        : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                    }`}
                  >
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 lg:px-12 py-6 select-text">
        <div className="w-full max-w-5xl mx-auto space-y-4 pb-12">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 text-zinc-400 text-xs gap-3">
              <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              <span>Scanning known_hosts databases...</span>
            </div>
          ) : filteredHosts.length === 0 ? (
            <div className="text-center py-16 px-4 rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/40 space-y-3">
              <ShieldCheck className="w-10 h-10 mx-auto text-zinc-400/80" />
              <div className="space-y-1">
                <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                  {knownHosts.length === 0
                    ? 'No Known Host Records Found'
                    : `No host keys match "${searchQuery}"`}
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto leading-relaxed">
                  {knownHosts.length === 0
                    ? 'When you connect to SSH servers and verify their cryptographic host keys, entries are automatically stored here for future verification and revocation.'
                    : 'Try clearing your search query or switching source filter tabs.'}
                </p>
              </div>
              {searchQuery && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSearchQuery('')}
                  className="text-xs h-8 cursor-pointer border-zinc-300 dark:border-zinc-700"
                >
                  Clear Search
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredHosts.map((entry) => {
                const entryId = `${entry.source}-${entry.line_number}-${entry.host}`;
                const isCopied = copiedFingerprint === entryId;
                const isTermlet = entry.source === 'termlet';
                const isHashed = entry.host.startsWith('|1|');

                return (
                  <div
                    key={entryId}
                    className="p-4 rounded-lg bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                  >
                    <div className="space-y-2 min-w-0 flex-1">
                      {/* Host header & badges */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isHashed ? (
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 font-mono text-[11px] font-semibold border border-zinc-200 dark:border-zinc-700/60">
                              <Hash className="w-3 h-3 text-zinc-400" />
                              Hashed Host
                            </span>
                            <span
                              className="font-mono text-[10px] text-zinc-400 dark:text-zinc-500 truncate max-w-[280px] select-all"
                              title={`OpenSSH HashKnownHosts format: ${entry.host}`}
                            >
                              {entry.host}
                            </span>
                          </div>
                        ) : (
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-xs sm:text-sm select-all">
                            {entry.host}
                          </span>
                        )}

                        {/* Key algorithm badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-mono font-semibold ${
                            entry.key_type.includes('ed25519')
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : entry.key_type.includes('rsa')
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                              : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                          }`}
                        >
                          {entry.key_type}
                        </span>

                        {/* Source badge */}
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                            isTermlet
                              ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-semibold'
                              : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60'
                          }`}
                          title={
                            isTermlet
                              ? 'Stored in Termlet (~/.config/termlet/known_hosts)'
                              : 'Stored in OpenSSH system config (~/.ssh/known_hosts)'
                          }
                        >
                          {isTermlet ? 'Termlet Store' : 'System (~/.ssh)'}
                        </span>

                        <span className="text-[10px] text-zinc-400 select-none">
                          Line {entry.line_number}
                        </span>

                        {entry.comment && (
                          <span className="text-[10px] text-zinc-400 font-mono truncate max-w-xs">
                            ({entry.comment})
                          </span>
                        )}
                      </div>

                      {/* Fingerprint block */}
                      <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded px-2.5 py-1.5 w-fit max-w-full">
                        <Lock className="w-3 h-3 text-zinc-400 shrink-0" />
                        <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300 truncate select-all">
                          {entry.fingerprint}
                        </span>
                        <button
                          onClick={() => copyFingerprint(entry.fingerprint, entryId)}
                          className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 p-0.5 rounded cursor-pointer transition-colors"
                          title="Copy fingerprint to clipboard"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Revoke / Delete action */}
                    <div className="flex items-center gap-2 self-end sm:self-center shrink-0 pt-1 sm:pt-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveEntry(entry)}
                        className="h-8 px-2.5 text-xs text-rose-600 dark:text-rose-400 border-zinc-200 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 dark:hover:border-rose-900/60 cursor-pointer shadow-2xs transition-all"
                        title="Revoke and remove key from known_hosts"
                      >
                        <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                        Revoke Key
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
