import React, { useState, useEffect, useRef, useCallback } from 'react';
import { EditorView } from '@codemirror/view';
import {
  SearchQuery,
  setSearchQuery,
  findNext,
  findPrevious,
  replaceNext,
  replaceAll,
} from '@codemirror/search';
import {
  Search,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  X,
  CaseSensitive,
  WholeWord,
  Regex,
  Replace,
  ReplaceAll,
} from 'lucide-react';
import { Button } from './ui/button';

interface EditorFindReplaceProps {
  view: EditorView | null;
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'find' | 'replace';
  updateTrigger?: number; // increments on viewUpdate/doc changes
}

export const EditorFindReplace: React.FC<EditorFindReplaceProps> = ({
  view,
  isOpen,
  onClose,
  initialMode = 'find',
  updateTrigger = 0,
}) => {
  const [searchText, setSearchText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [wholeWord, setWholeWord] = useState(false);
  const [isRegex, setIsRegex] = useState(false);
  const [isReplaceOpen, setIsReplaceOpen] = useState(initialMode === 'replace');

  const [matchesCount, setMatchesCount] = useState(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [regexError, setRegexError] = useState<string | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const replaceInputRef = useRef<HTMLInputElement>(null);

  // Sync mode when reopened or changed
  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'replace') {
        setIsReplaceOpen(true);
      }

      if (view) {
        // If user has a selected text in the editor, prepopulate search text
        const { from, to } = view.state.selection.main;
        if (from !== to) {
          const selectedText = view.state.sliceDoc(from, to);
          if (selectedText && !selectedText.includes('\n') && selectedText.length <= 100) {
            setSearchText(selectedText);
          }
        }
      }

      // Focus appropriate input on next frame
      requestAnimationFrame(() => {
        if (initialMode === 'replace' && searchText) {
          replaceInputRef.current?.focus();
          replaceInputRef.current?.select();
        } else {
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
        }
      });
    }
  }, [isOpen, initialMode]);

  // Execute and update search query in CodeMirror
  const updateSearch = useCallback(() => {
    if (!view) return;

    if (!searchText) {
      setMatchesCount(0);
      setCurrentIndex(0);
      setRegexError(null);
      view.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: '' })),
      });
      return;
    }

    // Validate regex if regex option is enabled
    if (isRegex) {
      try {
        new RegExp(searchText);
        setRegexError(null);
      } catch (err: any) {
        setRegexError(err?.message || 'Invalid regex');
        setMatchesCount(0);
        setCurrentIndex(0);
        return;
      }
    } else {
      setRegexError(null);
    }

    try {
      const query = new SearchQuery({
        search: searchText,
        replace: replaceText,
        caseSensitive,
        wholeWord,
        regexp: isRegex,
      });

      view.dispatch({
        effects: setSearchQuery.of(query),
      });

      // Calculate matches and active selection index
      if (query.valid) {
        const cursor = query.getCursor(view.state);
        const selFrom = view.state.selection.main.from;
        const selTo = view.state.selection.main.to;

        let total = 0;
        let activeIdx = 0;
        const MAX_MATCH_LIMIT = 5000;

        let item = cursor.next();
        while (!item.done && item.value) {
          total++;
          if (activeIdx === 0 && item.value.from === selFrom && item.value.to === selTo) {
            activeIdx = total;
          }
          if (total >= MAX_MATCH_LIMIT) break;
          item = cursor.next();
        }

        setMatchesCount(total);
        setCurrentIndex(activeIdx);
      }
    } catch (err: any) {
      console.warn('Search query error:', err);
    }
  }, [view, searchText, replaceText, caseSensitive, wholeWord, isRegex]);

  // Update search whenever criteria or external editor state changes
  useEffect(() => {
    if (isOpen) {
      updateSearch();
    }
  }, [isOpen, updateSearch, updateTrigger]);

  // Close handler: reset query decorations and focus editor
  const handleClose = useCallback(() => {
    if (view) {
      view.dispatch({
        effects: setSearchQuery.of(new SearchQuery({ search: '' })),
      });
      view.focus();
    }
    onClose();
  }, [view, onClose]);

  // Navigate next / previous
  const handleFindNext = useCallback(() => {
    if (!view) return;
    findNext(view);
    updateSearch();
  }, [view, updateSearch]);

  const handleFindPrevious = useCallback(() => {
    if (!view) return;
    findPrevious(view);
    updateSearch();
  }, [view, updateSearch]);

  // Replace one / all
  const handleReplaceNext = useCallback(() => {
    if (!view) return;
    replaceNext(view);
    updateSearch();
  }, [view, updateSearch]);

  const handleReplaceAll = useCallback(() => {
    if (!view) return;
    replaceAll(view);
    updateSearch();
  }, [view, updateSearch]);

  if (!isOpen) return null;

  return (
    <div
      role="search"
      aria-label="Find and Replace"
      className="absolute top-2 right-4 z-30 flex flex-col gap-1.5 p-2 rounded-lg bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 shadow-xl text-xs w-[360px] animate-in fade-in slide-in-from-top-2 duration-150 select-none"
    >
      {/* Row 1: Find */}
      <div className="flex items-center gap-1.5">
        {/* Toggle Replace Chevron */}
        <button
          type="button"
          onClick={() => setIsReplaceOpen((prev) => !prev)}
          className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors"
          title={isReplaceOpen ? 'Hide Replace' : 'Show Replace (Ctrl+H)'}
        >
          {isReplaceOpen ? (
            <ChevronDown className="w-3.5 h-3.5" />
          ) : (
            <ChevronRight className="w-3.5 h-3.5" />
          )}
        </button>

        {/* Search Input Container */}
        <div className="relative flex-1 flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30">
          <input
            ref={searchInputRef}
            type="text"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                  handleFindPrevious();
                } else {
                  handleFindNext();
                }
              } else if (e.key === 'Escape') {
                e.preventDefault();
                handleClose();
              }
            }}
            placeholder="Find..."
            className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 outline-none text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono pr-2"
          />

          {/* Search Options (Case, Whole Word, Regex) */}
          <div className="flex items-center gap-0.5 ml-1">
            <button
              type="button"
              onClick={() => setCaseSensitive((prev) => !prev)}
              className={`p-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                caseSensitive
                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Match Case (Alt+C)"
            >
              <CaseSensitive className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setWholeWord((prev) => !prev)}
              className={`p-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                wholeWord
                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Match Whole Word (Alt+W)"
            >
              <WholeWord className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setIsRegex((prev) => !prev)}
              className={`p-1 rounded text-[10px] font-mono transition-colors cursor-pointer ${
                isRegex
                  ? 'bg-blue-100 dark:bg-blue-900/60 text-blue-600 dark:text-blue-400 font-semibold'
                  : 'text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
              title="Use Regular Expression (Alt+R)"
            >
              <Regex className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Match Count Badge */}
        <div className="min-w-[60px] text-right text-[11px] font-mono text-zinc-500 dark:text-zinc-400 shrink-0">
          {regexError ? (
            <span className="text-rose-500 text-[10px] font-sans" title={regexError}>
              Invalid regex
            </span>
          ) : searchText ? (
            matchesCount > 0 ? (
              <span>
                {currentIndex > 0 ? `${currentIndex} of ` : ''}
                {matchesCount}
              </span>
            ) : (
              <span className="text-zinc-400 dark:text-zinc-500">No results</span>
            )
          ) : null}
        </div>

        {/* Prev / Next Match Buttons */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={handleFindPrevious}
            disabled={!searchText || matchesCount === 0}
            className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Previous Match (Shift+Enter)"
          >
            <ChevronUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleFindNext}
            disabled={!searchText || matchesCount === 0}
            className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Next Match (Enter)"
          >
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={handleClose}
            className="p-1 rounded text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer transition-colors ml-0.5"
            title="Close (Escape)"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Row 2: Replace (when expanded) */}
      {isReplaceOpen && (
        <div className="flex items-center gap-1.5 pl-6 animate-in fade-in duration-100">
          <div className="relative flex-1 flex items-center bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded px-2 py-1 focus-within:border-blue-500 focus-within:ring-1 focus-within:ring-blue-500/30">
            <input
              ref={replaceInputRef}
              type="text"
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleReplaceNext();
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  handleClose();
                }
              }}
              placeholder="Replace..."
              className="w-full bg-transparent text-zinc-900 dark:text-zinc-100 outline-none text-xs placeholder:text-zinc-400 dark:placeholder:text-zinc-600 font-mono"
            />
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!searchText || matchesCount === 0}
              onClick={handleReplaceNext}
              className="h-6 px-2 text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-40"
              title="Replace (Enter)"
            >
              <Replace className="w-3 h-3" />
              Replace
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!searchText || matchesCount === 0}
              onClick={handleReplaceAll}
              className="h-6 px-2 text-[11px] flex items-center gap-1 cursor-pointer disabled:opacity-40"
              title="Replace All"
            >
              <ReplaceAll className="w-3 h-3" />
              All
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
