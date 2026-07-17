export type ThemeMode = 'light' | 'dark' | 'system';

export interface AppSettings {
  theme: ThemeMode;
  language: 'zh' | 'en';
  editor: EditorSettings;
  ai: AISettings;
  shortcuts: ShortcutSettings;
  security: SecuritySettings;
}

export interface EditorSettings {
  fontFamily: string;
  fontSize: number;
  tabSize: number;
  wordWrap: boolean;
  minimap: boolean;
  lineNumbers: boolean;
}

export interface AISettings {
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
}

export interface ShortcutSettings {
  executeSql: string;
  save: string;
  newQuery: string;
  closeTab: string;
  reopenTab: string;
  formatSql: string;
  find: string;
  replace: string;
}

export interface SecuritySettings {
  masterPasswordEnabled: boolean;
  autoLockEnabled: boolean;
  autoLockMinutes: number;
  showPasswords: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  language: 'zh',
  editor: {
    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Consolas, monospace",
    fontSize: 13,
    tabSize: 2,
    wordWrap: true,
    minimap: false,
    lineNumbers: true,
  },
  ai: {
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4',
    enabled: false,
  },
  shortcuts: {
    executeSql: 'Ctrl+Enter',
    save: 'Ctrl+S',
    newQuery: 'Ctrl+N',
    closeTab: 'Ctrl+W',
    reopenTab: 'Ctrl+Shift+T',
    formatSql: 'Ctrl+Shift+F',
    find: 'Ctrl+F',
    replace: 'Ctrl+H',
  },
  security: {
    masterPasswordEnabled: false,
    autoLockEnabled: false,
    autoLockMinutes: 15,
    showPasswords: false,
  },
};
