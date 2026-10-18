import React, { useState, useEffect, useCallback } from 'react';
import { Profile, SessionSummary, RemoteFile } from './types/remote';
import {
  ListProfiles,
  ListActiveSessions,
  Disconnect,
  DeleteProfile,
  Connect,
} from '../wailsjs/go/main/App';
import { ConnectionSidebar } from './components/ConnectionSidebar';
import { RemoteFileTree } from './components/RemoteFileTree';
import { EditorTabs } from './components/EditorTabs';
import { CodeEditor } from './components/CodeEditor';
import { ConnectDialog } from './components/ConnectDialog';
import { useRemoteFiles } from './hooks/useRemoteFiles';
import { Toaster, toast } from 'sonner';

export function App() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeSessions, setActiveSessions] = useState<SessionSummary[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

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
  };

  const handleConnectProfile = async (profile: Profile) => {
    // Check if session already active for this profile
    const existing = activeSessions.find((s) => s.profile_id === profile.id);
    if (existing) {
      setCurrentSessionId(existing.id);
      return;
    }

    // Try auto-connecting with saved secret or open dialog
    try {
      const resp = await Connect(profile, '', false);
      if (resp.success && resp.session) {
        toast.success(`Connected to ${profile.name}`);
        refreshSessions();
        setCurrentSessionId(resp.session.id);
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
      toast.info('Disconnected session');
      refreshSessions();
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

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-zinc-950 text-zinc-100 font-sans antialiased">
      {/* 1. Leftmost Connection Profiles Sidebar */}
      <ConnectionSidebar
        profiles={profiles}
        activeSessions={activeSessions}
        currentSessionId={currentSessionId}
        onSelectSession={setCurrentSessionId}
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

      {/* 2. Secondary Remote File Tree Panel */}
      <div className="w-72 h-full flex flex-col shrink-0">
        <RemoteFileTree
          sessionId={currentSessionId}
          startDirectory={currentSession?.start_directory || '.'}
          onOpenFile={handleOpenFile}
          activeFilePath={activeFilePath}
        />
      </div>

      {/* 3. Main Workspace: Tabs + CodeMirror Editor */}
      <div className="flex-1 flex flex-col h-full min-w-0 bg-zinc-950">
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
