import React, { useState, useEffect, useCallback } from 'react';
import { Profile, SessionSummary, RemoteFile } from './types/remote';
import {
  ListProfiles,
  ListActiveSessions,
  Disconnect,
  DeleteProfile,
  Connect,
} from '../wailsjs/go/main/App';
import { ActivityBar, ActivityView } from './components/ActivityBar';
import { ConnectionSidebar } from './components/ConnectionSidebar';
import { RemoteFileTree } from './components/RemoteFileTree';
import { EditorTabs } from './components/EditorTabs';
import { CodeEditor } from './components/CodeEditor';
import { ConnectDialog } from './components/ConnectDialog';
import { WelcomeScreen } from './components/WelcomeScreen';
import { useRemoteFiles } from './hooks/useRemoteFiles';
import { Toaster, toast } from 'sonner';
import { Terminal, Radio, ChevronRight, X, Power } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './components/ui/dropdown-menu';

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [activeActivityView, setActiveActivityView] = useState<ActivityView>('explorer');
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const [connectDialogOpen, setConnectDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);

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
  } = useRemoteFiles();

  const currentSession = activeSessions.find((s) => s.id === currentSessionId) || null;

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
      refreshSessions();
      if (currentSessionId === sessionId) {
        setCurrentSessionId(null);
      }
    } catch (err: any) {
      toast.error(`Disconnect failed: ${err?.message || err}`);
    }
  };

  const handleDeleteProfile = async (id: string) => {
    const confirmDelete = window.confirm('Are you sure you want to delete this connection profile?');
    if (!confirmDelete) return;

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

  const showWelcome = !currentSessionId && openFiles.length === 0;

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans antialiased">
      {/* Main Body Area */}
      <div className="flex-1 flex h-[calc(100vh-24px)] overflow-hidden">
        {/* 1. VS Code Style Activity Bar (Slim left strip) */}
        <ActivityBar
          activeView={activeActivityView}
          onSelectView={handleToggleActivityView}
          onNewConnection={() => {
            setEditingProfile(null);
            setConnectDialogOpen(true);
          }}
          hasActiveSession={!!currentSessionId}
        />

        {/* 2. Primary Side Panel (Collapsible: Explorer or Connections) */}
        {sidebarOpen && (
          <div className="w-64 h-full flex flex-col shrink-0 overflow-hidden bg-zinc-950/70 border-r border-zinc-800/80">
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
              />
            )}
          </div>
        )}

        {/* 3. Main Center Area: Welcome Screen or Code Workspace */}
        <div className="flex-1 flex flex-col h-full min-w-0 bg-zinc-950 overflow-hidden">
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
                onSelect={setActiveFilePath}
                onClose={(path) => closeFile(path)}
                onCloseAll={closeAllFiles}
              />

              <CodeEditor
                file={activeFile}
                onChange={(newContent) => {
                  if (activeFilePath) {
                    updateFileContent(activeFilePath, newContent);
                  }
                }}
                onSave={saveCurrentFile}
                isSaving={isSaving}
              />
            </div>
          )}
        </div>
      </div>

      {/* 4. Global VS Code Style Bottom Status Bar */}
      <div className="h-6 bg-zinc-900 border-t border-zinc-800 flex items-center justify-between px-2 text-[11px] text-zinc-400 select-none z-30">
        {/* Left: Remote Status Badge (like VS Code '>< SSH: Host') */}
        <div className="flex items-center gap-2">
          {currentSession ? (
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-600 hover:bg-blue-500 text-white font-medium text-[11px] cursor-pointer transition-colors">
                <span className="font-mono text-[10px]">&gt;&lt;</span>
                <span>SSH: {currentSession.profile_name}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="top" className="bg-zinc-900 border-zinc-800 text-zinc-200 text-xs w-56">
                <DropdownMenuItem
                  onClick={() => setActiveActivityView('connections')}
                  className="cursor-pointer"
                >
                  Switch Connection...
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => {
                    setEditingProfile(null);
                    setConnectDialogOpen(true);
                  }}
                  className="cursor-pointer"
                >
                  New Connection...
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-zinc-800" />
                <DropdownMenuItem
                  onClick={() => handleDisconnect(currentSession.id)}
                  className="text-rose-400 focus:text-rose-400 cursor-pointer"
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
              className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-300 font-medium text-[11px] cursor-pointer transition-colors"
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
        </div>

        {/* Right: Quick shortcuts / status info */}
        <div className="flex items-center gap-3 text-[10px] text-zinc-500">
          {currentSession && (
            <span className="flex items-center gap-1 text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Connected
            </span>
          )}
          <span>Termlet v0.1</span>
        </div>
      </div>

      {/* Connection & Host Key Dialog */}
      <ConnectDialog
        open={connectDialogOpen}
        onOpenChange={setConnectDialogOpen}
        initialProfile={editingProfile}
        onConnected={handleConnected}
        onProfileSaved={refreshProfiles}
      />

      {/* Notifications */}
      <Toaster position="bottom-right" richColors />
    </div>
  );
}

export default App;
