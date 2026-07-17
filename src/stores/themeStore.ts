import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ThemeMode } from '../types/settings';

interface ThemeState {
  mode: ThemeMode;
  resolved: 'light' | 'dark';
  setMode: (mode: ThemeMode) => void;
  applyTheme: () => void;
}

function getSystemTheme(): 'light' | 'dark' {
  if (typeof window !== 'undefined') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return 'light';
}

function resolveTheme(mode: ThemeMode): 'light' | 'dark' {
  return mode === 'system' ? getSystemTheme() : mode;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      mode: 'system',
      resolved: resolveTheme('system'),
      setMode: (mode: ThemeMode) => {
        const resolved = resolveTheme(mode);
        set({ mode, resolved });
        get().applyTheme();
      },
      applyTheme: () => {
        const resolved = get().resolved;
        const root = document.documentElement;
        if (resolved === 'dark') {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      },
    }),
    {
      name: 'onedb-theme',
      partialize: (state) => ({ mode: state.mode }),
    }
  )
);

// Initialize theme on load
if (typeof window !== 'undefined') {
  const store = useThemeStore.getState();
  store.applyTheme();

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (useThemeStore.getState().mode === 'system') {
      const resolved = getSystemTheme();
      useThemeStore.setState({ resolved });
      useThemeStore.getState().applyTheme();
    }
  });
}
