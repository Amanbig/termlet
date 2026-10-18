import React, { useState, useEffect, useCallback, useRef } from 'react';
import { RemoteFile, TreeItem } from '../types/remote';
import {
  ListRemoteFiles,
  CreateRemoteFile,
  CreateRemoteDirectory,
  DeleteRemotePath,
  RenameRemotePath,
  UploadFileContent,
} from '../../wailsjs/go/main/App';
import {
  Folder,
  FolderOpen,
  File,
  FileCode,
  FileText,
  FileArchive,
  FileImage,
  RefreshCw,
  Plus,
  FolderPlus,
  Upload,
  Trash2,
  Edit2,
  ChevronRight,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';
import { toast } from 'sonner';

import { SessionSummary } from '../types/remote';

interface RemoteFileTreeProps {
  sessionId: string | null;
  sessionSummary?: SessionSummary | null;
  startDirectory?: string;
  onOpenFile: (sessionId: string, file: RemoteFile) => void;
  activeFilePath?: string | null;
  onDisconnect?: (sessionId: string) => void;
  onOpenProfiles?: () => void;
}

export const RemoteFileTree: React.FC<RemoteFileTreeProps> = ({
  sessionId,
  sessionSummary,
  startDirectory = '.',
  onOpenFile,
  activeFilePath,
  onDisconnect,
  onOpenProfiles,
}) => {
  const [items, setItems] = useState<TreeItem[]>([]);
  const [currentPath, setCurrentPath] = useState<string>(startDirectory);
  const [isLoading, setIsLoading] = useState(false);
  const [newItemType, setNewItemType] = useState<'file' | 'folder' | null>(null);
  const [newItemName, setNewItemName] = useState('');
  const [targetParentPath, setTargetParentPath] = useState<string>('');
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchDirectory = useCallback(
    async (dirPath: string) => {
      if (!sessionId) return;
      setIsLoading(true);
      try {
        const files = await ListRemoteFiles(sessionId, dirPath);
        setItems(
          files.map((f) => ({
            ...f,
            isOpen: false,
            isLoading: false,
            isLoaded: false,
            children: [],
          }))
        );
        setCurrentPath(dirPath);
      } catch (err: any) {
        toast.error(`Failed to list files: ${err?.message || err}`);
      } finally {
        setIsLoading(false);
      }
    },
    [sessionId]
  );

  useEffect(() => {
    if (sessionId) {
      fetchDirectory(startDirectory || '.');
    } else {
      setItems([]);
    }
  }, [sessionId, startDirectory, fetchDirectory]);

  // Recursively toggle or load directory children
  const toggleFolder = async (item: TreeItem) => {
    if (!sessionId) return;

    if (item.isOpen) {
      // Close folder
      setItems((prev) => updateTree(prev, item.path, { isOpen: false }));
      return;
    }

    // Open folder: if already loaded children, just expand
    if (item.isLoaded) {
      setItems((prev) => updateTree(prev, item.path, { isOpen: true }));
      return;
    }

    // Load children
    setItems((prev) => updateTree(prev, item.path, { isLoading: true }));
    try {
      const children = await ListRemoteFiles(sessionId, item.path);
      const childItems: TreeItem[] = children.map((c) => ({
        ...c,
        isOpen: false,
        isLoading: false,
        isLoaded: false,
        children: [],
      }));

      setItems((prev) =>
        updateTree(prev, item.path, {
          isOpen: true,
          isLoading: false,
          isLoaded: true,
          children: childItems,
        })
      );
    } catch (err: any) {
      toast.error(`Failed to load directory: ${err?.message || err}`);
      setItems((prev) => updateTree(prev, item.path, { isLoading: false }));
    }
  };

  const handleCreate = async () => {
    if (!sessionId || !newItemName.trim()) {
      setNewItemType(null);
      return;
    }

    const parent = targetParentPath || currentPath;
    const dest = `${parent.replace(/\/$/, '')}/${newItemName.trim()}`;

    try {
      if (newItemType === 'file') {
        await CreateRemoteFile(sessionId, dest);
        toast.success(`Created file ${newItemName}`);
      } else {
        await CreateRemoteDirectory(sessionId, dest);
        toast.success(`Created folder ${newItemName}`);
      }
      fetchDirectory(currentPath);
    } catch (err: any) {
      toast.error(`Creation failed: ${err?.message || err}`);
    } finally {
      setNewItemType(null);
      setNewItemName('');
    }
  };

  const handleRename = async (oldPath: string) => {
    if (!sessionId || !renameValue.trim()) {
      setRenamingPath(null);
      return;
    }

    const parentDir = oldPath.substring(0, oldPath.lastIndexOf('/'));
    const newPath = `${parentDir}/${renameValue.trim()}`;

    try {
      await RenameRemotePath(sessionId, oldPath, newPath);
      toast.success('Renamed successfully');
      fetchDirectory(currentPath);
    } catch (err: any) {
      toast.error(`Rename failed: ${err?.message || err}`);
    } finally {
      setRenamingPath(null);
      setRenameValue('');
    }
  };

  const handleDelete = async (targetPath: string, isDir: boolean, name: string) => {
    if (!sessionId) return;

    const confirmDelete = window.confirm(
      `Are you sure you want to delete ${isDir ? 'folder' : 'file'} "${name}"?`
    );
    if (!confirmDelete) return;

    try {
      await DeleteRemotePath(sessionId, targetPath, isDir);
      toast.success(`Deleted ${name}`);
      fetchDirectory(currentPath);
    } catch (err: any) {
      toast.error(`Delete failed: ${err?.message || err}`);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!sessionId || !file) return;

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        await UploadFileContent(sessionId, currentPath, file.name, base64);
        toast.success(`Uploaded ${file.name}`);
        fetchDirectory(currentPath);
      } catch (err: any) {
        toast.error(`Upload failed: ${err?.message || err}`);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const renderFileIcon = (item: TreeItem) => {
    const ext = item.name.split('.').pop()?.toLowerCase();
    switch (ext) {
      case 'ts':
      case 'tsx':
      case 'js':
      case 'jsx':
      case 'go':
      case 'py':
      case 'rs':
      case 'html':
      case 'css':
      case 'json':
      case 'yaml':
      case 'yml':
      case 'sh':
        return <FileCode className="w-4 h-4 text-emerald-400 shrink-0" />;
      case 'md':
      case 'txt':
        return <FileText className="w-4 h-4 text-sky-400 shrink-0" />;
      case 'zip':
      case 'tar':
      case 'gz':
        return <FileArchive className="w-4 h-4 text-amber-400 shrink-0" />;
      case 'png':
      case 'jpg':
      case 'svg':
        return <FileImage className="w-4 h-4 text-violet-400 shrink-0" />;
      default:
        return <File className="w-4 h-4 text-zinc-400 shrink-0" />;
    }
  };

  const renderTree = (itemsList: TreeItem[], level = 0) => {
    return itemsList.map((item) => {
      const isSelected = activeFilePath === item.path;

      if (renamingPath === item.path) {
        return (
          <div
            key={item.path}
            style={{ paddingLeft: `${level * 16 + 8}px` }}
            className="flex items-center gap-1.5 py-1 pr-2"
          >
            <Input
              autoFocus
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename(item.path);
                if (e.key === 'Escape') setRenamingPath(null);
              }}
              onBlur={() => handleRename(item.path)}
              className="h-6 text-xs bg-zinc-900 border-zinc-700 py-0 px-2"
            />
          </div>
        );
      }

      return (
        <div key={item.path}>
          <div
            style={{ paddingLeft: `${level * 14 + 6}px` }}
            onClick={() => {
              if (item.is_dir) {
                toggleFolder(item);
              } else {
                onOpenFile(sessionId!, item);
              }
            }}
            className={`group flex items-center justify-between py-1 px-2 text-xs cursor-pointer select-none rounded transition-colors ${
              isSelected
                ? 'bg-blue-600/20 text-blue-200 font-medium'
                : 'text-zinc-300 hover:bg-zinc-800/60'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              {item.is_dir ? (
                <>
                  {item.isLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-400 shrink-0" />
                  ) : item.isOpen ? (
                    <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
                  )}
                  {item.isOpen ? (
                    <FolderOpen className="w-4 h-4 text-amber-400 shrink-0" />
                  ) : (
                    <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                  )}
                </>
              ) : (
                <>
                  <span className="w-3.5 shrink-0" />
                  {renderFileIcon(item)}
                </>
              )}
              <span className="truncate">{item.name}</span>
            </div>

            {/* Context Dropdown / Actions */}
            <div className="opacity-0 group-hover:opacity-100 flex items-center shrink-0">
              <DropdownMenu>
                <DropdownMenuTrigger
                  onClick={(e) => e.stopPropagation()}
                  className="p-0.5 rounded text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700 cursor-pointer"
                >
                  <span className="text-xs px-1">•••</span>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="bg-zinc-900 border-zinc-800 text-zinc-200 text-xs">
                  {item.is_dir && (
                    <>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetParentPath(item.path);
                          setNewItemType('file');
                        }}
                      >
                        <Plus className="w-3.5 h-3.5 mr-2" /> New File in Folder
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.stopPropagation();
                          setTargetParentPath(item.path);
                          setNewItemType('folder');
                        }}
                      >
                        <FolderPlus className="w-3.5 h-3.5 mr-2" /> New Folder in Folder
                      </DropdownMenuItem>
                      <DropdownMenuSeparator className="bg-zinc-800" />
                    </>
                  )}
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      setRenamingPath(item.path);
                      setRenameValue(item.name);
                    }}
                  >
                    <Edit2 className="w-3.5 h-3.5 mr-2" /> Rename
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.path, item.is_dir, item.name);
                    }}
                    className="text-rose-400 focus:text-rose-400"
                  >
                    <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Render children if open */}
          {item.is_dir && item.isOpen && item.children && (
            <div>{renderTree(item.children, level + 1)}</div>
          )}
        </div>
      );
    });
  };

  if (!sessionId) {
    return (
      <div className="flex flex-col h-full bg-zinc-950/60 border-r border-zinc-800/80 p-4">
        <div className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-4">
          Explorer
        </div>
        <div className="flex-1 flex flex-col items-center justify-center text-center p-2">
          <p className="text-xs text-zinc-400 font-medium">No remote folder open</p>
          <p className="text-[11px] text-zinc-600 mt-1 mb-4">
            Select a server profile from the welcome screen or profiles view.
          </p>
          {onOpenProfiles && (
            <Button
              size="sm"
              onClick={onOpenProfiles}
              className="h-7 text-xs bg-blue-600 hover:bg-blue-500 text-white cursor-pointer"
            >
              Open Profile...
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-zinc-950/60 border-r border-zinc-800/80">
      {/* Hidden File Input for Upload */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Explorer Top Toolbar */}
      <div className="px-3 py-2 border-b border-zinc-800/80 text-xs text-zinc-400">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider mb-1 flex items-center justify-between">
          <span>Explorer</span>
          {onDisconnect && (
            <button
              onClick={() => onDisconnect(sessionId)}
              title="Close Remote Connection"
              className="text-[10px] text-zinc-500 hover:text-rose-400 font-normal lowercase tracking-normal cursor-pointer"
            >
              close folder
            </button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1 min-w-0 pr-1">
            <ChevronDown className="w-3.5 h-3.5 text-zinc-400 shrink-0" />
            <span
              className="font-bold text-zinc-200 uppercase tracking-wide text-xs truncate"
              title={
                sessionSummary
                  ? `${sessionSummary.username}@${sessionSummary.host}:${sessionSummary.port} (${currentPath})`
                  : currentPath
              }
            >
              {sessionSummary?.profile_name || 'REMOTE'}
            </span>
          </div>

          <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
            title="New File"
            onClick={() => {
              setTargetParentPath(currentPath);
              setNewItemType('file');
            }}
          >
            <Plus className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
            title="New Folder"
            onClick={() => {
              setTargetParentPath(currentPath);
              setNewItemType('folder');
            }}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
            title="Upload File"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-zinc-400 hover:text-zinc-200"
            title="Refresh"
            onClick={() => fetchDirectory(currentPath)}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>
    </div>

      {/* Inline Create Input */}
      {newItemType && (
        <div className="p-2 border-b border-zinc-800 bg-zinc-900/60 flex items-center gap-1.5">
          {newItemType === 'file' ? (
            <File className="w-3.5 h-3.5 text-zinc-400" />
          ) : (
            <Folder className="w-3.5 h-3.5 text-amber-400" />
          )}
          <Input
            autoFocus
            placeholder={`Enter ${newItemType} name...`}
            value={newItemName}
            onChange={(e) => setNewItemName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate();
              if (e.key === 'Escape') setNewItemType(null);
            }}
            className="h-6 text-xs bg-zinc-950 border-zinc-700 py-0 px-2"
          />
        </div>
      )}

      {/* Files List View */}
      <div className="flex-1 overflow-y-auto p-1.5">
        {isLoading && items.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-zinc-500">
            <Loader2 className="w-5 h-5 animate-spin mr-2" />
            <span className="text-xs">Loading files...</span>
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-8 text-xs text-zinc-500">Directory is empty</div>
        ) : (
          renderTree(items)
        )}
      </div>
    </div>
  );
};

// Helper to update deeply nested tree item
function updateTree(
  list: TreeItem[],
  targetPath: string,
  changes: Partial<TreeItem>
): TreeItem[] {
  return list.map((item) => {
    if (item.path === targetPath) {
      return { ...item, ...changes };
    }
    if (item.children && item.children.length > 0) {
      return {
        ...item,
        children: updateTree(item.children, targetPath, changes),
      };
    }
    return item;
  });
}
