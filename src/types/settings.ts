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

export interface AIProvider {
  id: string;
  name: string;
  baseUrl: string;
  models: { id: string; name: string }[];
}

export const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { id: 'gpt-4', name: 'GPT-4' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
    ],
  },
  {
    id: 'zhipu',
    name: '智谱 AI (ZhipuAI)',
    baseUrl: 'https://open.bigmodel.cn/api/paas/v4',
    models: [
      { id: 'glm-5.2', name: 'GLM-5.2 (旗舰)' },
      { id: 'glm-5.1', name: 'GLM-5.1' },
      { id: 'glm-5', name: 'GLM-5' },
      { id: 'glm-5-turbo', name: 'GLM-5-Turbo' },
      { id: 'glm-4.7', name: 'GLM-4.7' },
      { id: 'glm-4.7-flash', name: 'GLM-4.7-Flash' },
      { id: 'glm-4.6', name: 'GLM-4.6' },
      { id: 'glm-4.5', name: 'GLM-4.5' },
      { id: 'glm-4.5-air', name: 'GLM-4.5-Air' },
      { id: 'glm-4.5-flash', name: 'GLM-4.5-Flash (免费)' },
      { id: 'glm-4-plus', name: 'GLM-4-Plus' },
      { id: 'glm-4', name: 'GLM-4' },
      { id: 'glm-4-flash', name: 'GLM-4-Flash' },
      { id: 'glm-4-long', name: 'GLM-4-Long' },
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-reasoner', name: 'DeepSeek Reasoner' },
    ],
  },
  {
    id: 'custom',
    name: '自定义 (Custom)',
    baseUrl: '',
    models: [],
  },
];

export interface AISettings {
  provider: string;
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
    provider: 'openai',
    apiKey: '',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
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
