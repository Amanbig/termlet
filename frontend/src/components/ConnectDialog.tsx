import React, { useState, useEffect } from 'react';
import { Profile, HostKeyPrompt } from '../types/remote';
import { Connect, SaveProfile, GetProfileSecret } from '../../wailsjs/go/main/App';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './ui/tabs';
import { ShieldAlert, Server, Key, Lock, Loader2, Check, AlertTriangle, ChevronDown, ChevronUp, FolderDown } from 'lucide-react';
import { toast } from 'sonner';
import { formatErrorMessage, FormattedError } from '../utils/errors';

interface ConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialProfile?: Profile | null;
  onConnected: (sessionId: string, profile: Profile) => void;
  onProfileSaved?: () => void;
  onImportSSHConfig?: () => void;
}

export const ConnectDialog: React.FC<ConnectDialogProps> = ({
  open,
  onOpenChange,
  initialProfile,
  onConnected,
  onProfileSaved,
  onImportSSHConfig,
}) => {
  const [name, setName] = useState('');
  const [host, setHost] = useState('');
  const [port, setPort] = useState(22);
  const [username, setUsername] = useState('');
  const [authMethod, setAuthMethod] = useState<'password' | 'private_key' | 'agent'>('password');
  const [password, setPassword] = useState('');
  const [keyPath, setKeyPath] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [startDirectory, setStartDirectory] = useState('.');
  const [saveProfileCheckbox, setSaveProfileCheckbox] = useState(true);

  const [isConnecting, setIsConnecting] = useState(false);
  const [hostKeyPrompt, setHostKeyPrompt] = useState<HostKeyPrompt | null>(null);
  const [connError, setConnError] = useState<FormattedError | null>(null);
  const [showErrorRaw, setShowErrorRaw] = useState(false);

  useEffect(() => {
    setConnError(null);
    setShowErrorRaw(false);
    if (initialProfile) {
      setName(initialProfile.name || '');
      setHost(initialProfile.host || '');
      setPort(initialProfile.port || 22);
      setUsername(initialProfile.username || '');
      setAuthMethod((initialProfile.auth_method as any) || 'password');
      setKeyPath(initialProfile.key_path || '');
      setStartDirectory(initialProfile.start_directory || '.');
      // Fetch saved secret if any
      if (initialProfile.id) {
        GetProfileSecret(initialProfile.id).then((sec) => {
          if (sec) setPassword(sec);
        });
      }
    } else {
      setName('');
      setHost('');
      setPort(22);
      setUsername('');
      setAuthMethod('password');
      setPassword('');
      setKeyPath('');
      setPassphrase('');
      setStartDirectory('.');
    }
    setHostKeyPrompt(null);
  }, [initialProfile, open]);

  const handleSubmit = async (trustKey = false) => {
    if (!host.trim() || !username.trim()) {
      toast.error('Host and Username are required');
      return;
    }

    setConnError(null);
    setIsConnecting(true);
    try {
      const profileData: Profile = {
        id: initialProfile?.id || (Date.now().toString()),
        name: name.trim() || `${username}@${host}`,
        host: host.trim(),
        port: Number(port) || 22,
        username: username.trim(),
        auth_method: authMethod,
        key_path: authMethod === 'private_key' ? keyPath.trim() : '',
        start_directory: startDirectory.trim() || '.',
        port_forwards: initialProfile?.port_forwards || [],
        created_at: initialProfile?.created_at || Date.now(),
        updated_at: Date.now(),
      } as any;

      const secretToUse = authMethod === 'private_key' ? passphrase : password;
      const resp = await Connect(profileData, secretToUse, trustKey);

      if (resp.host_key_prompt) {
        // Requires user host key approval
        setHostKeyPrompt(resp.host_key_prompt);
        setIsConnecting(false);
        return;
      }

      if (!resp.success || !resp.session) {
        const formatted = formatErrorMessage(resp.error || 'Connection failed', 'SSH Connection');
        setConnError(formatted);
        toast.error(`${formatted.title}: ${formatted.message}`);
        setIsConnecting(false);
        return;
      }

      // Save profile if requested
      if (saveProfileCheckbox) {
        await SaveProfile(profileData, secretToUse);
        if (onProfileSaved) onProfileSaved();
      }

      toast.success(`Connected to ${profileData.name}`);
      onConnected(resp.session.id, profileData);
      onOpenChange(false);
    } catch (err: any) {
      const formatted = formatErrorMessage(err, 'SSH Connection');
      setConnError(formatted);
      toast.error(`${formatted.title}: ${formatted.message}`);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <>
      <Dialog open={open && !hostKeyPrompt} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-[480px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
              <Server className="w-5 h-5 text-blue-500" />
              {initialProfile ? 'Edit Connection Profile' : 'New SSH Connection'}
            </DialogTitle>
            <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs">
              Configure remote server connection settings and credentials.
            </DialogDescription>
            {!initialProfile && onImportSSHConfig && (
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    onOpenChange(false);
                    onImportSSHConfig();
                  }}
                  className="w-full text-xs h-7.5 border-dashed border-blue-400/60 dark:border-blue-600/40 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/30 cursor-pointer"
                >
                  <FolderDown className="w-3.5 h-3.5 mr-1.5" />
                  Have an SSH config? Import from ~/.ssh/config
                </Button>
              </div>
            )}
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Profile Name */}
            <div className="space-y-1.5">
              <Label className="text-xs text-zinc-700 dark:text-zinc-300">Profile Name (optional)</Label>
              <Input
                placeholder="e.g. Production Web Server"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-8"
              />
            </div>

            {/* Host & Port */}
            <div className="grid grid-cols-4 gap-2">
              <div className="col-span-3 space-y-1.5">
                <Label className="text-xs text-zinc-700 dark:text-zinc-300">Host / IP *</Label>
                <Input
                  placeholder="192.168.1.10 or example.com"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-8"
                />
              </div>
              <div className="col-span-1 space-y-1.5">
                <Label className="text-xs text-zinc-700 dark:text-zinc-300">Port</Label>
                <Input
                  type="number"
                  value={port}
                  onChange={(e) => setPort(Number(e.target.value))}
                  className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-8 font-mono [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                />
              </div>
            </div>

            {/* Username & Start Directory */}
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-700 dark:text-zinc-300">Username *</Label>
                <Input
                  placeholder="root or ubuntu"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-8"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-zinc-700 dark:text-zinc-300">Remote Directory</Label>
                <Input
                  placeholder="/var/www or ."
                  value={startDirectory}
                  onChange={(e) => setStartDirectory(e.target.value)}
                  className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-8"
                />
              </div>
            </div>

            {/* Auth Method Tabs */}
            <div className="space-y-2 pt-1">
              <Label className="text-xs text-zinc-700 dark:text-zinc-300">Authentication</Label>
              <Tabs
                value={authMethod}
                onValueChange={(v) => setAuthMethod(v as any)}
                className="w-full"
              >
                <TabsList className="grid grid-cols-3 bg-zinc-100 dark:bg-zinc-900 h-8 p-0.5 border border-zinc-200 dark:border-zinc-800">
                  <TabsTrigger value="password" className="text-xs h-7">
                    Password
                  </TabsTrigger>
                  <TabsTrigger value="private_key" className="text-xs h-7">
                    Private Key
                  </TabsTrigger>
                  <TabsTrigger value="agent" className="text-xs h-7">
                    SSH Agent
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="password" className="space-y-2 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-600 dark:text-zinc-400">Password</Label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-8"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="private_key" className="space-y-2 pt-2">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-600 dark:text-zinc-400">Private Key File Path</Label>
                    <Input
                      placeholder="/home/user/.ssh/id_ed25519"
                      value={keyPath}
                      onChange={(e) => setKeyPath(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-8"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-zinc-600 dark:text-zinc-400">Passphrase (if encrypted)</Label>
                    <Input
                      type="password"
                      placeholder="••••••••••••"
                      value={passphrase}
                      onChange={(e) => setPassphrase(e.target.value)}
                      className="bg-zinc-50 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs h-8"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="agent" className="pt-2">
                  <p className="text-xs text-zinc-500">
                    Will use identities from the local SSH Agent (<code className="text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 px-1 py-0.5 rounded">$SSH_AUTH_SOCK</code>).
                  </p>
                </TabsContent>
              </Tabs>
            </div>

            {/* Save Profile Checkbox */}
            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="saveProfile"
                checked={saveProfileCheckbox}
                onChange={(e) => setSaveProfileCheckbox(e.target.checked)}
                className="rounded border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-blue-600 cursor-pointer"
              />
              <Label htmlFor="saveProfile" className="text-xs text-zinc-600 dark:text-zinc-400 cursor-pointer">
                Save connection profile to termlet
              </Label>
            </div>

            {/* Inline Error Banner */}
            {connError && (
              <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 dark:bg-rose-950/30 p-3 text-xs text-rose-800 dark:text-rose-200 animate-in fade-in duration-200">
                <div className="flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <h5 className="font-semibold text-rose-900 dark:text-rose-100">
                      {connError.title}
                    </h5>
                    <p className="mt-0.5 text-rose-700 dark:text-rose-300 leading-relaxed">
                      {connError.message}
                    </p>
                    {connError.hint && (
                      <p className="mt-1 text-[11px] text-zinc-600 dark:text-zinc-400 bg-white/60 dark:bg-zinc-900/60 p-2 rounded border border-rose-500/20">
                        <span className="font-semibold text-zinc-800 dark:text-zinc-200">Hint: </span>
                        {connError.hint}
                      </p>
                    )}
                    {connError.raw && (
                      <div className="mt-1.5">
                        <button
                          type="button"
                          onClick={() => setShowErrorRaw(!showErrorRaw)}
                          className="text-[10px] text-rose-600 dark:text-rose-400 hover:underline flex items-center gap-1 cursor-pointer"
                        >
                          {showErrorRaw ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                          <span>{showErrorRaw ? 'Hide technical details' : 'Show technical details'}</span>
                        </button>
                        {showErrorRaw && (
                          <pre className="mt-1 p-1.5 rounded bg-black/10 dark:bg-black/40 text-[10px] font-mono text-zinc-700 dark:text-zinc-300 overflow-x-auto whitespace-pre-wrap break-all">
                            {connError.raw}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs h-8 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
            >
              Cancel
            </Button>
            <Button
              onClick={() => handleSubmit(false)}
              disabled={isConnecting}
              className="bg-blue-600 hover:bg-blue-500 text-white text-xs h-8 cursor-pointer"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" /> Connecting...
                </>
              ) : (
                'Connect'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Host Key Inspection & Approval Modal */}
      {hostKeyPrompt && (
        <Dialog open={true} onOpenChange={() => setHostKeyPrompt(null)}>
          <DialogContent className="sm:max-w-[500px] bg-white dark:bg-zinc-950 border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
                <ShieldAlert
                  className={`w-5 h-5 ${
                    hostKeyPrompt.status === 'changed' ? 'text-rose-500' : 'text-amber-500'
                  }`}
                />
                {hostKeyPrompt.status === 'changed'
                  ? 'SECURITY WARNING: Host Key Changed!'
                  : 'Untrusted Host Key Detected'}
              </DialogTitle>
              <DialogDescription className="text-zinc-500 dark:text-zinc-400 text-xs">
                {hostKeyPrompt.message}
              </DialogDescription>
            </DialogHeader>

            <div className="bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-md p-3 space-y-2 text-xs font-mono">
              <div className="flex justify-between">
                <span className="text-zinc-500">Host:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{hostKeyPrompt.hostname} ({hostKeyPrompt.address})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Key Type:</span>
                <span className="text-zinc-800 dark:text-zinc-200">{hostKeyPrompt.key_type}</span>
              </div>
              <div>
                <span className="text-zinc-500 block mb-1">Fingerprint (SHA256):</span>
                <span className="text-amber-600 dark:text-amber-400 break-all select-all">{hostKeyPrompt.fingerprint}</span>
              </div>
            </div>

            {hostKeyPrompt.status === 'changed' && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 p-2.5 rounded border border-rose-200 dark:border-rose-900/60">
                Someone could be eavesdropping on you right now (man-in-the-middle attack)! If the server was not recently re-installed, do NOT continue.
              </p>
            )}

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setHostKeyPrompt(null)}
                className="bg-zinc-100 dark:bg-zinc-900 border-zinc-300 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 text-xs h-8 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Reject & Abort
              </Button>
              <Button
                variant={hostKeyPrompt.status === 'changed' ? 'destructive' : 'default'}
                onClick={() => {
                  setHostKeyPrompt(null);
                  handleSubmit(true);
                }}
                className={`text-xs h-8 ${
                  hostKeyPrompt.status === 'changed'
                    ? 'bg-rose-600 hover:bg-rose-500'
                    : 'bg-emerald-600 hover:bg-emerald-500'
                }`}
              >
                <Check className="w-3.5 h-3.5 mr-1" />
                Trust Key & Connect
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
};
