import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { tauriStorage } from './tauriStorage';

export interface Snippet {
  id: string;
  name: string;
  sql: string;
  connectionId?: string;
  database?: string;
  createdAt: number;
  updatedAt: number;
}

interface SnippetState {
  snippets: Snippet[];
  addSnippet: (snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>) => void;
  updateSnippet: (id: string, updates: Partial<Pick<Snippet, 'name' | 'sql' | 'connectionId' | 'database'>>) => void;
  removeSnippet: (id: string) => void;
  getSnippetsByConnection: (connectionId: string) => Snippet[];
}

export const useSnippetStore = create<SnippetState>()(
  persist(
    (set, get) => ({
      snippets: [],

      addSnippet: (snippet) => {
        const entry: Snippet = {
          ...snippet,
          id: `snip_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        };
        set((state) => ({
          snippets: [entry, ...state.snippets],
        }));
      },

      updateSnippet: (id, updates) => {
        set((state) => ({
          snippets: state.snippets.map((s) =>
            s.id === id ? { ...s, ...updates, updatedAt: Date.now() } : s
          ),
        }));
      },

      removeSnippet: (id) => {
        set((state) => ({
          snippets: state.snippets.filter((s) => s.id !== id),
        }));
      },

      getSnippetsByConnection: (connectionId) =>
        get().snippets.filter((s) => s.connectionId === connectionId),
    }),
    {
      name: 'onedb-snippets',
      storage: createJSONStorage(() => tauriStorage),
    }
  )
);
