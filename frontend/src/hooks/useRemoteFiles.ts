import { useState, useCallback } from 'react';
import { OpenFile, RemoteFile } from '../types/remote';
import { ReadRemoteFile, SaveRemoteFile } from '../../wailsjs/go/main/App';
import { toast } from 'sonner';

export function useRemoteFiles() {
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
        toast.error(`Failed to open file: ${err?.message || err}`);
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
        const msg = String(err?.message || err);
        if (msg.includes('modified on remote server')) {
          toast.error(`Conflict: File has been modified on the remote server!`, {
            action: {
              label: 'Overwrite anyway',
              onClick: () => saveFileByPath(filePath, true),
            },
          });
        } else {
          toast.error(`Save failed: ${msg}`);
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
    (filePath: string, force = false): boolean => {
      const fileToClose = openFiles.find((f) => f.path === filePath);
      if (!fileToClose) return true;

      if (fileToClose.isDirty && !force) {
        const confirmClose = window.confirm(
          `"${fileToClose.name}" has unsaved changes. Discard changes and close?`
        );
        if (!confirmClose) return false;
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
    [openFiles, activeFilePath]
  );

  const closeAllFiles = useCallback(() => {
    const dirtyFiles = openFiles.filter((f) => f.isDirty);
    if (dirtyFiles.length > 0) {
      const confirmClose = window.confirm(
        `You have ${dirtyFiles.length} unsaved file(s). Discard all changes and close?`
      );
      if (!confirmClose) return;
    }
    setOpenFiles([]);
    setActiveFilePath(null);
  }, [openFiles]);

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
  };
}
