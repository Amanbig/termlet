import React, { useState, useEffect, useCallback } from 'react';
import { Profile, SessionSummary, RemoteFile } from './types/remote';
import {
  ListProfiles,
  ListActiveSessions,
  Disconnect,
  DeleteProfile,
  Connect,
  Reconnect,
  CheckForUpdates,
  GetAppVersion,
} from '../wailsjs/go/main/App';
import { EventsOn } from '../wailsjs/runtime/runtime';
import { updater } from '../wailsjs/go/models';
import { ActivityBar, ActivityView } from './components/ActivityBar';
import { ConnectionSidebar } from './components/ConnectionSidebar';
import { RemoteFileTree } from './components/RemoteFileTree';
import { EditorTabs } from './components/EditorTabs';
import { CodeEditor } from './components/CodeEditor';
import { ConnectDialog } from './components/ConnectDialog';
import { SettingsView } from './components/SettingsView';
import { ReleaseNotesView } from './components/ReleaseNotesView';
import { PortForwardView } from './components/PortForwardView';
import { WelcomeScreen } from './components/WelcomeScreen';
import { TitleBar } from './components/TitleBar';
import { QuickOpenModal } from './components/QuickOpenModal';
import { ImportSSHConfigModal } from './components/ImportSSHConfigModal';
import { ReconnectBanner, DroppedSessionInfo } from './components/ReconnectBanner';
import { TransferDrawer } from './components/TransferDrawer';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useRemoteFiles } from './hooks/useRemoteFiles';
import { useSettings } from './hooks/useSettings';
import { useConfirm } from './context/ConfirmContext';
import { Toaster } from './components/ui/sonner';
import { toast } from 'sonner';
import { Power, Sparkles, X, Radio, ArrowUpDown } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';

const SETTINGS_TAB_PATH = 'termlet://settings';
const RELEASE_NOTES_TAB_PATH = 'termlet://release-notes';

export function App() {
  const confirm = useConfirm();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeActivityView, setActiveActivityView] = useState<ActivityView>('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [quickOpenOpen, setQuickOpenOpen] = useState(false);
  const [importSSHConfigOpen, setImportSSHConfigOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isReleaseNotesOpen, setIsReleaseNotesOpen] = useState(false);

  const [updateInfo, setUpdateInfo] = useState<updater.UpdateInfo | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [showUpdateToast, setShowUpdateToast] = useState(false);
  const [appVersion, setAppVersion] = useState('0.7.0');
  const [activePortsCount, setActivePortsCount] = useState<number>(0);
  const [droppedSession, setDroppedSession] = useState<DroppedSessionInfo | null>(null);
  const [transferDrawerOpen, setTransferDrawerOpen] = useState(false);
  const [activeTransfersCount, setActiveTransfersCount] = useState<number>(0);

  const { settings, updateSettings, resetSettings } = useSettings();

  useEffect(() => {
    GetAppVersion()
      .then((v) => {
        if (v) {
          setAppVersion(v);
          const cleanCurrent = v.replace(/^v/, '');
          const lastSeen = localStorage.getItem('termlet_last_seen_version');
          if (lastSeen) {
            const cleanLastSeen = lastSeen.replace(/^v/, '');
            // If the version has updated, open the Release Notes tab once (like VS Code!)
            if (cleanCurrent !== cleanLastSeen) {
              setIsReleaseNotesOpen(true);
              setActiveFilePath(RELEASE_NOTES_TAB_PATH);
              localStorage.setItem('termlet_last_seen_version', cleanCurrent);
            }
          } else {
            // First install: store current version so subsequent updates trigger the tab
            localStorage.setItem('termlet_last_seen_version', cleanCurrent);
          }
        }
      })
      .catch(() => {});
  }, []);

  const handleCheckForUpdates = useCallback(async () => {
    setIsCheckingUpdate(true);
    try {
      const res = await CheckForUpdates();
      if (res) {
        setUpdateInfo(res);
        if (res.currentVersion || res.current_version) {
          setAppVersion(res.currentVersion || res.current_version || '0.6.0');
        }
        if (res.available) {
          setShowUpdateToast(true);
        }
      }
    } catch (err: any) {
      console.warn('Update check failed:', err);
    } finally {
      setIsCheckingUpdate(false);
    }
  }, []);

  // Background check for updates 3 seconds after app launch
  useEffect(() => {
    const timer = setTimeout(() => {
      handleCheckForUpdates();
    }, 3000);
    return () => clearTimeout(timer);
  }, [handleCheckForUpdates]);

  const {
    openFiles,
    activeFile,
    activeFilePath,
    isSaving,
    setActiveFilePath,
    openRemoteFile,
    updateFileContent,
    saveCurrentFile,
    closeFile,
    closeAllFiles,
    closeOtherFiles,
    closeSavedFiles,
  } = useRemoteFiles();

  const currentSession = activeSessions.find((s) => s.id === currentSessionId) || null;

  // Global Shortcut: Ctrl+P / Cmd+P for Quick Open
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        if (currentSessionId) {
          setQuickOpenOpen((prev) => !prev);
        } else {
          toast.info('Connect to a remote server to quick open files');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentSessionId]);

  const refreshProfiles = useCallback(async () => {
    try {
      const list = await ListProfiles();
      setProfiles(list || []);
    } catch (err: any) {
      console.error('Failed to load profiles:', err);
    }
  }, []);

  const refreshSessions = useCallback(async () => {
    try {
      const list = await ListActiveSessions();
      setActiveSessions(list || []);
      // If current session is no longer active, select first available or null
      if (currentSessionId && !list.some((s) => s.id === currentSessionId)) {
        setCurrentSessionId(list.length > 0 ? list[0].id : null);
      } else if (!currentSessionId && list.length > 0) {
        setCurrentSessionId(list[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load sessions:', err);
    }
  }, [currentSessionId]);

  useEffect(() => {
    refreshProfiles();
    refreshSessions();
  }, [refreshProfiles, refreshSessions]);

  const handleConnected = (sessionId: string) => {
    refreshSessions();
    setCurrentSessionId(sessionId);
    setActiveActivityView('explorer');
    setSidebarOpen(true);
  };

  const handleConnectProfile = async (profile: Profile) => {
    // Check if session already active for this profile
    const existing = activeSessions.find((s) => s.profile_id === profile.id);
    if (existing) {
      setCurrentSessionId(existing.id);
      setActiveActivityView('explorer');
      setSidebarOpen(true);
      return;
    }

    // Try auto-connecting with saved secret or open dialog
    try {
      const resp = await Connect(profile, '', false);
      if (resp.success && resp.session) {
        toast.success(`Connected to ${profile.name}`);
        refreshSessions();
        setCurrentSessionId(resp.session.id);
        setActiveActivityView('explorer');
        setSidebarOpen(true);
      } else {
        // Needs credentials or host key prompt
        setEditingProfile(profile);
        setConnectDialogOpen(true);
      }
    } catch {
      setEditingProfile(profile);
      setConnectDialogOpen(true);
    }
  };

  const handleDisconnect = async (sessionId: string) => {
    try {
      await Disconnect(sessionId);
      toast.info('Closed remote connection');
      if (droppedSession && droppedSession.sessionId === sessionId) {
        setDroppedSession(null);
      }
      refreshSessions();
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (err: any) {
      toast.error(`Disconnect failed: ${err?.message || err}`);
    }
  };

  const handleReconnectSession = useCallback(
    async (sessionId: string) => {
      setDroppedSession((prev) => (prev ? { ...prev, isReconnecting: true } : null));
      try {
        const resp = await Reconnect(sessionId);
        if (resp.success && resp.session) {
          toast.success(`Reconnected to ${resp.session.profile_name || resp.session.host}`);
          setDroppedSession(null);
          await refreshSessions();
          return true;
        } else {
          const errText = resp.error || 'Failed to reconnect';
          setDroppedSession((prev) => {
            if (!prev) return null;
            const nextAttempt = prev.attempt + 1;
            const failedPermanently = nextAttempt > prev.maxAttempts;
            const delays = [3, 5, 8, 12, 15];
            const nextSec = delays[Math.min(nextAttempt - 1, delays.length - 1)];
            return {
              ...prev,
              attempt: nextAttempt,
              secondsRemaining: nextSec,
              isReconnecting: false,
              failedPermanently,
              error: errText,
            };
          });
          return false;
        }
      } catch (err: any) {
        setDroppedSession((prev) => {
          if (!prev) return null;
          const nextAttempt = prev.attempt + 1;
          const failedPermanently = nextAttempt > prev.maxAttempts;
          return {
            ...prev,
            attempt: nextAttempt,
            secondsRemaining: 5,
            isReconnecting: false,
            failedPermanently,
            error: err?.message || String(err),
          };
        });
        return false;
      }
    },
    [refreshSessions]
  );

  // Auto-reconnect countdown timer
  useEffect(() => {
    if (!droppedSession || droppedSession.isReconnecting || droppedSession.failedPermanently) {
      return;
    }

    const timer = setInterval(() => {
      setDroppedSession((prev) => {
        if (!prev || prev.isReconnecting || prev.failedPermanently) {
          return prev;
        }
        if (prev.secondsRemaining <= 1) {
          // Trigger reconnect attempt
          handleReconnectSession(prev.sessionId);
          return { ...prev, secondsRemaining: 0, isReconnecting: true };
        }
        return { ...prev, secondsRemaining: prev.secondsRemaining - 1 };
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [droppedSession, handleReconnectSession]);

  // Listen for dropped connections reported by Go keep-alive
  useEffect(() => {
    const unsub = EventsOn('session:dropped', (data: any) => {
      refreshSessions();
      if (!data || !data.sessionId) return;

      const matchedProfile = profiles.find((p) => p.id === data.profileId);
      const shouldAutoReconnect = matchedProfile?.auto_reconnect ?? true;

      setDroppedSession({
        sessionId: data.sessionId,
        profileId: data.profileId,
        profileName: data.profileName || '',
        host: data.host || '',
        port: data.port || 22,
        error: data.error || 'Connection dropped',
        attempt: 1,
        maxAttempts: 5,
        secondsRemaining: 3,
        isReconnecting: false,
        failedPermanently: !shouldAutoReconnect,
      });

      toast.error(`Connection dropped: ${data.profileName || data.host}`);
    });

    return () => {
      unsub();
    };
  }, [profiles, refreshSessions]);

  const handleDeleteProfile = async (id: string) => {
    const ok = await confirm({
      title: 'Delete Connection Profile',
      description: 'Are you sure you want to delete this connection profile? Saved host details and credentials will be removed.',
      confirmText: 'Delete',
      variant: 'destructive',
    });
    if (!ok) return;

    try {
      await DeleteProfile(id);
      toast.success('Profile deleted');
      refreshProfiles();
    } catch (err: any) {
      toast.error(`Failed to delete profile: ${err?.message || err}`);
    }
  };

  const handleOpenFile = (sessionId: string, file: RemoteFile) => {
    openRemoteFile(sessionId, file);
  };

  const handleToggleActivityView = (view: ActivityView) => {
    if (activeActivityView === view) {
      setSidebarOpen(!sidebarOpen);
    } else {
      setActiveActivityView(view);
      setSidebarOpen(true);
    }
  };

  const handleOpenSettingsTab = () => {
    setIsSettingsOpen(true);
    setActiveFilePath(SETTINGS_TAB_PATH);
  };

  const handleCloseSettingsTab = () => {
    setIsSettingsOpen(false);
    if (activeFilePath === SETTINGS_TAB_PATH) {
      if (isReleaseNotesOpen) {
        setActiveFilePath(RELEASE_NOTES_TAB_PATH);
      } else {
        const nextFile = openFiles.length > 0 ? openFiles[openFiles.length - 1] : null;
        setActiveFilePath(nextFile ? nextFile.path : null);
      }
    }
  };

  const handleOpenReleaseNotesTab = () => {
    setIsReleaseNotesOpen(true);
    setActiveFilePath(RELEASE_NOTES_TAB_PATH);
  };

  const handleCloseReleaseNotesTab = () => {
    setIsReleaseNotesOpen(false);
    if (activeFilePath === RELEASE_NOTES_TAB_PATH) {
      if (isSettingsOpen) {
        setActiveFilePath(SETTINGS_TAB_PATH);
      } else {
        const nextFile = openFiles.length > 0 ? openFiles[openFiles.length - 1] : null;
        setActiveFilePath(nextFile ? nextFile.path : null);
      }
    }
  };

  const isSettingsActive = isSettingsOpen && activeFilePath === SETTINGS_TAB_PATH;
  const isReleaseNotesActive = isReleaseNotesOpen && activeFilePath === RELEASE_NOTES_TAB_PATH;
  const showWelcome =
    !currentSessionId && openFiles.length === 0 && !isSettingsOpen && !isReleaseNotesOpen;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-sans antialiased">
      {/* Custom Frameless Window Title Bar */}
      <TitleBar
        currentSession={currentSession}
        activeFilePath={activeFilePath}
        isSettingsOpen={isSettingsOpen}
        onOpenSettings={handleOpenSettingsTab}
        onNewConnection={() => {
          setEditingProfile(null);
          setConnectDialogOpen(true);
        }}
        onOpenProfiles={() => {
          setActiveActivityView('connections');
          setSidebarOpen(true);
        }}
        onQuickOpen={() => setQuickOpenOpen(true)}
      />

      {/* Reconnect Banner if active session is dropped */}
      {droppedSession && droppedSession.sessionId === currentSessionId && (
        <ReconnectBanner
          info={droppedSession}
          onReconnectNow={() => handleReconnectSession(droppedSession.sessionId)}
          onCancel={() => setDroppedSession(null)}
        />
      )}

      {/* Main Body Area */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* 1. VS Code Style Activity Bar (Slim left strip) */}
        <ActivityBar
          activeView={activeActivityView}
          onSelectView={handleToggleActivityView}
          onNewConnection={() => {
            setEditingProfile(null);
            setConnectDialogOpen(true);
          }}
          onOpenSettings={handleOpenSettingsTab}
          hasActiveSession={!!currentSessionId}
          activePortsCount={activePortsCount}
        />

        {/* 2. Primary Side Panel (Collapsible: Explorer, Connections, or Ports) */}
        {sidebarOpen && (
          <div className={`${activeActivityView === 'ports' ? 'w-72 sm:w-80' : 'w-64'} h-full flex flex-col shrink-0 overflow-hidden bg-zinc-50 dark:bg-zinc-950/70 border-r border-zinc-200 dark:border-zinc-800/80 transition-all duration-150`}>
            <ErrorBoundary fallbackTitle="Failed to load side panel">
              {activeActivityView === 'explorer' ? (
                <RemoteFileTree
                  sessionId={currentSessionId}
                  sessionSummary={currentSession}
                  startDirectory={currentSession?.start_directory || '.'}
                  onOpenFile={handleOpenFile}
                  activeFilePath={activeFilePath}
                  onDisconnect={handleDisconnect}
                  onOpenProfiles={() => setActiveActivityView('connections')}
                />
              ) : activeActivityView === 'ports' ? (
                <PortForwardView
                  sessionId={currentSessionId}
                  activeSession={currentSession}
                  onOpenConnectDialog={() => {
                    setEditingProfile(null);
                    setConnectDialogOpen(true);
                  }}
                  onTunnelsChange={setActivePortsCount}
                />
              ) : (
                <ConnectionSidebar
                  profiles={profiles}
                  activeSessions={activeSessions}
                  currentSessionId={currentSessionId}
                  onSelectSession={(sid) => {
                    setCurrentSessionId(sid);
                    setActiveActivityView('explorer');
                  }}
                  onNewConnection={() => {
                    setEditingProfile(null);
                    setConnectDialogOpen(true);
                  }}
                  onEditProfile={(profile) => {
                    setEditingProfile(profile);
                    setConnectDialogOpen(true);
                  }}
                  onDeleteProfile={handleDeleteProfile}
                  onConnectProfile={handleConnectProfile}
                  onDisconnectSession={handleDisconnect}
                  onReconnectSession={handleReconnectSession}
                  onImportSSHConfig={() => setImportSSHConfigOpen(true)}
                />
              )}
            </ErrorBoundary>
          </div>
        )}

        {/* 3. Main Center Area: Welcome Screen, Settings Tab, or Code Workspace */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-zinc-50 dark:bg-zinc-950 overflow-hidden">
          <ErrorBoundary fallbackTitle="An unexpected view error occurred">
            {showWelcome ? (
              <WelcomeScreen
                profiles={profiles}
                onOpenProfile={handleConnectProfile}
                onNewConnection={() => {
                  setEditingProfile(null);
                  setConnectDialogOpen(true);
                }}
                onEditProfile={(profile) => {
                  setEditingProfile(profile);
                  setConnectDialogOpen(true);
                }}
                onDeleteProfile={handleDeleteProfile}
              />
            ) : (
              <div className="flex-1 flex flex-col h-full overflow-hidden">
                <EditorTabs
                  files={openFiles}
                  activeFilePath={activeFilePath}
                  isSettingsOpen={isSettingsOpen}
                  onSelect={(path) => setActiveFilePath(path)}
                  onClose={(path) => closeFile(path)}
                  onCloseAll={closeAllFiles}
                  onCloseOthers={(path) => closeOtherFiles(path)}
                  onCloseSaved={closeSavedFiles}
                  onSelectSettings={() => setActiveFilePath(SETTINGS_TAB_PATH)}
                  onCloseSettings={handleCloseSettingsTab}
                  isReleaseNotesOpen={isReleaseNotesOpen}
                  onSelectReleaseNotes={handleOpenReleaseNotesTab}
                  onCloseReleaseNotes={handleCloseReleaseNotesTab}
                />

                <ErrorBoundary fallbackTitle="Failed to render editor content">
                  {isReleaseNotesActive ? (
                    <ReleaseNotesView
                      version={appVersion}
                      onClose={handleCloseReleaseNotesTab}
                    />
                  ) : isSettingsActive ? (
                    <SettingsView
                      settings={settings}
                      onUpdateSettings={updateSettings}
                      onResetSettings={resetSettings}
                      onClose={handleCloseSettingsTab}
                      onOpenReleaseNotes={handleOpenReleaseNotesTab}
                      updateInfo={updateInfo}
                      onUpdateInfoChange={setUpdateInfo}
                      isCheckingUpdates={isCheckingUpdate}
                    />
                  ) : (
                    <CodeEditor
                      file={activeFile}
                      onChange={(newContent) => {
                        if (activeFilePath) {
                          updateFileContent(activeFilePath, newContent);
                        }
                      }}
                      onSave={saveCurrentFile}
                      isSaving={isSaving}
                      settings={settings}
                    />
                  )}
                </ErrorBoundary>
              </div>
            )}
          </ErrorBoundary>
        </div>
      </div>

      {/* 4. Global VS Code Style Bottom Status Bar */}
      <div className="h-6 bg-zinc-50 dark:bg-zinc-950 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between px-2 text-[11px] text-zinc-600 dark:text-zinc-400 select-none z-30">
        {/* Left: Remote Status Badge (like VS Code '>< SSH: Host') */}
        <div className="flex items-center gap-2">
          {currentSession ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] cursor-pointer transition-colors">
                <span className="font-mono text-[10px]">&gt;&lt;</span>
                <span>SSH: {currentSession.profile_name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 text-xs w-56">
                <DropdownMenuItem
                  onClick={() => setActiveActivityView('connections')}
                  className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  Switch Connection...
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditingProfile(null);
                    setConnectDialogOpen(true);
                  }}
                  className="cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  New Connection...
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-200 dark:bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() => handleDisconnect(currentSession.id)}
                  className="text-rose-500 focus:text-rose-500 cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <Power className="w-3.5 h-3.5 mr-2" /> Close Remote Connection
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <button
              onClick={() => {
                setEditingProfile(null);
                setConnectDialogOpen(true);
              }}
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-200/70 dark:bg-zinc-900 hover:bg-zinc-300/80 dark:hover:bg-zinc-800 border border-zinc-300/60 dark:border-zinc-800 text-zinc-800 dark:text-zinc-300 font-medium text-[11px] cursor-pointer transition-colors shadow-2xs"
            >
              <span className="font-mono text-[10px]">&gt;&lt;</span>
              <span>Open Remote SSH...</span>
            </button>
          )}

          {currentSession && (
            <span className="text-[10px] text-zinc-500 font-mono hidden sm:inline">
              {currentSession.username}@{currentSession.host}:{currentSession.port}
            </span>
          )}

          {currentSession && (
            <button
              onClick={() => {
                setActiveActivityView('ports');
                setSidebarOpen(true);
              }}
              title="Click to view Port Forwarding & Tunnels"
              className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] cursor-pointer transition-colors ${
                activePortsCount > 0
                  ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900/60'
                  : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
              }`}
            >
              <Radio className={`w-3 h-3 ${activePortsCount > 0 ? 'text-blue-500 animate-pulse' : 'text-zinc-400'}`} />
              <span>
                {activePortsCount > 0
                  ? `${activePortsCount} Port${activePortsCount === 1 ? '' : 's'} Forwarded`
                  : 'Ports'}
              </span>
            </button>
          )}

          {/* File Transfers status button */}
          <button
            onClick={() => setTransferDrawerOpen((prev) => !prev)}
            className={`px-2 py-0.5 rounded cursor-pointer transition-colors flex items-center gap-1.5 ${
              activeTransfersCount > 0
                ? 'bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 font-medium border border-blue-200 dark:border-blue-900/60'
                : transferDrawerOpen
                ? 'bg-zinc-200/80 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 font-medium'
                : 'hover:bg-zinc-200/60 dark:hover:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
            }`}
            title="Toggle File Transfers Queue"
          >
            <ArrowUpDown
              className={`w-3 h-3 ${activeTransfersCount > 0 ? 'text-blue-500 animate-pulse' : 'text-zinc-400'}`}
            />
            <span>
              {activeTransfersCount > 0
                ? `${activeTransfersCount} Transfer${activeTransfersCount === 1 ? '' : 's'}`
                : 'Transfers'}
            </span>
          </button>
        </div>

        {/* Right: Quick shortcuts / status info */}
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          {currentSession && (
            <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              Connected
            </span>
          )}
          <button
            onClick={handleOpenSettingsTab}
            className="hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer transition-colors flex items-center gap-1"
            title="Open Settings & Updates"
          >
            {updateInfo?.available && (
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
            )}
            <span>Termlet v{appVersion}</span>
          </button>
        </div>
      </div>

      {/* Connection & Host Key Dialog */}
      <ConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        initialProfile={editingProfile}
        onConnected={handleConnected}
        onProfileSaved={refreshProfiles}
        onImportSSHConfig={() => setImportSSHConfigOpen(true)}
      />

      {/* Import from ~/.ssh/config Modal */}
      <ImportSSHConfigModal
        open={importSSHConfigOpen}
        onOpenChange={setImportSSHConfigOpen}
        existingProfiles={profiles}
        onProfilesImported={refreshProfiles}
      />

      {/* Fast Remote File Quick Open Modal (Ctrl+P / Cmd+P) */}
      <QuickOpenModal
        isOpen={quickOpenOpen}
        onClose={() => setQuickOpenOpen(false)}
        sessionId={currentSessionId}
        startDirectory={currentSession?.start_directory || '.'}
        openFiles={openFiles}
        onOpenFile={handleOpenFile}
      />

      {/* SFTP Transfer Queue & Progress Drawer */}
      <TransferDrawer
        isOpen={transferDrawerOpen}
        onClose={() => setTransferDrawerOpen(false)}
        onActiveCountChange={setActiveTransfersCount}
      />

      {/* Non-intrusive Update Toast Notification */}
      {showUpdateToast && updateInfo?.available && (
        <div className="fixed bottom-8 right-5 z-40 max-w-sm w-full bg-white/95 dark:bg-zinc-900/95 border border-blue-500/40 rounded-xl p-4 shadow-2xl shadow-blue-500/20 backdrop-blur-md animate-in slide-in-from-bottom-5 duration-300 select-none">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                  Termlet Update Available
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800/60">
                    v{String(updateInfo.latestVersion || updateInfo.latest_version).replace(/^v/, '')}
                  </span>
                </h4>
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5 leading-snug">
                  A newer release is ready with improvements &amp; fixes.
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowUpdateToast(false)}
              className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="mt-3 flex items-center justify-end gap-2">
            <button
              onClick={() => setShowUpdateToast(false)}
              className="px-2.5 py-1 text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition-colors cursor-pointer"
            >
              Dismiss
            </button>
            <button
              onClick={() => {
                setShowUpdateToast(false);
                handleOpenSettingsTab();
              }}
              className="px-3 py-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-semibold rounded-lg shadow-sm cursor-pointer transition-all"
            >
              Update in Settings
            </button>
          </div>
        </div>
      )}

      {/* Notifications */}
      <Toaster theme={settings.uiTheme} position="bottom-right" closeButton richColors />
    </div>
  );
}

export default App;
