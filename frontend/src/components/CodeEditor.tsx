import React, { useEffect, useState, useMemo, useCallback } from 'react';
import CodeMirror, { Extension, ViewUpdate } from '@uiw/react-codemirror';
import { languages } from '@codemirror/language-data';
import { LanguageDescription } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { OpenFile } from '../types/remote';
import { AppSettings, DEFAULT_SETTINGS } from '../types/settings';
import { Save, AlertCircle, FileCode, CheckCircle2 } from 'lucide-react';
import { Button } from './ui/button';

import { vscodeDark } from '@uiw/codemirror-theme-vscode';
import { tokyoNight } from '@uiw/codemirror-theme-tokyo-night';
import { dracula } from '@uiw/codemirror-theme-dracula';
import { nord } from '@uiw/codemirror-theme-nord';
import { monokai } from '@uiw/codemirror-theme-monokai';
import { githubDark, githubLight } from '@uiw/codemirror-theme-github';

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

  // Handle Ctrl+S / Cmd+S
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        if (file && !file.isBinary) {
          onSave();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [file, onSave]);

  const handleCursorChange = useCallback((update: ViewUpdate) => {
    if (update.selectionSet) {
      const state = update.state;
      const head = state.selection.main.head;
      const line = state.doc.lineAt(head);
      setCursorPos({
        line: line.number,
        col: head - line.from + 1,
      });
    }
  }, []);

  // Compute editor extensions including selected theme & wrap options
  const editorExtensions = useMemo(() => {
    const exts: Extension[] = [...langExtension];

    // Theme extension
    const selectedTheme = THEME_MAP[settings.editorTheme] || vscodeDark;
    exts.push(selectedTheme);

    // Word wrap
    if (settings.wordWrap) {
      exts.push(EditorView.lineWrapping);
    }

    return exts;
  }, [langExtension, settings.editorTheme, settings.wordWrap]);

  if (!file) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-500 select-none">
        <FileCode className="w-16 h-16 stroke-[1.2] mb-4 text-zinc-600" />
        <h3 className="text-lg font-medium text-zinc-300">No File Open</h3>
        <p className="text-sm text-zinc-500 mt-1 max-w-sm text-center">
          Select a file from the remote file explorer on the left or connect to a server.
        </p>
        <div className="mt-4 flex items-center gap-2 text-xs text-zinc-600 bg-zinc-900/80 px-3 py-1.5 rounded-md border border-zinc-800">
          <kbd className="font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">Ctrl</kbd> +{' '}
          <kbd className="font-mono bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded">S</kbd> to save
        </div>
      </div>
    );
  }

  if (file.isBinary) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-zinc-950 text-zinc-400 select-none p-6">
        <AlertCircle className="w-12 h-12 text-amber-500 mb-3" />
        <h3 className="text-base font-semibold text-zinc-200">Binary File Detected</h3>
        <p className="text-sm text-zinc-500 mt-1 text-center max-w-md">
          {file.name} cannot be displayed in the text editor because it contains binary data.
        </p>
        <p className="text-xs text-zinc-600 mt-2">Size: {(file.size / 1024).toFixed(1)} KB</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Editor Main Canvas */}
      <div
        className="flex-1 overflow-auto relative"
        style={{ fontSize: `${settings.fontSize}px` }}
      >
        <CodeMirror
          value={file.content}
          height="100%"
          theme={settings.editorTheme === 'githubLight' ? 'light' : 'dark'}
          extensions={editorExtensions}
          onChange={onChange}
          onUpdate={handleCursorChange}
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
            searchKeymap: true,
            historyKeymap: true,
            foldKeymap: true,
            completionKeymap: true,
            lintKeymap: true,
          }}
          className="h-full font-mono"
        />
      </div>

      {/* Editor Bottom Status Bar */}
      <div className="h-6 bg-zinc-900 border-t border-zinc-800/80 px-3 flex items-center justify-between text-[11px] text-zinc-400 select-none">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 font-medium text-zinc-300">
            {file.isDirty ? (
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            ) : (
              <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            )}
            {file.name}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="text-zinc-400 font-mono text-[10px] truncate max-w-xs" title={file.path}>
            {file.path}
          </span>
        </div>

        <div className="flex items-center gap-4 font-mono text-[11px]">
          <span>
            Ln {cursorPos.line}, Col {cursorPos.col}
          </span>
          <span className="text-zinc-600">|</span>
          <span className="bg-zinc-800 text-zinc-300 px-1.5 py-0.5 rounded text-[10px]">
            {langName}
          </span>
          <span className="text-zinc-600">|</span>
          <span>UTF-8</span>
          <span className="text-zinc-600">|</span>
          <Button
            size="sm"
            variant="ghost"
            disabled={!file.isDirty || isSaving}
            onClick={onSave}
            className="h-5 px-2 text-[11px] text-zinc-200 hover:bg-zinc-800 flex items-center gap-1 cursor-pointer"
          >
            <Save className="w-3 h-3" />
            {isSaving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>
    </div>
  );
};
