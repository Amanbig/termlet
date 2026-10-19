import React, { useRef, useEffect, useState, useCallback } from 'react';
import { OpenFile } from '../types/remote';
import {
  X,
  FileCode,
  MoreHorizontal,
  Settings,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  CheckCheck,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from './ui/dropdown-menu';

interface EditorTabsProps {
  files: OpenFile[];
  activeFilePath: string | null;
  isSettingsOpen: boolean;
  onSelect: (path: string) => void;
  onClose: (path: string) => void;
  onCloseAll: () => void;
  onCloseOthers?: (path: string) => void;
  onCloseSaved?: () => void;
  onSelectSettings: () => void;
  onCloseSettings: () => void;
  isReleaseNotesOpen?: boolean;
  onSelectReleaseNotes?: () => void;
  onCloseReleaseNotes?: () => void;
}

export const EditorTabs: React.FC<EditorTabsProps> = ({
  files,
  activeFilePath,
  isSettingsOpen,
  onSelect,
  onClose,
  onCloseAll,
  onCloseOthers,
  onCloseSaved,
  onSelectSettings,
  onCloseSettings,
  isReleaseNotesOpen = false,
  onSelectReleaseNotes,
  onCloseReleaseNotes,
}) => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  // Measure and update scroll state
  const checkScrollState = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const isOverflowing = el.scrollWidth > el.clientWidth + 2;
    setHasOverflow(isOverflowing);
    setCanScrollLeft(el.scrollLeft > 2);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 2);
  }, []);

  // Set up listeners for scroll & resize
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el) return;

    checkScrollState();
    el.addEventListener('scroll', checkScrollState, { passive: true });
    window.addEventListener('resize', checkScrollState);

    let ro: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(() => checkScrollState());
      ro.observe(el);
    }

    return () => {
      el.removeEventListener('scroll', checkScrollState);
      window.removeEventListener('resize', checkScrollState);
      ro?.disconnect();
    };
  }, [checkScrollState, files.length, isSettingsOpen, isReleaseNotesOpen]);

  // Convert vertical mouse wheel scrolling into horizontal scroll
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.deltaY !== 0 && scrollContainerRef.current) {
      scrollContainerRef.current.scrollLeft += e.deltaY;
    }
  };

  // Scroll buttons step navigation
  const handleScrollBy = (offset: number) => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollBy({
        left: offset,
        behavior: 'smooth',
      });
    }
  };

  // Automatically scroll active tab into view whenever selection changes
  useEffect(() => {
    const el = scrollContainerRef.current;
    if (!el || !activeFilePath) return;

    try {
      const activeEl = el.querySelector<HTMLElement>(`[data-tab-path="${CSS.escape(activeFilePath)}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
      }
    } catch {
      // In case path has special chars that fail CSS.escape
    }
  }, [activeFilePath]);

  if (files.length === 0 && !isSettingsOpen && !isReleaseNotesOpen) {
    return null;
  }

  const isSettingsActive = activeFilePath === 'termlet://settings';
  const isReleaseNotesActive = activeFilePath === 'termlet://release-notes';
  const hasSavedFiles = files.some((f) => !f.isDirty);
  const activeFile = files.find((f) => f.path === activeFilePath);

  return (
    <div className="flex items-center w-full bg-zinc-100 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800/80 select-none overflow-hidden relative">
      {/* Scrollable Tabs Track */}
      <div
        ref={scrollContainerRef}
        onWheel={handleWheel}
        className="editor-tabs-scrollbar flex items-center flex-1 min-w-0 overflow-x-auto scroll-smooth"
      >
        {/* Release Notes Tab if Open (like VS Code Release Notes) */}
        {isReleaseNotesOpen && (
          <div
            data-tab-path="termlet://release-notes"
            onClick={onSelectReleaseNotes}
            className={`group flex items-center gap-2 px-3 py-2 text-xs border-r border-zinc-200 dark:border-zinc-800/80 cursor-pointer transition-colors max-w-[210px] shrink-0 ${
              isReleaseNotesActive
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium border-t-2 border-t-blue-500'
                : 'bg-zinc-200/50 dark:bg-zinc-950/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200 border-t-2 border-t-transparent'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate flex-1">Release Notes</span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseReleaseNotes?.();
              }}
              title="Close Release Notes"
              className="p-0.5 rounded-sm hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* Settings Tab if Open (like VS Code) */}
        {isSettingsOpen && (
          <div
            data-tab-path="termlet://settings"
            onClick={onSelectSettings}
            className={`group flex items-center gap-2 px-3 py-2 text-xs border-r border-zinc-200 dark:border-zinc-800/80 cursor-pointer transition-colors max-w-[200px] shrink-0 ${
              isSettingsActive
                ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium border-t-2 border-t-blue-500'
                : 'bg-zinc-200/50 dark:bg-zinc-950/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200 border-t-2 border-t-transparent'
            }`}
          >
            <Settings className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="truncate flex-1">Settings</span>

            <button
              onClick={(e) => {
                e.stopPropagation();
                onCloseSettings();
              }}
              title="Close Settings"
              className="p-0.5 rounded-sm hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        )}

        {/* File Tabs */}
        {files.map((file) => {
          const isActive = file.path === activeFilePath && !isSettingsOpen && !isReleaseNotesActive;
          return (
            <div
              key={file.path}
              data-tab-path={file.path}
              onClick={() => onSelect(file.path)}
              className={`group flex items-center gap-2 px-3 py-2 text-xs border-r border-zinc-200 dark:border-zinc-800/80 cursor-pointer transition-colors max-w-[200px] shrink-0 ${
                isActive
                  ? 'bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 font-medium border-t-2 border-t-blue-500'
                  : 'bg-zinc-200/50 dark:bg-zinc-950/80 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-900/60 hover:text-zinc-900 dark:hover:text-zinc-200 border-t-2 border-t-transparent'
              }`}
            >
              <FileCode className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-blue-500' : 'text-zinc-400'}`} />
              <span className="truncate flex-1" title={file.path}>
                {file.name}
              </span>

              {/* Dirty indicator or close button */}
              <div className="flex items-center justify-center w-4 h-4">
                {file.isDirty ? (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      onClose(file.path);
                    }}
                    title="Unsaved changes"
                    className="w-2 h-2 rounded-full bg-amber-400 group-hover:hidden"
                  />
                ) : null}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onClose(file.path);
                  }}
                  title="Close Tab"
                  className={`p-0.5 rounded-sm hover:bg-zinc-200 dark:hover:bg-zinc-700/80 text-zinc-400 hover:text-zinc-800 dark:hover:text-zinc-200 cursor-pointer ${
                    file.isDirty ? 'hidden group-hover:block' : 'opacity-0 group-hover:opacity-100'
                  }`}
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pinned Tab Bar Actions (Scroll Chevrons + Dropdown Menu) */}
      <div className="flex items-center px-1.5 shrink-0 bg-zinc-100 dark:bg-zinc-950 border-l border-zinc-200 dark:border-zinc-800/80 z-10 gap-0.5">
        {hasOverflow && (
          <div className="flex items-center gap-0.5 pr-1 border-r border-zinc-200 dark:border-zinc-800">
            <button
              onClick={() => handleScrollBy(-200)}
              disabled={!canScrollLeft}
              title="Scroll Tabs Left"
              className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleScrollBy(200)}
              disabled={!canScrollRight}
              title="Scroll Tabs Right"
              className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 disabled:opacity-25 disabled:pointer-events-none cursor-pointer transition-colors"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger
            title="Tab Actions"
            className="h-6 w-6 inline-flex items-center justify-center rounded text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-200 dark:hover:bg-zinc-800 cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 text-zinc-800 dark:text-zinc-200 min-w-[160px]"
          >
            {activeFile && onCloseOthers && files.length > 1 && (
              <DropdownMenuItem
                onClick={() => onCloseOthers(activeFile.path)}
                className="text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer"
              >
                Close Other Tabs
              </DropdownMenuItem>
            )}

            {hasSavedFiles && onCloseSaved && (
              <DropdownMenuItem
                onClick={onCloseSaved}
                className="text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 cursor-pointer flex items-center justify-between"
              >
                <span>Close Saved Tabs</span>
                <CheckCheck className="w-3.5 h-3.5 text-zinc-400" />
              </DropdownMenuItem>
            )}

            {(activeFile && files.length > 1) || hasSavedFiles ? <DropdownMenuSeparator /> : null}

            <DropdownMenuItem
              onClick={onCloseAll}
              className="text-xs hover:bg-zinc-100 dark:hover:bg-zinc-800 text-rose-500 focus:text-rose-500 cursor-pointer"
            >
              Close All Tabs
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
};
