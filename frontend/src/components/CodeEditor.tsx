import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import CodeMirror, { Extension, ViewUpdate, ReactCodeMirrorRef } from '@uiw/react-codemirror';
import { languages } from '@codemirror/language-data';
import { LanguageDescription } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { search } from '@codemirror/search';
import { OpenFile } from '../types/remote';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';
import { Save, AlertCircle, FileCode, CheckCircle2, Search } from 'lucide-react';
import { Button } from './ui/button';
import { EditorFindReplace } from './EditorFindReplace';

import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { nord } from '@uiw/codemirror-theme-nord';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';
import { atomone } from '@uiw/codemirror-theme-atomone';
import { solarizedDark, solarizedLight } from '@uiw/codemirror-theme-solarized';
import { materialDark } from '@uiw/codemirror-theme-material';
import { sublime } from '@uiw/codemirror-theme-sublime';
import { xcodeDark, xcodeLight } from '@uiw/codemirror-theme-xcode';

interface CodeEditorProps {
  file: OpenFile | null;
  onChange: (content: string) => void;
  onSave: () => void;
  isSaving: boolean;
  settings?: AppSettings;
}

const THEME_MAP: Record<string, Extension> = {
  vscodeDark,
  tokyoNight,
  dracula,
  nord,
  monokai,
  githubDark,
  githubLight,
  atomone,
  solarizedDark,
  solarizedLight,
  materialDark,
  sublime,
  xcodeDark,
  xcodeLight,
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  file,
  onChange,
  onSave,
  isSaving,
  settings = DEFAULT_SETTINGS,
}) => {
  const [langExtension, setLangExtension] = useState<Extension[]>([]);
  const [langName, setLangName] = useState<string>('Plain Text');
  const [cursorPos, setCursorPos] = useState({ line: 1, col: 1 });

  // Find & Replace state
  const editorRef = useRef<ReactCodeMirrorRef>(null);
  const [editorView, setEditorView] = useState<EditorView | null>(null);
  const [isFindOpen, setIsFindOpen] = useState(false);
  const [findMode, setFindMode] = useState<'find' | 'replace'>('find');
  const [editorUpdateTrigger, setEditorUpdateTrigger] = useState(0);

  // Close find bar when switching files
  useEffect(() => {
    setIsFindOpen(false);
  }, [file?.path]);

  // Resolve language based on filename
  useEffect(() => {
    if (!file) {
      setLangExtension([]);
      setLangName('Plain Text');
      return;
    }

    const desc = LanguageDescription.matchFilename(languages, file.name);
    if (desc) {
      setLangName(desc.name);
      desc
        .load()
        .then((support) => {
          setLangExtension([support]);
        })
        .catch(() => {
          setLangExtension([]);
        });
    } else {
      setLangName('Plain Text');
      setLangExtension([]);
    }
  }, [file?.name]);

  // Handle Ctrl+S / Cmd+S (Save), Ctrl+F (Find), Ctrl+H (Replace)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        const key = e.key.toLowerCase();
        if (key === 's') {
          e.preventDefault();
          if (file && !file.isBinary) {
            onSave();
          }
        } else if (key === 'f') {
          e.preventDefault();
          if (file && !file.isBinary) {
            setFindMode('find');
            setIsFindOpen(true);
          }
        } else if (key === 'h') {
          e.preventDefault();
          if (file && !file.isBinary) {
            setFindMode('replace');
            setIsFindOpen(true);
          }
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, onSave]);

  const handleEditorUpdate = useCallback((update: ViewUpdate) => {
    if (update.selectionSet) {
      const state = update.state;
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      setCursorPos({
        line: line.number,
        col: head - line.from + 1,
      });
    }
    if (update.selectionSet || update.docChanged) {
      setEditorUpdateTrigger((prev) => prev + 1);
    }
  }, []);

  // Selected theme extension
  const selectedTheme = useMemo(() => {
    return THEME_MAP[settings.editorTheme] || vscodeDark;
  }, [settings.editorTheme]);

  // Compute editor extensions including wrap options and search match styling
  const editorExtensions = useMemo(() => {
    const exts: Extension[] = [
      ...langExtension,
      search({ top: false }),
      EditorView.theme({
        '.cm-searchMatch': {
          backgroundColor: 'rgba(234, 179, 8, 0.35)',
          outline: '1px solid rgba(234, 179, 8, 0.6)',
          borderRadius: '2px',
        },
        '.cm-searchMatch-selected': {
          backgroundColor: 'rgba(249, 115, 22, 0.75) !important',
          outline: '1px solid rgba(249, 115, 22, 0.95)',
          borderRadius: '2px',
        },
      }),
    ];

    // Word wrap
    if (settings.wordWrap) {
      exts.push(EditorView.lineWrapping);
    }

    return exts;
  }, [langExtension, settings.wordWrap]);

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-500 select-none">
        <FileCode className="w-16 h-16 stroke-[1.2] mb-4 text-zinc-400 dark:text-zinc-600" />
        <h3 className="text-lg font-medium text-zinc-800 dark:text-zinc-300">No File Open</h3>
        <p className="text-sm text-zinc-600 dark:text-zinc-500 mt-1 max-w-sm text-center">
          Select a file from the remote file explorer on the left or connect to a server.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400 bg-white dark:bg-zinc-900/80 px-3 py-1.5 rounded-md border border-zinc-200 dark:border-zinc-800 shadow-2xs">
          <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">Ctrl</kbd> +{' '}
          <kbd className="font-mono bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 border border-zinc-200 dark:border-zinc-700 px-1.5 py-0.5 rounded">S</kbd> to save
        </div>
      </div>
    );
  }

  if (file.isBinary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-50 dark:bg-zinc-950 text-zinc-600 dark:text-zinc-400 select-none p-6">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
        <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200">Binary File Detected</h3>
        <p className="text-sm text-zinc-500 mt-1 text-center max-w-md">
          {file.name} cannot be displayed in the text editor because it contains binary data.
        </p>
        <p className="text-xs text-zinc-400 dark:text-zinc-600 mt-2">Size: {(file.size / 1024).toFixed(1)} KB</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden relative">
      {/* Floating Find & Replace Toolbar */}
      <EditorFindReplace
        view={editorView}
        isOpen={isFindOpen}
        onClose={() => setIsFindOpen(false)}
        initialMode={findMode}
        updateTrigger={editorUpdateTrigger}
      />

      {/* Editor Main Canvas */}
      <div
        className="flex-1 overflow-auto relative"
        style={{ fontSize: `${settings.fontSize}px` }}
      >
        <CodeMirror
          ref={editorRef}
          key={`${file.path}-${settings.editorTheme}`}
          value={file.content}
          height="100%"
          theme={selectedTheme}
          extensions={editorExtensions}
          onChange={onChange}
          onCreateEditor={(view) => setEditorView(view)}
          onUpdate={handleEditorUpdate}
          basicSetup={{
            lineNumbers: settings.lineNumbers,
            highlightActiveLineGutter: true,
            highlightSpecialChars: true,
            history: true,
            foldGutter: true,
            drawSelection: true,
            dropCursor: true,
            allowMultipleSelections: true,
            indentOnInput: true,
            syntaxHighlighting: true,
            bracketMatching: true,
            closeBrackets: true,
            autocompletion: true,
            rectangularSelection: true,
            crosshairCursor: true,
            highlightActiveLine: true,
            highlightSelectionMatches: true,
            closeBracketsKeymap: true,
            defaultKeymap: true,
            searchKeymap: false,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          className="h-full font-mono"
        />
      </div>

      {/* Editor Bottom Status Bar */}
      <div className="h-6 bg-zinc-100 dark:bg-zinc-900 border-t border-zinc-200 dark:border-zinc-800/80 px-3 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-zinc-800 dark:text-zinc-300">
            {file.isDirty ? (
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-emerald-600 dark:text-emerald-500" />
            )}
            {file.name}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span className="text-zinc-500 dark:text-zinc-400 font-mono text-[10px] truncate max-w-xs" title={file.path}>
            {file.path}
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span className="bg-zinc-200 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">
            {langName}
          </span>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <span>UTF-8</span>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setFindMode('find');
              setIsFindOpen((prev) => !prev);
            }}
            className="h-5 px-2 text-[11px] text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
            title="Find & Replace (Ctrl+F / Ctrl+H)"
          >
            <Search className="w-3 h-3" />
            Find
          </Button>
          <span className="text-zinc-300 dark:text-zinc-600">|</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!file.isDirty || isSaving}
            onClick={onSave}
            className="h-5 px-2 text-[11px] text-zinc-700 dark:text-zinc-200 hover:text-zinc-950 dark:hover:text-zinc-100 hover:bg-zinc-200/80 dark:hover:bg-zinc-800 flex items-center gap-1 cursor-pointer disabled:opacity-40"
          >
            <Save className="w-3 h-3" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};
