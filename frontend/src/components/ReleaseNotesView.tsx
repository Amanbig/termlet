import React, { useState, useEffect, useMemo } from 'react';
import { Sparkles, ExternalLink, BookOpen, CheckCircle2 } from 'lucide-react';
import { marked } from 'marked';
import { GetReleaseNotes } from '../../wailsjs/go/main/App';
import { BrowserOpenURL } from '../../wailsjs/runtime/runtime';

interface ReleaseNotesViewProps {
  version: string;
  onClose?: () => void;
}

export const ReleaseNotesView: React.FC<ReleaseNotesViewProps> = ({
  version,
  onClose,
}) => {
  const [markdown, setMarkdown] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    GetReleaseNotes()
      .then((notes) => {
        if (isMounted) {
          if (notes && notes.trim()) {
            setMarkdown(notes);
          } else {
            setMarkdown(`# Termlet v${version} 🚀\n\nRelease notes are available on GitHub.`);
          }
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.error('Failed to load release notes:', err);
          setMarkdown(`# Termlet v${version} 🚀\n\nCould not load release notes: ${err}`);
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [version]);

  const htmlContent = useMemo(() => {
    if (!markdown) return '';
    try {
      return marked.parse(markdown, {
        gfm: true,
        breaks: true,
      }) as string;
    } catch (e) {
      console.error('Failed to parse release notes markdown:', e);
      return `<pre>${markdown}</pre>`;
    }
  }, [markdown]);

  const handleOpenGitHub = () => {
    const url = `https://github.com/Amanbig/termlet/releases/tag/v${version.replace(/^v/, '')}`;
    if (typeof BrowserOpenURL === 'function') {
      BrowserOpenURL(url);
    } else {
      window.open(url, '_blank');
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 overflow-hidden select-text">
      {/* Top Banner Header */}
      <div className="px-6 sm:px-10 lg:px-16 pt-6 pb-4 border-b border-zinc-200 dark:border-zinc-800/80 bg-white dark:bg-zinc-950 select-none">
        <div className="w-full max-w-4xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 border border-blue-500/30 flex items-center justify-center text-blue-600 dark:text-blue-400">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg font-bold tracking-tight">What's New in Termlet</h1>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-semibold border border-blue-200 dark:border-blue-800/60">
                  v{version.replace(/^v/, '')}
                </span>
              </div>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5">
                Release summary, architectural improvements, and changelog
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleOpenGitHub}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 text-xs text-zinc-700 dark:text-zinc-300 font-medium transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>GitHub Release</span>
            </button>
          </div>
        </div>
      </div>

      {/* Release Notes Rendered Body */}
      <div className="flex-1 overflow-y-auto px-6 sm:px-10 lg:px-16 py-8">
        <div className="w-full max-w-4xl mx-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-24 text-zinc-400 text-xs gap-2">
              <Sparkles className="w-4 h-4 animate-spin text-blue-500" />
              <span>Loading release notes...</span>
            </div>
          ) : (
            <div
              className="release-notes-markdown"
              dangerouslySetInnerHTML={{ __html: htmlContent }}
            />
          )}

          {/* Footer Card */}
          <div className="mt-12 pt-6 border-t border-zinc-200 dark:border-zinc-800/80 flex items-center justify-between text-xs text-zinc-500 dark:text-zinc-400 select-none">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              <span>Termlet is up to date</span>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={handleOpenGitHub}
                className="hover:text-blue-600 dark:hover:text-blue-400 hover:underline cursor-pointer flex items-center gap-1"
              >
                <span>View Full Changelog</span>
                <ExternalLink className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
