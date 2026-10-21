import React, { useState, useEffect } from 'react';
import {
  KeyRound,
  Shield,
  Copy,
  Check,
  Trash2,
  Plus,
  RefreshCw,
  Server,
  Lock,
  Unlock,
  AlertCircle,
  Eye,
  EyeOff,
  Terminal,
  FileCode,
  Search,
  X,
  ExternalLink,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import {
  ListLocalSSHKeys,
  GenerateSSHKey,
  DeleteLocalSSHKey,
  InstallSSHKeyToRemote,
  ListActiveSessions,
} from '../../wailsjs/go/main/App';
import { models, connections } from '../../wailsjs/go/models';
import { useConfirm } from '../context/ConfirmContext';
import { toast } from 'sonner';

interface SSHKeysViewProps {
  onClose?: () => void;
  activeSessionId?: string;
}

export const SSHKeysView: React.FC<SSHKeysViewProps> = ({ onClose, activeSessionId }) => {
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'list' | 'generate'>('list');
  const [keys, setKeys] = useState<models.SSHKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Key Generation Form State
  const [keyType, setKeyType] = useState<'ed25519' | 'rsa' | 'ecdsa'>('ed25519');
  const [rsaBits, setRsaBits] = useState<number>(4096);
  const [comment, setComment] = useState('termlet');
  const [passphrase, setPassphrase] = useState('');
  const [showPassphrase, setShowPassphrase] = useState(false);
  const [targetFilename, setTargetFilename] = useState('id_ed25519');
  const [saveToDisk, setSaveToDisk] = useState(true);
  const [overwrite, setOverwrite] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [generatedResult, setGeneratedResult] = useState<models.GeneratedSSHKey | null>(null);

  // Remote Install State
  const [sessions, setSessions] = useState<connections.SessionSummary[]>([]);
  const [installingKey, setInstallingKey] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>(activeSessionId || '');
  const [installSuccess, setInstallSuccess] = useState<string | null>(null);
  const [installError, setInstallError] = useState<string | null>(null);

  useEffect(() => {
    loadKeys();
    loadSessions();
  }, []);

  useEffect(() => {
    if (activeSessionId) {
      setSelectedSessionId(activeSessionId);
    }
  }, [activeSessionId]);

  // Update default target filename when keyType changes
  useEffect(() => {
    if (keyType === 'ed25519') {
      setTargetFilename('id_ed25519');
    } else if (keyType === 'rsa') {
      setTargetFilename('id_rsa');
    } else if (keyType === 'ecdsa') {
      setTargetFilename('id_ecdsa');
    }
  }, [keyType]);

  const loadKeys = async () => {
    setLoading(true);
    try {
      const list = await ListLocalSSHKeys();
      setKeys(list || []);
    } catch (err: any) {
      console.error('Failed to list SSH keys:', err);
      toast.error('Failed to list SSH keys');
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const active = await ListActiveSessions();
      setSessions(active || []);
      if (!selectedSessionId && active && active.length > 0) {
        setSelectedSessionId(active[0].id);
      }
    } catch {
      // Ignore
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success('Public key copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (keyInfo: models.SSHKeyInfo) => {
    const ok = await confirm({
      title: 'Delete SSH Key Pair',
      description: `Are you sure you want to delete the key pair "${keyInfo.name}" (${keyInfo.path})? This permanently deletes both private and public keys.`,
      confirmText: 'Delete Key',
      variant: 'destructive',
    });

    if (!ok) return;

    try {
      await DeleteLocalSSHKey(keyInfo.path);
      toast.success(`Deleted SSH key "${keyInfo.name}"`);
      await loadKeys();
    } catch (err: any) {
      toast.error(`Failed to delete key: ${err?.message || err}`);
    }
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setGenerating(true);
    setGenError(null);

    try {
      const req = new models.GenerateSSHKeyRequest({
        type: keyType,
        bits: keyType === 'rsa' ? rsaBits : 256,
        comment: comment.trim(),
        passphrase,
        saveToDisk,
        targetFilename: targetFilename.trim(),
        overwrite,
      });

      const res = await GenerateSSHKey(req);
      setGeneratedResult(res);
      toast.success('SSH Key Pair generated successfully!');
      await loadKeys();
    } catch (err: any) {
      setGenError(err?.message || 'Failed to generate SSH key');
      toast.error(err?.message || 'Failed to generate SSH key');
    } finally {
      setGenerating(false);
    }
  };

  const handleInstallToRemote = async (publicKey: string) => {
    if (!selectedSessionId) {
      toast.error('Please select an active SSH connection to install to.');
      return;
    }

    setInstallingKey(publicKey);
    setInstallError(null);
    setInstallSuccess(null);

    try {
      await InstallSSHKeyToRemote(selectedSessionId, publicKey);
      setInstallSuccess('Public key successfully installed to remote ~/.ssh/authorized_keys!');
      toast.success('Public key installed to remote server!');
      setTimeout(() => setInstallSuccess(null), 4000);
    } catch (err: any) {
      setInstallError(err?.message || 'Failed to install key to remote server.');
      toast.error(err?.message || 'Failed to install key');
    } finally {
      setInstallingKey(null);
    }
  };

  const filteredKeys = keys.filter(
    (k) =>
      k.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.comment.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.keyType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      k.fingerprint.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden select-none">
      {/* Top Header Bar & Search Bar */}
      <div className="px-6 sm:px-8 lg:px-12 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 shrink-0">
        <div className="w-full max-w-5xl mx-auto space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <KeyRound className="w-5 h-5 text-blue-500" />
                <h1 className="text-lg font-bold tracking-tight">SSH Key Pairs &amp; Identity</h1>
                <span className="px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 font-mono text-[11px] font-semibold">
                  {keys.length} {keys.length === 1 ? 'Key' : 'Keys'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Generate cryptographic SSH key pairs, inspect local keys in ~/.ssh, copy public keys, and deploy to remote servers
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={loadKeys}
                disabled={loading}
                className="h-8 text-xs px-3 text-zinc-700 dark:text-zinc-300 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer shadow-xs"
              >
                <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setActiveTab('generate');
                  setGeneratedResult(null);
                }}
                className="h-8 text-xs px-3 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5 mr-1.5" />
                New Key Pair
              </Button>
            </div>
          </div>

          {/* Centered Search & Mode Filter Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            <div className="relative flex-1 min-w-[200px] max-w-md">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-zinc-400 pointer-events-none" />
              <Input
                placeholder="Search keys by name, comment, algorithm, or fingerprint..."
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

            {/* Mode switch pills */}
            <div className="flex items-center gap-1 bg-zinc-100 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 shrink-0 self-start sm:self-auto overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list');
                  setGeneratedResult(null);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'list'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <span>Local Keys</span>
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono leading-none ${
                    activeTab === 'list'
                      ? 'bg-zinc-100 dark:bg-zinc-700/80 text-zinc-900 dark:text-zinc-100 font-bold'
                      : 'bg-zinc-200/70 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                  }`}
                >
                  {keys.length}
                </span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('generate')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all cursor-pointer whitespace-nowrap shrink-0 ${
                  activeTab === 'generate'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                <span>+ Generate Key</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-8 lg:px-12 py-6 select-text">
        <div className="w-full max-w-5xl mx-auto space-y-4 pb-12">
          {/* Notifications */}
          {installSuccess && (
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
              <Check className="w-4 h-4 shrink-0" />
              <span>{installSuccess}</span>
            </div>
          )}
          {installError && (
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{installError}</span>
            </div>
          )}

          {activeTab === 'list' ? (
            <div className="space-y-4">
              {/* Active session target banner if connected */}
              {sessions.length > 0 && (
                <div className="p-3 rounded-lg bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-400 font-medium">Target connected server for 1-click install:</span>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2.5 py-1 text-xs text-zinc-900 dark:text-zinc-100 font-medium cursor-pointer shadow-2xs"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.profile_name} ({s.username}@{s.host}:{s.port})
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[11px] text-zinc-400">
                    Keys will be appended to remote <code className="bg-zinc-200 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono">~/.ssh/authorized_keys</code>
                  </span>
                </div>
              )}

              {/* Keys List */}
              {loading ? (
                <div className="py-20 text-center text-xs text-zinc-400 flex flex-col items-center justify-center gap-2">
                  <RefreshCw className="w-5 h-5 animate-spin text-blue-500" />
                  <span>Scanning ~/.ssh for cryptographic keys...</span>
                </div>
              ) : filteredKeys.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3 bg-white/50 dark:bg-zinc-900/40">
                  <KeyRound className="w-10 h-10 mx-auto text-zinc-400" />
                  <div className="space-y-1">
                    <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                      {keys.length === 0 ? 'No SSH keys found in ~/.ssh' : `No keys matching "${searchQuery}"`}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 max-w-md mx-auto">
                      Generate modern Ed25519 or RSA key pairs to authenticate securely with remote servers without passwords.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('generate')}
                    className="text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Generate Key Pair
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5">
                  {filteredKeys.map((k) => (
                    <div
                      key={k.path}
                      className="p-4 rounded-lg bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800/80 shadow-xs hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-2 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-zinc-900 dark:text-zinc-100 text-sm">
                            {k.name}
                          </span>

                          {/* Key algorithm badge */}
                          <span className="px-2 py-0.5 rounded text-[10px] font-mono font-semibold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                            {k.keyType}
                          </span>

                          {/* Encrypted badge */}
                          {k.isEncrypted ? (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                              <Lock className="w-3 h-3" />
                              Passphrase Protected
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700/60">
                              <Unlock className="w-3 h-3" />
                              Unencrypted
                            </span>
                          )}

                          {k.comment && (
                            <span className="text-[11px] text-zinc-500 font-mono">({k.comment})</span>
                          )}
                        </div>

                        {/* Fingerprint block */}
                        <div className="flex items-center gap-2 bg-zinc-50 dark:bg-zinc-950/60 border border-zinc-200 dark:border-zinc-800/80 rounded px-2.5 py-1.5 w-fit max-w-full">
                          <Shield className="w-3 h-3 text-zinc-400 shrink-0" />
                          <span className="text-[11px] font-mono text-zinc-600 dark:text-zinc-300 truncate select-all">
                            {k.fingerprint}
                          </span>
                          <span className="text-zinc-400">•</span>
                          <span className="text-[10px] text-zinc-400 font-mono truncate max-w-xs">{k.path}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(k.publicKey, k.path)}
                          className="h-8 text-xs px-2.5 border-zinc-300 dark:border-zinc-700 cursor-pointer shadow-2xs"
                          title="Copy public key to clipboard"
                        >
                          {copiedId === k.path ? (
                            <>
                              <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 mr-1" />
                              Copy Public Key
                            </>
                          )}
                        </Button>

                        {sessions.length > 0 && (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={installingKey === k.publicKey}
                            onClick={() => handleInstallToRemote(k.publicKey)}
                            className="h-8 text-xs px-2.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer shadow-2xs"
                            title="Install key into remote server ~/.ssh/authorized_keys"
                          >
                            <Server className="w-3.5 h-3.5 mr-1" />
                            {installingKey === k.publicKey ? 'Installing...' : 'Copy to Server'}
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(k)}
                          className="h-8 w-8 p-0 text-rose-500 border-zinc-200 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 cursor-pointer shadow-2xs"
                          title="Delete key pair"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : generatedResult ? (
            /* Key Generation Success Screen */
            <div className="space-y-4 py-2">
              <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-full bg-emerald-500 text-white shadow-xs">
                    <Check className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold">SSH Key Pair Created Successfully!</h4>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {generatedResult.savedPath
                        ? `Saved to ${generatedResult.savedPath} with strict 0600 file permissions`
                        : 'Generated in memory'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Public Key Display */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Public Key (OpenSSH authorized_keys format)
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(generatedResult.publicKey, 'gen-pub')}
                    className="h-7 text-xs px-2.5 text-blue-600 dark:text-blue-400 cursor-pointer"
                  >
                    {copiedId === 'gen-pub' ? (
                      <>
                        <Check className="w-3.5 h-3.5 mr-1 text-emerald-500" />
                        Copied to Clipboard
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 mr-1" />
                        Copy Public Key
                      </>
                    )}
                  </Button>
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    value={generatedResult.publicKey}
                    className="w-full h-24 p-3 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-xs select-all border border-zinc-800 resize-none focus:outline-hidden leading-relaxed"
                  />
                </div>
              </div>

              {/* Fingerprint & Randomart Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Fingerprint (SHA256)</span>
                    <p className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-1 break-all select-all">
                      {generatedResult.fingerprint}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Key Type &amp; Size</span>
                    <p className="font-mono text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                      {generatedResult.keyType} ({generatedResult.bits} bits)
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400 tracking-wider">Comment</span>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5 font-mono">
                      {generatedResult.comment || 'none'}
                    </p>
                  </div>
                </div>

                {/* OpenSSH Randomart Visualizer */}
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-200 space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                    <span>OpenSSH Randomart Visualizer</span>
                    <Terminal className="w-3.5 h-3.5 text-zinc-400" />
                  </div>
                  <pre className="font-mono text-[11px] leading-tight text-emerald-400 select-all overflow-x-auto p-1">
                    {generatedResult.randomart}
                  </pre>
                </div>
              </div>

              {/* Quick actions bottom toolbar */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-200 dark:border-zinc-800">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setGeneratedResult(null);
                    setActiveTab('generate');
                  }}
                  className="h-8 text-xs cursor-pointer"
                >
                  Generate Another Key
                </Button>

                <div className="flex items-center gap-2">
                  {sessions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleInstallToRemote(generatedResult.publicKey)}
                      className="h-8 text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer shadow-2xs"
                    >
                      <Server className="w-3.5 h-3.5 mr-1.5" />
                      Install Key to Remote Server
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('list')}
                    className="h-8 text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 cursor-pointer shadow-2xs font-semibold"
                  >
                    View All Local Keys
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Key Generation Form */
            <div className="p-6 rounded-xl bg-white dark:bg-zinc-900/70 border border-zinc-200 dark:border-zinc-800 shadow-xs">
              <form onSubmit={handleGenerate} className="space-y-5">
                {genError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{genError}</span>
                  </div>
                )}

                {/* Algorithm choice */}
                <div className="space-y-2">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Key Algorithm &amp; Type
                  </Label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setKeyType('ed25519')}
                      className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                        keyType === 'ed25519'
                          ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                      }`}
                    >
                      <div className="font-semibold text-xs flex items-center justify-between">
                        <span>Ed25519</span>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-blue-500/20 font-bold uppercase">
                          Recommended
                        </span>
                      </div>
                      <p className="text-[11px] text-zinc-500 mt-1">256-bit elliptic curve, ultra-fast &amp; secure</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKeyType('rsa')}
                      className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                        keyType === 'rsa'
                          ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                      }`}
                    >
                      <div className="font-semibold text-xs">RSA</div>
                      <p className="text-[11px] text-zinc-500 mt-1">Classic public-key algorithm, maximum legacy compatibility</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setKeyType('ecdsa')}
                      className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                        keyType === 'ecdsa'
                          ? 'bg-blue-500/10 border-blue-500 text-blue-600 dark:text-blue-400 ring-1 ring-blue-500'
                          : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 hover:border-zinc-300'
                      }`}
                    >
                      <div className="font-semibold text-xs">ECDSA</div>
                      <p className="text-[11px] text-zinc-500 mt-1">NIST standard elliptic curve cryptography</p>
                    </button>
                  </div>
                </div>

                {/* RSA Bits Selector (if RSA) */}
                {keyType === 'rsa' && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      RSA Bit Length
                    </Label>
                    <div className="flex items-center gap-2">
                      {[2048, 3072, 4096].map((b) => (
                        <button
                          key={b}
                          type="button"
                          onClick={() => setRsaBits(b)}
                          className={`px-3 py-1.5 rounded-md text-xs font-mono cursor-pointer border transition-all ${
                            rsaBits === b
                              ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 font-bold border-transparent'
                              : 'bg-zinc-50 dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300'
                          }`}
                        >
                          {b} bits {b === 4096 && '(Recommended)'}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Key Comment & Target Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-700 dark:text-zinc-300">
                      Key Comment
                    </Label>
                    <Input
                      placeholder="user@termlet or email"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                      className="h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-700 dark:text-zinc-300">
                      Target Filename in ~/.ssh/
                    </Label>
                    <Input
                      placeholder="id_ed25519"
                      value={targetFilename}
                      onChange={(e) => setTargetFilename(e.target.value)}
                      className="h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 font-mono"
                    />
                  </div>
                </div>

                {/* Passphrase */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-700 dark:text-zinc-300">
                    Passphrase (Optional, protects private key with AES-256)
                  </Label>
                  <div className="relative">
                    <Input
                      type={showPassphrase ? 'text' : 'password'}
                      placeholder="Leave empty for unencrypted key"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="h-9 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-700 pr-9"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassphrase(!showPassphrase)}
                      className="absolute right-3 top-2.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                    >
                      {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500">
                    A passphrase encrypts your private key file so anyone with physical access to your disk cannot use it without your password.
                  </p>
                </div>

                {/* Save directly to disk checkbox */}
                <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-t border-zinc-100 dark:border-zinc-800/80">
                  <label className="flex items-center gap-2 cursor-pointer text-xs text-zinc-700 dark:text-zinc-300">
                    <input
                      type="checkbox"
                      checked={saveToDisk}
                      onChange={(e) => setSaveToDisk(e.target.checked)}
                      className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span>Save key pair directly to ~/.ssh/</span>
                  </label>

                  {saveToDisk && (
                    <label className="flex items-center gap-2 cursor-pointer text-xs text-amber-600 dark:text-amber-400">
                      <input
                        type="checkbox"
                        checked={overwrite}
                        onChange={(e) => setOverwrite(e.target.checked)}
                        className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
                      />
                      <span>Overwrite if file already exists</span>
                    </label>
                  )}
                </div>

                {/* Submit button */}
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab('list')}
                    className="h-8 text-xs cursor-pointer"
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={generating}
                    className="h-8 text-xs px-4 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs font-semibold"
                  >
                    {generating ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Generating Key...
                      </>
                    ) : (
                      <>
                        <KeyRound className="w-3.5 h-3.5 mr-1.5" />
                        Generate Key Pair
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
