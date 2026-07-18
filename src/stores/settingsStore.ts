import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AppSettings, EditorSettings, AISettings, SecuritySettings, StorageSettings } from '../types/settings';
import { DEFAULT_SETTINGS } from '../types/settings';
import { tauriStorage } from './tauriStorage';

interface SettingsState extends AppSettings {
  /** Whether the app is currently locked (requires master password to unlock) */
  isLocked: boolean;
  updateSettings: (updates: Partial<AppSettings>) => void;
  updateEditor: (updates: Partial<EditorSettings>) => void;
  updateAI: (updates: Partial<AISettings>) => void;
  updateSecurity: (updates: Partial<SecuritySettings>) => void;
  updateStorage: (updates: Partial<StorageSettings>) => void;
  resetSettings: () => void;
  setLocked: (locked: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      isLocked: false,

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

      updateStorage: (updates) =>
        set((state) => ({
          storage: { ...state.storage, ...updates },
        })),

      resetSettings: () => set(DEFAULT_SETTINGS),

      setLocked: (locked) => set({ isLocked: locked }),
    }),
    {
      name: 'onedb-settings',
      storage: createJSONStorage(() => tauriStorage),
      partialize: (state) => {
        // Don't persist isLocked - it's a runtime state
        const { isLocked, ...rest } = state;
        return rest;
      },
    }
  )
);
