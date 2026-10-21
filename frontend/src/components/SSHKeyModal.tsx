import React, { useState, useEffect } from 'react';
import {
  Key,
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
  Download,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from './ui/dialog';
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

interface SSHKeyModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectKeyPath?: (path: string) => void;
  activeSessionId?: string;
}

export const SSHKeyModal: React.FC<SSHKeyModalProps> = ({
  isOpen,
  onClose,
  onSelectKeyPath,
  activeSessionId,
}) => {
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
    if (isOpen) {
      loadKeys();
      loadSessions();
      setGeneratedResult(null);
      setGenError(null);
      setInstallSuccess(null);
      setInstallError(null);
    }
  }, [isOpen]);

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
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDelete = async (keyPath: string) => {
    if (!window.confirm(`Are you sure you want to delete SSH key:\n${keyPath}\n\nThis will remove both private and public keys.`)) {
      return;
    }
    try {
      await DeleteLocalSSHKey(keyPath);
      await loadKeys();
    } catch (err: any) {
      alert(`Failed to delete key: ${err?.message || err}`);
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
      await loadKeys();
    } catch (err: any) {
      setGenError(err?.message || 'Failed to generate SSH key');
    } finally {
      setGenerating(false);
    }
  };

  const handleInstallToRemote = async (publicKey: string) => {
    if (!selectedSessionId) {
      setInstallError('Please select an active SSH connection to install to.');
      return;
    }

    setInstallingKey(publicKey);
    setInstallError(null);
    setInstallSuccess(null);

    try {
      await InstallSSHKeyToRemote(selectedSessionId, publicKey);
      setInstallSuccess('Public key successfully installed to remote ~/.ssh/authorized_keys!');
      setTimeout(() => setInstallSuccess(null), 4000);
    } catch (err: any) {
      setInstallError(err?.message || 'Failed to install key to remote server.');
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
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col p-0 overflow-hidden bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-5 pb-3 border-b border-zinc-200 dark:border-zinc-800/80 bg-zinc-50/50 dark:bg-zinc-900/40">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                <KeyRound className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                  SSH Key Manager &amp; Generator
                </DialogTitle>
                <DialogDescription className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                  Generate cryptographic SSH key pairs, inspect local keys, and copy public keys to remote servers
                </DialogDescription>
              </div>
            </div>

            {/* Mode switch pills */}
            <div className="flex items-center gap-1 bg-zinc-200/60 dark:bg-zinc-900 p-1 rounded-lg border border-zinc-200 dark:border-zinc-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setActiveTab('list');
                  setGeneratedResult(null);
                }}
                className={`px-3 py-1 rounded-md font-medium cursor-pointer transition-all ${
                  activeTab === 'list'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                Local Keys ({keys.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('generate')}
                className={`px-3 py-1 rounded-md font-medium cursor-pointer transition-all ${
                  activeTab === 'generate'
                    ? 'bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-2xs font-semibold'
                    : 'text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200'
                }`}
              >
                + Generate Key
              </button>
            </div>
          </div>
        </div>

        {/* Global Notifications */}
        {installSuccess && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0" />
            <span>{installSuccess}</span>
          </div>
        )}
        {installError && (
          <div className="mx-6 mt-3 px-3 py-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{installError}</span>
          </div>
        )}

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {activeTab === 'list' ? (
            <div className="space-y-4">
              {/* Search & Actions Toolbar */}
              <div className="flex items-center justify-between gap-3">
                <Input
                  placeholder="Filter keys by name, comment, or algorithm..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 flex-1 max-w-sm"
                />

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={loadKeys}
                    disabled={loading}
                    className="h-8 text-xs px-2.5 cursor-pointer text-zinc-700 dark:text-zinc-300"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 mr-1 ${loading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('generate')}
                    className="h-8 text-xs px-3 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" />
                    New Key Pair
                  </Button>
                </div>
              </div>

              {/* Active session target banner if connected */}
              {sessions.length > 0 && (
                <div className="p-2.5 rounded-lg bg-zinc-100 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <Server className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="text-zinc-600 dark:text-zinc-400">Target server for 1-click install:</span>
                    <select
                      value={selectedSessionId}
                      onChange={(e) => setSelectedSessionId(e.target.value)}
                      className="bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded px-2 py-0.5 text-xs text-zinc-900 dark:text-zinc-100 font-medium cursor-pointer"
                    >
                      {sessions.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.profile_name} ({s.username}@{s.host}:{s.port})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Keys List */}
              {loading ? (
                <div className="py-12 text-center text-xs text-zinc-400">Scanning ~/.ssh for keys...</div>
              ) : filteredKeys.length === 0 ? (
                <div className="py-12 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-xl space-y-3">
                  <Key className="w-8 h-8 mx-auto text-zinc-400" />
                  <div className="space-y-1">
                    <p className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                      {keys.length === 0 ? 'No SSH keys found in ~/.ssh' : `No keys matching "${searchQuery}"`}
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      Generate a modern Ed25519 or RSA key pair to authenticate securely without passwords.
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
                      className="p-3.5 rounded-lg bg-zinc-50/70 dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/80 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1.5 min-w-0 flex-1">
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
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 font-medium">
                              <Lock className="w-2.5 h-2.5" />
                              Passphrase Protected
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] bg-zinc-200/50 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-300 dark:border-zinc-700">
                              <Unlock className="w-2.5 h-2.5" />
                              Unencrypted
                            </span>
                          )}

                          {k.comment && (
                            <span className="text-[11px] text-zinc-500 font-mono">({k.comment})</span>
                          )}
                        </div>

                        {/* Fingerprint & path */}
                        <div className="flex items-center gap-2 text-[11px] text-zinc-500 dark:text-zinc-400 font-mono truncate">
                          <span className="text-zinc-700 dark:text-zinc-300 select-all">{k.fingerprint}</span>
                          <span className="text-zinc-400">•</span>
                          <span className="truncate text-zinc-400">{k.path}</span>
                        </div>
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
                        {onSelectKeyPath && k.hasPrivateKey && (
                          <Button
                            variant="default"
                            size="sm"
                            onClick={() => {
                              onSelectKeyPath(k.path);
                              onClose();
                            }}
                            className="h-7 text-xs px-2.5 bg-blue-600 hover:bg-blue-500 text-white cursor-pointer shadow-2xs"
                          >
                            Use in Profile
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleCopy(k.publicKey, k.path)}
                          className="h-7 text-xs px-2.5 border-zinc-300 dark:border-zinc-700 cursor-pointer"
                          title="Copy public key to clipboard"
                        >
                          {copiedId === k.path ? (
                            <>
                              <Check className="w-3 h-3 mr-1 text-emerald-500" />
                              Copied
                            </>
                          ) : (
                            <>
                              <Copy className="w-3 h-3 mr-1" />
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
                            className="h-7 text-xs px-2.5 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                            title="Install key into remote server ~/.ssh/authorized_keys"
                          >
                            <Server className="w-3 h-3 mr-1" />
                            {installingKey === k.publicKey ? 'Installing...' : 'Copy to Server'}
                          </Button>
                        )}

                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(k.path)}
                          className="h-7 w-7 p-0 text-rose-500 border-zinc-200 dark:border-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:border-rose-300 cursor-pointer"
                          title="Delete key pair"
                        >
                          <Trash2 className="w-3 h-3" />
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
              <div className="p-3.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="p-1.5 rounded-full bg-emerald-500 text-white">
                    <Check className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold">SSH Key Pair Created Successfully!</h4>
                    <p className="text-[11px] text-emerald-600 dark:text-emerald-400">
                      {generatedResult.savedPath
                        ? `Saved to ${generatedResult.savedPath} with 0600 file permissions`
                        : 'Generated in memory'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {onSelectKeyPath && generatedResult.savedPath && (
                    <Button
                      size="sm"
                      onClick={() => {
                        onSelectKeyPath(generatedResult.savedPath);
                        onClose();
                      }}
                      className="h-7 text-xs bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                    >
                      Use in Profile
                    </Button>
                  )}
                </div>
              </div>

              {/* Public Key Display */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                    Public Key (authorized_keys format)
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(generatedResult.publicKey, 'gen-pub')}
                    className="h-6 text-[11px] px-2 text-blue-600 dark:text-blue-400 cursor-pointer"
                  >
                    {copiedId === 'gen-pub' ? (
                      <>
                        <Check className="w-3 h-3 mr-1 text-emerald-500" />
                        Copied to Clipboard
                      </>
                    ) : (
                      <>
                        <Copy className="w-3 h-3 mr-1" />
                        Copy Public Key
                      </>
                    )}
                  </Button>
                </div>
                <div className="relative">
                  <textarea
                    readOnly
                    value={generatedResult.publicKey}
                    className="w-full h-20 p-2.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-[11px] select-all border border-zinc-800 resize-none focus:outline-hidden"
                  />
                </div>
              </div>

              {/* Fingerprint & Randomart Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Fingerprint (SHA256)</span>
                    <p className="font-mono text-xs font-semibold text-zinc-800 dark:text-zinc-200 mt-0.5 break-all select-all">
                      {generatedResult.fingerprint}
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Key Type &amp; Size</span>
                    <p className="font-mono text-xs text-zinc-600 dark:text-zinc-300 mt-0.5">
                      {generatedResult.keyType} ({generatedResult.bits} bits)
                    </p>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase font-bold text-zinc-400">Comment</span>
                    <p className="text-xs text-zinc-600 dark:text-zinc-300 mt-0.5 font-mono">
                      {generatedResult.comment || 'none'}
                    </p>
                  </div>
                </div>

                {/* OpenSSH Randomart */}
                <div className="p-3 rounded-lg bg-zinc-900 border border-zinc-800 text-zinc-200 space-y-1">
                  <div className="flex items-center justify-between text-[10px] text-zinc-400 font-mono">
                    <span>OpenSSH Randomart Visualizer</span>
                    <Terminal className="w-3 h-3" />
                  </div>
                  <pre className="font-mono text-[10.5px] leading-tight text-emerald-400 select-all overflow-x-auto">
                    {generatedResult.randomart}
                  </pre>
                </div>
              </div>

              {/* Quick actions bottom toolbar */}
              <div className="flex items-center justify-between pt-2">
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
                      className="h-8 text-xs text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                    >
                      <Server className="w-3.5 h-3.5 mr-1.5" />
                      Install Key to Remote Server
                    </Button>
                  )}
                  <Button
                    size="sm"
                    onClick={() => setActiveTab('list')}
                    className="h-8 text-xs bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 cursor-pointer"
                  >
                    View All Keys
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            /* Key Generation Form */
            <form onSubmit={handleGenerate} className="space-y-4 py-1">
              {genError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              {/* Algorithm choice */}
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                  Key Algorithm &amp; Type
                </Label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setKeyType('ed25519')}
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
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
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
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
                    className={`p-3 rounded-lg border text-left cursor-pointer transition-all ${
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
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-700 dark:text-zinc-300">
                    Key Comment
                  </Label>
                  <Input
                    placeholder="user@termlet or email"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 font-mono"
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
                    className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 font-mono"
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
                    className="h-8 text-xs bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 pr-8"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassphrase(!showPassphrase)}
                    className="absolute right-2 top-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
                  >
                    {showPassphrase ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-zinc-500">
                  A passphrase encrypts your private key file so anyone with access to your disk cannot use it without the password.
                </p>
              </div>

              {/* Save directly to disk checkbox */}
              <div className="pt-1 flex items-center justify-between">
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
                    <span>Overwrite if file exists</span>
                  </label>
                )}
              </div>

              {/* Submit button */}
              <div className="pt-3 border-t border-zinc-200 dark:border-zinc-800 flex items-center justify-end gap-2">
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
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
