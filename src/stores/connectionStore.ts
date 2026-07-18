import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Connection, DatabaseType, DatabaseInfo } from '../types/connection';
import { tauriStorage } from './tauriStorage';
import { encryptionKeyManager, encryptConfig, decryptConfig } from '../services/cryptoService';
import { useSettingsStore } from './settingsStore';
import type { StateStorage } from 'zustand/middleware';

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

// ─── Encrypted Storage Wrapper ──────────────────────────────────────

/**
 * Custom storage that encrypts sensitive connection fields before persisting
 * and decrypts them when loading.
 */
const encryptedConnectionStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const raw = await tauriStorage.getItem(name);
    if (!raw) return null;

    try {
      const parsed = JSON.parse(raw);
      const security = useSettingsStore.getState().security;
      const key = encryptionKeyManager.getKey();

      if (security.masterPasswordEnabled && key && parsed?.state?.connections) {
        // Decrypt connection configs
        const decryptedConnections = await Promise.all(
          parsed.state.connections.map(async (c: Connection) => ({
            ...c,
            config: await decryptConfig(c.config as Parameters<typeof decryptConfig>[0], key) as Connection['config'],
          }))
        );
        parsed.state.connections = decryptedConnections;
        return JSON.stringify(parsed);
      }

      return raw;
    } catch {
      return raw;
    }
  },

  setItem: async (name: string, value: string): Promise<void> => {
    try {
      const parsed = JSON.parse(value);
      const security = useSettingsStore.getState().security;
      const key = encryptionKeyManager.getKey();

      if (security.masterPasswordEnabled && key && parsed?.state?.connections) {
        // Encrypt connection configs before saving
        const encryptedConnections = await Promise.all(
          parsed.state.connections.map(async (c: Connection) => ({
            ...c,
            config: await encryptConfig(c.config as Parameters<typeof encryptConfig>[0], key) as Connection['config'],
          }))
        );
        parsed.state.connections = encryptedConnections;
        await tauriStorage.setItem(name, JSON.stringify(parsed));
        return;
      }

      await tauriStorage.setItem(name, value);
    } catch {
      await tauriStorage.setItem(name, value);
    }
  },

  removeItem: async (name: string): Promise<void> => {
    await tauriStorage.removeItem(name);
  },
};

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
      storage: createJSONStorage(() => encryptedConnectionStorage),
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

/**
 * Re-encrypt all connections with a new key (e.g., after changing master password).
 * This forces a re-persist with the new encryption key.
 */
export async function reEncryptAllConnections(): Promise<void> {
  const state = useConnectionStore.getState();
  // Force a re-save by triggering a no-op state update
  // The encryptedConnectionStorage.setItem will use the current key
  const connections = state.connections;
  useConnectionStore.setState({ connections: [...connections] });
}

/**
 * Decrypt all connections and save without encryption (when disabling master password).
 */
export async function decryptAllConnections(): Promise<void> {
  const state = useConnectionStore.getState();
  const key = encryptionKeyManager.getKey();
  if (!key) return;

  const decryptedConnections = await Promise.all(
    state.connections.map(async (c) => ({
      ...c,
      config: await decryptConfig(c.config as Parameters<typeof decryptConfig>[0], key) as typeof c.config,
    }))
  );

  useConnectionStore.setState({ connections: decryptedConnections });
}

/**
 * Encrypt all currently-plaintext connections (when first enabling master password).
 */
export async function encryptAllConnections(): Promise<void> {
  // Force re-persist which will encrypt via the storage wrapper
  const state = useConnectionStore.getState();
  useConnectionStore.setState({ connections: [...state.connections] });
}
