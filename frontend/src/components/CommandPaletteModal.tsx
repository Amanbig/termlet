import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Terminal,
  Search,
  Play,
  Copy,
  Plus,
  Edit3,
  Trash2,
  X,
  RotateCcw,
  Check,
  Tag,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';
import { models } from '../../wailsjs/go/models';
import { SnippetEditorDialog } from './SnippetEditorDialog';

interface CommandPaletteModalProps {
  isOpen: boolean;
  onClose: () => void;
  snippets: models.Snippet[];
  onExecuteSnippet: (snippet: models.Snippet) => void;
  onSaveSnippet: (snippet: models.Snippet) => Promise<void>;
  onDeleteSnippet: (id: string) => Promise<void>;
  onResetDefaults: () => Promise<void>;
  hasActiveSession: boolean;
}

export const CommandPaletteModal: React.FC<CommandPaletteModalProps> = ({
  isOpen,
  onClose,
  snippets,
  onExecuteSnippet,
  onSaveSnippet,
  onDeleteSnippet,
  onResetDefaults,
  hasActiveSession,
}) => {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<models.Snippet | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Auto-focus input on open
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedCategory('All');
      setSelectedIndex(0);
      const timer = setTimeout(() => inputRef.current?.focus(), 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // Extract unique categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [snippets]);

  // Filter snippets based on search query and category
  const filteredSnippets = useMemo(() => {
    const q = query.trim().toLowerCase();
    return snippets.filter((s) => {
      const matchCategory =
        selectedCategory === 'All' ||
        (s.category && s.category.toLowerCase() === selectedCategory.toLowerCase());
      if (!matchCategory) return false;

      if (!q) return true;

      const titleMatch = s.title?.toLowerCase().includes(q);
      const cmdMatch = s.command?.toLowerCase().includes(q);
      const descMatch = s.description?.toLowerCase().includes(q);
      const tagMatch = s.tags?.some((t) => t.toLowerCase().includes(q));
      const catMatch = s.category?.toLowerCase().includes(q);

      return titleMatch || cmdMatch || descMatch || tagMatch || catMatch;
    });
  }, [snippets, query, selectedCategory]);

  // Keep selected index within bounds
  useEffect(() => {
    if (selectedIndex >= filteredSnippets.length) {
      setSelectedIndex(Math.max(0, filteredSnippets.length - 1));
    }
  }, [filteredSnippets.length, selectedIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.children[selectedIndex] as HTMLElement;
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' });
      }
    }
  }, [selectedIndex]);

  const handleCopyCommand = useCallback((snippet: models.Snippet, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    navigator.clipboard.writeText(snippet.command);
    setCopiedId(snippet.id);
    toast.success(`Copied: ${snippet.title}`);
    setTimeout(() => setCopiedId(null), 1500);
  }, []);

  const handleSelectSnippet = useCallback(
    (snippet: models.Snippet) => {
      onExecuteSnippet(snippet);
      onClose();
    },
    [onExecuteSnippet, onClose]
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }

      if (filteredSnippets.length === 0) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % filteredSnippets.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredSnippets.length) % filteredSnippets.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = filteredSnippets[selectedIndex];
        if (target) {
          handleSelectSnippet(target);
        }
      } else if (e.key === 'Tab') {
        e.preventDefault();
        const target = filteredSnippets[selectedIndex];
        if (target) {
          handleCopyCommand(target);
        }
      }
    },
    [filteredSnippets, selectedIndex, handleSelectSnippet, handleCopyCommand, onClose]
  );

  const handleCreateNew = () => {
    setEditingSnippet(null);
    setEditorOpen(true);
  };

  const handleEdit = (snippet: models.Snippet, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingSnippet(snippet);
    setEditorOpen(true);
  };

  const handleDelete = async (snippet: models.Snippet, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Delete snippet "${snippet.title}"?`)) {
      try {
        await onDeleteSnippet(snippet.id);
        toast.success(`Deleted ${snippet.title}`);
      } catch (err: any) {
        toast.error(`Failed to delete: ${err?.message || err}`);
      }
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-20 px-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150"
        onClick={onClose}
      >
        <div
          className="w-full max-w-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[82vh]"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={handleKeyDown}
        >
          {/* Top Search Bar */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-900/50">
            <Search className="w-4 h-4 text-zinc-400 shrink-0" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSelectedIndex(0);
              }}
              placeholder="Search command snippets (↑↓ to navigate, ↵ to run, Tab to copy)..."
              className="flex-1 bg-transparent text-xs text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none"
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="p-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <div className="flex items-center gap-1.5 pl-2 border-l border-zinc-200 dark:border-zinc-800">
              <button
                type="button"
                onClick={handleCreateNew}
                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-2xs"
                title="Create a new command snippet"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>New</span>
              </button>
            </div>
          </div>

          {/* Category Filter Pills */}
          {categories.length > 2 && (
            <div className="flex items-center gap-1.5 px-4 py-2 border-b border-zinc-100 dark:border-zinc-800/80 overflow-x-auto select-none bg-zinc-50/30 dark:bg-zinc-950/30 scrollbar-none">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setSelectedCategory(cat);
                    setSelectedIndex(0);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium transition-colors cursor-pointer shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                      : 'bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Snippets List */}
          <div
            ref={listRef}
            className="flex-1 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60 p-2 space-y-1"
          >
            {filteredSnippets.length > 0 ? (
              filteredSnippets.map((snippet, idx) => {
                const isSelected = idx === selectedIndex;
                const isCopied = copiedId === snippet.id;

                return (
                  <div
                    key={snippet.id}
                    onClick={() => handleSelectSnippet(snippet)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    className={`group flex flex-col gap-1.5 p-3 rounded-lg cursor-pointer transition-all text-xs border ${
                      isSelected
                        ? 'bg-blue-500/10 dark:bg-blue-600/15 border-blue-500/30 text-zinc-900 dark:text-zinc-100'
                        : 'border-transparent hover:bg-zinc-100/70 dark:hover:bg-zinc-800/40 text-zinc-800 dark:text-zinc-200'
                    }`}
                  >
                    {/* Snippet Header */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 truncate">
                        <Terminal className={`w-3.5 h-3.5 shrink-0 ${isSelected ? 'text-blue-500' : 'text-zinc-400'}`} />
                        <span className="font-semibold text-xs truncate">
                          {snippet.title}
                        </span>
                        {snippet.category && (
                          <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-zinc-200/70 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">
                            {snippet.category}
                          </span>
                        )}
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={(e) => handleCopyCommand(snippet, e)}
                          title="Copy command (Tab)"
                          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-500" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleEdit(snippet, e)}
                          title="Edit snippet"
                          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(snippet, e)}
                          title="Delete snippet"
                          className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectSnippet(snippet);
                          }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors ml-1 shadow-2xs"
                        >
                          <Play className="w-3 h-3 fill-current" />
                          <span>{hasActiveSession ? 'Run' : 'Run / Copy'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Command Code Preview */}
                    <div className="relative font-mono text-[11px] px-2.5 py-1.5 rounded-md bg-zinc-100 dark:bg-zinc-950/80 border border-zinc-200/80 dark:border-zinc-800/80 text-zinc-800 dark:text-zinc-300 break-all select-all">
                      {snippet.command}
                    </div>

                    {/* Description & Tags */}
                    {(snippet.description || (snippet.tags && snippet.tags.length > 0)) && (
                      <div className="flex items-center justify-between text-[11px] text-zinc-500 dark:text-zinc-400">
                        <span className="truncate">{snippet.description}</span>
                        {snippet.tags && snippet.tags.length > 0 && (
                          <div className="flex items-center gap-1 shrink-0 ml-2">
                            <Tag className="w-2.5 h-2.5 text-zinc-400" />
                            <span className="text-[10px] text-zinc-400">
                              {snippet.tags.slice(0, 3).join(', ')}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            ) : (
              <div className="py-12 text-center text-zinc-400 dark:text-zinc-500">
                <Terminal className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-xs font-medium">No snippets found</p>
                <p className="text-[11px] text-zinc-400 mt-0.5">
                  Try adjusting your search or click &ldquo;New&rdquo; to create a custom snippet.
                </p>
              </div>
            )}
          </div>

          {/* Footer Shortcuts & Actions */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-[11px] text-zinc-500 dark:text-zinc-400 select-none">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">↑↓</kbd>
                <span>Navigate</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">↵</kbd>
                <span>Run</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">Tab</kbd>
                <span>Copy</span>
              </span>
              <span className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[10px]">Esc</kbd>
                <span>Close</span>
              </span>
            </div>

            <button
              type="button"
              onClick={async () => {
                if (confirm('Restore default snippets library? Custom snippets will be replaced.')) {
                  try {
                    await onResetDefaults();
                    toast.success('Restored default snippets library');
                  } catch (err: any) {
                    toast.error(`Failed to reset: ${err?.message || err}`);
                  }
                }
              }}
              className="flex items-center gap-1 text-[11px] text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 transition-colors cursor-pointer"
              title="Reset default snippets library"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {/* Editor Modal */}
      <SnippetEditorDialog
        isOpen={editorOpen}
        snippet={editingSnippet}
        onClose={() => {
          setEditorOpen(false);
          setEditingSnippet(null);
        }}
        onSave={async (snippetPayload) => {
          await onSaveSnippet(snippetPayload);
          toast.success(editingSnippet ? 'Updated snippet' : 'Created snippet');
        }}
      />
    </>
  );
};
