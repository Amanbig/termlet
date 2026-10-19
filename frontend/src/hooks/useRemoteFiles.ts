import { useState, useCallback } from 'react';
import { OpenFile, RemoteFile } from '../types/remote';
import { ReadRemoteFile, SaveRemoteFile } from '../../wailsjs/go/main/App';
import { formatErrorMessage } from '../utils/errors';
import { toast } from 'sonner';
import { useConfirm } from '../context/ConfirmContext';

export function useRemoteFiles() {
  const confirm = useConfirm();
  const [openFiles, setOpenFiles] = useState<OpenFile[]>([]);
  const [activeFilePath, setActiveFilePath] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const activeFile = openFiles.find((f) => f.path === activeFilePath) || null;

  const openRemoteFile = useCallback(
    async (sessionId: string, remoteFile: RemoteFile) => {
      // Check if already open
      const existing = openFiles.find((f) => f.path === remoteFile.path && f.sessionId === sessionId);
      if (existing) {
        setActiveFilePath(remoteFile.path);
        return;
      }

      try {
        const fileContent = await ReadRemoteFile(sessionId, remoteFile.path);

        if (fileContent.is_binary) {
          toast.warning(`"${remoteFile.name}" is a binary file. Editing binary files is not supported.`);
        }

        const newOpenFile: OpenFile = {
          sessionId,
          path: remoteFile.path,
          name: remoteFile.name,
          content: fileContent.content,
          savedContent: fileContent.content,
          isDirty: false,
          modTime: fileContent.mod_time,
          size: fileContent.size,
          isBinary: fileContent.is_binary,
        };

        setOpenFiles((prev) => [...prev, newOpenFile]);
        setActiveFilePath(remoteFile.path);
      } catch (err: any) {
        const formatted = formatErrorMessage(err, 'Open File');
        toast.error(`${formatted.title}: ${formatted.message}`, {
          description: formatted.hint,
        });
      }
    },
    [openFiles]
  );

  const updateFileContent = useCallback((filePath: string, newContent: string) => {
    setOpenFiles((prev) =>
      prev.map((f) => {
        if (f.path === filePath) {
          return {
            ...f,
            content: newContent,
            isDirty: newContent !== f.savedContent,
          };
        }
        return f;
      })
    );
  }, []);

  const saveFileByPath = useCallback(
    async (filePath: string, ignoreConflict = false): Promise<boolean> => {
      const fileToSave = openFiles.find((f) => f.path === filePath);
      if (!fileToSave || fileToSave.isBinary) return false;

      setIsSaving(true);
      try {
        const checkModTime = ignoreConflict ? 0 : fileToSave.modTime;
        const result = await SaveRemoteFile(
          fileToSave.sessionId,
          fileToSave.path,
          fileToSave.content,
          checkModTime
        );

        setOpenFiles((prev) =>
          prev.map((f) => {
            if (f.path === filePath) {
              return {
                ...f,
                savedContent: f.content,
                isDirty: false,
                modTime: result.mod_time,
                size: result.size,
              };
            }
            return f;
          })
        );

        toast.success(`Saved ${fileToSave.name}`);
        return true;
      } catch (err: any) {
        const formatted = formatErrorMessage(err, 'Save File');
        const raw = formatted.raw || '';
        if (raw.toLowerCase().includes('modified on remote server')) {
          toast.error(`Conflict: File has been modified on the remote server!`, {
            description: formatted.hint,
            action: {
              label: 'Overwrite anyway',
              onClick: () => saveFileByPath(filePath, true),
            },
          });
        } else {
          toast.error(`${formatted.title}: ${formatted.message}`, {
            description: formatted.hint,
          });
        }
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [openFiles]
  );

  const saveCurrentFile = useCallback(async (): Promise<boolean> => {
    if (!activeFilePath) return false;
    return saveFileByPath(activeFilePath);
  }, [activeFilePath, saveFileByPath]);

  const closeFile = useCallback(
    async (filePath: string, force = false): Promise<boolean> => {
      const fileToClose = openFiles.find((f) => f.path === filePath);
      if (!fileToClose) return true;

      if (fileToClose.isDirty && !force) {
        const confirmed = await confirm({
          title: 'Unsaved Changes',
          description: `"${fileToClose.name}" has unsaved changes. Discard changes and close?`,
          confirmText: 'Discard & Close',
          variant: 'destructive',
        });
        if (!confirmed) return false;
      }

      setOpenFiles((prev) => {
        const filtered = prev.filter((f) => f.path !== filePath);
        if (activeFilePath === filePath) {
          const next = filtered[filtered.length - 1];
          setActiveFilePath(next ? next.path : null);
        }
        return filtered;
      });

      return true;
    },
    [openFiles, activeFilePath, confirm]
  );

  const closeAllFiles = useCallback(async () => {
    const dirtyFiles = openFiles.filter((f) => f.isDirty);
    if (dirtyFiles.length > 0) {
      const confirmed = await confirm({
        title: 'Unsaved Changes',
        description: `You have ${dirtyFiles.length} unsaved file(s). Discard all changes and close?`,
        confirmText: 'Discard All & Close',
        variant: 'destructive',
      });
      if (!confirmed) return;
    }
    setOpenFiles([]);
    setActiveFilePath(null);
  }, [openFiles, confirm]);

  const closeOtherFiles = useCallback(
    async (keepPath: string) => {
      const dirtyOthers = openFiles.filter((f) => f.path !== keepPath && f.isDirty);
      if (dirtyOthers.length > 0) {
        const confirmed = await confirm({
          title: 'Unsaved Changes',
          description: `You have ${dirtyOthers.length} unsaved file(s) that will be closed. Discard changes?`,
          confirmText: 'Discard & Close',
          variant: 'destructive',
        });
        if (!confirmed) return;
      }
      setOpenFiles((prev) => prev.filter((f) => f.path === keepPath));
      setActiveFilePath(keepPath);
    },
    [openFiles, confirm]
  );

  const closeSavedFiles = useCallback(() => {
    setOpenFiles((prev) => {
      const remaining = prev.filter((f) => f.isDirty);
      if (activeFilePath && !remaining.some((f) => f.path === activeFilePath)) {
        setActiveFilePath(remaining[remaining.length - 1]?.path || null);
      }
      return remaining;
    });
  }, [activeFilePath]);

  return {
    openFiles,
    activeFile,
    activeFilePath,
    isSaving,
    setActiveFilePath,
    openRemoteFile,
    updateFileContent,
    saveCurrentFile,
    saveFileByPath,
    closeFile,
    closeAllFiles,
    closeOtherFiles,
    closeSavedFiles,
  };
}
