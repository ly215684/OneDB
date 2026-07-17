import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Connection, DatabaseType, DatabaseInfo } from '../types/connection';

interface ConnectionState {
  connections: Connection[];
  activeConnectionId: string | null;
  addConnection: (conn: Omit<Connection, 'id' | 'createdAt' | 'updatedAt'>) => Connection;
  updateConnection: (id: string, updates: Partial<Connection>) => void;
  removeConnection: (id: string) => void;
  duplicateConnection: (id: string) => void;
  setActiveConnection: (id: string | null) => void;
  setConnectionStatus: (id: string, isConnected: boolean) => void;
  setDatabases: (id: string, databases: DatabaseInfo[]) => void;
  getConnection: (id: string) => Connection | undefined;
  getConnectionsByType: (type: DatabaseType) => Connection[];
}

function generateId(): string {
  return `conn_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useConnectionStore = create<ConnectionState>()(
  persist(
    (set, get) => ({
      connections: [],
      activeConnectionId: null,

      addConnection: (connData) => {
        const now = Date.now();
        const conn: Connection = {
          ...connData,
          id: generateId(),
          createdAt: now,
          updatedAt: now,
        };
        set((state) => ({ connections: [...state.connections, conn] }));
        return conn;
      },

      updateConnection: (id, updates) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, ...updates, updatedAt: Date.now() } : c
          ),
        }));
      },

      removeConnection: (id) => {
        set((state) => ({
          connections: state.connections.filter((c) => c.id !== id),
          activeConnectionId: state.activeConnectionId === id ? null : state.activeConnectionId,
        }));
      },

      duplicateConnection: (id) => {
        const conn = get().connections.find((c) => c.id === id);
        if (conn) {
          const now = Date.now();
          const newConn: Connection = {
            ...conn,
            id: generateId(),
            name: `${conn.name} (Copy)`,
            createdAt: now,
            updatedAt: now,
            isConnected: false,
          };
          set((state) => ({ connections: [...state.connections, newConn] }));
        }
      },

      setActiveConnection: (id) => set({ activeConnectionId: id }),

      setConnectionStatus: (id, isConnected) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, isConnected, updatedAt: Date.now() } : c
          ),
        }));
      },

      setDatabases: (id, databases) => {
        set((state) => ({
          connections: state.connections.map((c) =>
            c.id === id ? { ...c, databases, updatedAt: Date.now() } : c
          ),
        }));
      },

      getConnection: (id) => get().connections.find((c) => c.id === id),

      getConnectionsByType: (type) => get().connections.filter((c) => c.type === type),
    }),
    {
      name: 'onedb-connections',
      partialize: (state) => ({
        connections: state.connections.map((c) => ({
          ...c,
          isConnected: false,
          databases: [],
        })),
        activeConnectionId: null,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Reset runtime fields on app start (covers stale persisted data)
          state.connections = state.connections.map((c) => ({
            ...c,
            isConnected: false,
            databases: [],
          }));
          state.activeConnectionId = null;
        }
      },
    }
  )
);
