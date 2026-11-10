import React, { useState, useEffect } from 'react';
import { X, Save, Sparkles, Terminal } from 'lucide-react';
import { models } from '../../wailsjs/go/models';

interface SnippetEditorDialogProps {
  isOpen: boolean;
  snippet?: models.Snippet | null;
  onClose: () => void;
  onSave: (snippet: models.Snippet) => Promise<void>;
}

const COMMON_CATEGORIES = ['System', 'Docker', 'Network', 'Logs', 'Git', 'Database', 'Custom'];

export const SnippetEditorDialog: React.FC<SnippetEditorDialogProps> = ({
  isOpen,
  snippet,
  onClose,
  onSave,
}) => {
  const [title, setTitle] = useState('');
  const [command, setCommand] = useState('');
  const [category, setCategory] = useState('System');
  const [description, setDescription] = useState('');
  const [tagsString, setTagsString] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (snippet) {
      setTitle(snippet.title || '');
      setCommand(snippet.command || '');
      setCategory(snippet.category || 'System');
      setDescription(snippet.description || '');
      setTagsString((snippet.tags || []).join(', '));
    } else {
      setTitle('');
      setCommand('');
      setCategory('System');
      setDescription('');
      setTagsString('');
    }
    setError(null);
  }, [snippet, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Title is required');
      return;
    }
    if (!command.trim()) {
      setError('Command is required');
      return;
    }

    const tags = tagsString
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    const snippetPayload = new models.Snippet({
      id: snippet?.id || '',
      title: title.trim(),
      command: command.trim(),
      category: category.trim() || 'General',
      description: description.trim(),
      tags,
    });

    setIsSaving(true);
    setError(null);
    try {
      await onSave(snippetPayload);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save snippet');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <Terminal className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                {snippet ? 'Edit Snippet' : 'New Command Snippet'}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">
                Save reusable commands for 1-click execution in active sessions
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Title <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Docker Prune Containers"
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Command <span className="text-rose-500">*</span>
            </label>
            <textarea
              rows={3}
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              placeholder="e.g., docker system prune -af --volumes"
              className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Category
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  list="snippet-categories"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g., System"
                  className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <datalist id="snippet-categories">
                  {COMMON_CATEGORIES.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
                Tags (comma separated)
              </label>
              <input
                type="text"
                value={tagsString}
                onChange={(e) => setTagsString(e.target.value)}
                placeholder="docker, cleanup, maintenance"
                className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-700 dark:text-zinc-300 mb-1">
              Description <span className="text-zinc-400 font-normal">(optional)</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this command does..."
              className="w-full px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-3.5 py-1.5 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{snippet ? 'Update Snippet' : 'Save Snippet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
