import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppSettings, EditorSettings, AISettings, SecuritySettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';

interface SettingsState extends AppSettings {
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateEditor: (updates: Partial<EditorSettings>) => void;
  updateAI: (updates: Partial<AISettings>) => void;
  updateSecurity: (updates: Partial<SecuritySettings>) => void;
  resetSettings: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      updateSettings: (updates) => set((state) => ({ ...state, ...updates })),

      updateEditor: (updates) =>
        set((state) => ({
          editor: { ...state.editor, ...updates },
        })),

      updateAI: (updates) =>
        set((state) => ({
          ai: { ...state.ai, ...updates },
        })),

      updateSecurity: (updates) =>
        set((state) => ({
          security: { ...state.security, ...updates },
        })),

      resetSettings: () => set(DEFAULT_SETTINGS),
    }),
    {
      name: 'onedb-settings',
    }
  )
);
