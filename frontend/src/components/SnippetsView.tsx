import React, { useState, useMemo } from 'react';
import {
  Terminal,
  Search,
  Play,
  Copy,
  Plus,
  Edit3,
  Trash2,
  Check,
  RotateCcw,
  Sparkles,
  Tag,
} from 'lucide-react';
import { toast } from 'sonner';
import { models } from '../../wailsjs/go/models';
import { SnippetEditorDialog } from './SnippetEditorDialog';

interface SnippetsViewProps {
  snippets: models.Snippet[];
  onExecuteSnippet: (snippet: models.Snippet) => void;
  onSaveSnippet: (snippet: models.Snippet) => Promise<void>;
  onDeleteSnippet: (id: string) => Promise<void>;
  onResetDefaults: () => Promise<void>;
  hasActiveSession: boolean;
}

export const SnippetsView: React.FC<SnippetsViewProps> = ({
  snippets,
  onExecuteSnippet,
  onSaveSnippet,
  onDeleteSnippet,
  onResetDefaults,
  hasActiveSession,
}) => {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingSnippet, setEditingSnippet] = useState<models.Snippet | null>(null);

  // Extract categories
  const categories = useMemo(() => {
    const set = new Set<string>();
    snippets.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    return ['All', ...Array.from(set).sort()];
  }, [snippets]);

  // Filter snippets
  const filteredSnippets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return snippets.filter((s) => {
      const matchCat =
        selectedCategory === 'All' ||
        (s.category && s.category.toLowerCase() === selectedCategory.toLowerCase());
      if (!matchCat) return false;

      if (!q) return true;

      const titleMatch = s.title?.toLowerCase().includes(q);
      const cmdMatch = s.command?.toLowerCase().includes(q);
      const descMatch = s.description?.toLowerCase().includes(q);
      const tagMatch = s.tags?.some((t) => t.toLowerCase().includes(q));

      return titleMatch || cmdMatch || descMatch || tagMatch;
    });
  }, [snippets, search, selectedCategory]);

  const handleCopy = (snippet: models.Snippet, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(snippet.command);
    setCopiedId(snippet.id);
    toast.success(`Copied: ${snippet.title}`);
    setTimeout(() => setCopiedId(null), 1500);
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

  return (
    <div className="h-full flex flex-col bg-zinc-50 dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 select-none overflow-hidden">
      {/* Top Header */}
      <div className="p-3 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-blue-500" />
          <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100">
            Snippets & Macros
          </span>
          <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
            {snippets.length}
          </span>
        </div>
        <button
          onClick={() => {
            setEditingSnippet(null);
            setEditorOpen(true);
          }}
          className="flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors cursor-pointer shadow-2xs"
          title="Create new snippet"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="p-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/40 dark:bg-zinc-900/40">
        <div className="relative flex items-center">
          <Search className="w-3.5 h-3.5 absolute left-2.5 text-zinc-400 pointer-events-none" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search snippets (Ctrl+K)..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-md border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Category Pills */}
      {categories.length > 2 && (
        <div className="flex items-center gap-1 px-2.5 py-1.5 border-b border-zinc-100 dark:border-zinc-800/80 overflow-x-auto scrollbar-none bg-zinc-50/50 dark:bg-zinc-950/40">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-0.5 rounded-full text-[10px] font-medium transition-colors cursor-pointer shrink-0 ${
                selectedCategory === cat
                  ? 'bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900'
                  : 'bg-zinc-200/80 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-600 dark:text-zinc-400'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Snippet Cards List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredSnippets.length > 0 ? (
          filteredSnippets.map((snippet) => {
            const isCopied = copiedId === snippet.id;

            return (
              <div
                key={snippet.id}
                className="group p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950/60 hover:border-zinc-300 dark:hover:border-zinc-700 transition-all flex flex-col gap-1.5"
              >
                {/* Title & Actions */}
                <div className="flex items-center justify-between gap-1.5">
                  <div className="flex items-center gap-1.5 truncate">
                    <span className="font-semibold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                      {snippet.title}
                    </span>
                    {snippet.category && (
                      <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 shrink-0">
                        {snippet.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-0.5 shrink-0">
                    <button
                      onClick={(e) => handleCopy(snippet, e)}
                      title="Copy command"
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      {isCopied ? (
                        <Check className="w-3 h-3 text-emerald-500" />
                      ) : (
                        <Copy className="w-3 h-3" />
                      )}
                    </button>
                    <button
                      onClick={(e) => handleEdit(snippet, e)}
                      title="Edit snippet"
                      className="p-1 rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Edit3 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(snippet, e)}
                      title="Delete snippet"
                      className="p-1 rounded text-zinc-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                    <button
                      onClick={() => onExecuteSnippet(snippet)}
                      title={hasActiveSession ? 'Run in active terminal' : 'Connect to a server to run directly'}
                      className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-blue-600 hover:bg-blue-500 text-white transition-colors ml-1 shadow-2xs"
                    >
                      <Play className="w-2.5 h-2.5 fill-current" />
                      <span>Run</span>
                    </button>
                  </div>
                </div>

                {/* Monospace Command Preview */}
                <div className="font-mono text-[10.5px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-900 border border-zinc-200/60 dark:border-zinc-800/60 text-zinc-700 dark:text-zinc-300 break-all select-all">
                  {snippet.command}
                </div>

                {/* Description */}
                {snippet.description && (
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate">
                    {snippet.description}
                  </p>
                )}
              </div>
            );
          })
        ) : (
          <div className="py-12 px-4 text-center text-zinc-400 dark:text-zinc-500">
            <Terminal className="w-7 h-7 mx-auto mb-2 opacity-40" />
            <p className="text-xs font-medium">No snippets found</p>
            <p className="text-[10px] text-zinc-400 mt-0.5">
              Click &ldquo;+ New&rdquo; above to create a reusable snippet.
            </p>
          </div>
        )}
      </div>

      {/* Bottom Footer */}
      <div className="p-2 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-100/50 dark:bg-zinc-950/60 flex items-center justify-between text-[10px] text-zinc-500">
        <span className="flex items-center gap-1">
          <kbd className="px-1 py-0.2 rounded bg-zinc-200 dark:bg-zinc-800 font-mono text-[9px]">Ctrl+K</kbd>
          <span>Quick Palette</span>
        </span>
        <button
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
          className="flex items-center gap-1 hover:text-zinc-800 dark:hover:text-zinc-200 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-2.5 h-2.5" />
          <span>Reset Defaults</span>
        </button>
      </div>

      {/* Snippet Editor Modal */}
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
    </div>
  );
};
