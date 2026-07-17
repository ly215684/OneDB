import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { QueryResult } from '../types/connection';

export interface QueryHistoryItem {
  id: string;
  sql: string;
  connectionId: string;
  database?: string;
  result?: QueryResult;
  timestamp: number;
  duration: number;
}

interface QueryHistoryState {
  history: QueryHistoryItem[];
  addHistory: (item: Omit<QueryHistoryItem, 'id' | 'timestamp'>) => void;
  clearHistory: (connectionId?: string) => void;
  getHistoryByConnection: (connectionId: string) => QueryHistoryItem[];
}

export const useQueryHistoryStore = create<QueryHistoryState>()(
  persist(
    (set, get) => ({
      history: [],

      addHistory: (item) => {
        const entry: QueryHistoryItem = {
          ...item,
          id: `qh_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          timestamp: Date.now(),
        };
        set((state) => ({
          history: [entry, ...state.history].slice(0, 500), // Keep last 500
        }));
      },

      clearHistory: (connectionId) => {
        if (connectionId) {
          set((state) => ({
            history: state.history.filter((h) => h.connectionId !== connectionId),
          }));
        } else {
          set({ history: [] });
        }
      },

      getHistoryByConnection: (connectionId) =>
        get().history.filter((h) => h.connectionId === connectionId),
    }),
    {
      name: 'onedb-query-history',
    }
  )
);
