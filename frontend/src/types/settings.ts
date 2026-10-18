export type EditorTheme =
  | 'vscodeDark'
  | 'tokyoNight'
  | 'dracula'
  | 'nord'
  | 'githubDark'
  | 'githubLight'
  | 'monokai';

export interface AppSettings {
  editorTheme: EditorTheme;
  uiTheme: 'dark' | 'light';
  fontSize: number;
  tabSize: number;
  lineNumbers: boolean;
  wordWrap: boolean;
  confirmDelete: boolean;
  defaultPort: number;
}

export const DEFAULT_SETTINGS: AppSettings = {
  editorTheme: 'vscodeDark',
  uiTheme: 'dark',
  fontSize: 13,
  tabSize: 2,
  lineNumbers: true,
  wordWrap: false,
  confirmDelete: true,
  defaultPort: 22,
};
