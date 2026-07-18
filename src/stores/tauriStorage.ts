import { load, type Store } from '@tauri-apps/plugin-store';
import { rename, exists, mkdir, readTextFile, writeTextFile } from '@tauri-apps/plugin-fs';
import type { StateStorage } from 'zustand/middleware';

const STORE_FILE = 'store.json';
const CONFIG_FILE = 'config.json';

/**
 * Singleton StoreManager wrapping @tauri-apps/plugin-store.
 *
 * Bootstrap flow:
 *   1. Read appDataDir/config.json to get the actual data path
 *   2. If config has a dataPath, load store from there; otherwise from appDataDir
 *   3. switchPath() updates config.json + moves store.json + reloads
 */
export class StoreManager {
  private static instance: StoreManager | null = null;

  store: Store;
  path: string;
  private defaultPath: string;

  private constructor(store: Store, path: string, defaultPath: string) {
    this.store = store;
    this.path = path;
    this.defaultPath = defaultPath;
  }

  /**
   * Initialize the singleton (call once at app startup).
   * Reads config.json from defaultPath to determine actual data location.
   */
  static async init(defaultPath: string): Promise<StoreManager> {
    if (StoreManager.instance) return StoreManager.instance;

    // Ensure default directory exists
    try {
      await mkdir(defaultPath, { recursive: true });
    } catch {
      // directory may already exist
    }

    // Read config to find actual data path
    let dataPath = defaultPath;
    try {
      const raw = await readTextFile(`${defaultPath}/${CONFIG_FILE}`);
      const config = JSON.parse(raw) as { dataPath?: string };
      if (config.dataPath) {
        dataPath = config.dataPath;
        // Ensure custom data directory exists
        try {
          await mkdir(dataPath, { recursive: true });
        } catch {
          // directory may already exist
        }
      }
    } catch {
      // config doesn't exist yet, use default path
    }

    const store = await load(`${dataPath}/${STORE_FILE}`, { autoSave: false, defaults: {} });
    StoreManager.instance = new StoreManager(store, dataPath, defaultPath);
    return StoreManager.instance;
  }

  /** Get the singleton instance */
  static getInstance(): StoreManager {
    if (!StoreManager.instance) {
      throw new Error('StoreManager not initialized. Call StoreManager.init(path) first.');
    }
    return StoreManager.instance;
  }

  /** Get a value by key */
  async get<T>(key: string): Promise<T | undefined> {
    return await this.store.get<T>(key);
  }

  /** Set a value by key and persist to disk */
  async set(key: string, value: unknown): Promise<void> {
    await this.store.set(key, value);
    await this.store.save();
  }

  /** Delete a key and persist */
  async delete(key: string): Promise<void> {
    await this.store.delete(key);
    await this.store.save();
  }

  /** Get all entries */
  async entries(): Promise<[string, unknown][]> {
    return await this.store.entries();
  }

  /** Clear all data and persist */
  async clear(): Promise<void> {
    await this.store.clear();
    await this.store.save();
  }

  /**
   * Switch storage to a new directory path.
   * 1. Save current store to disk
   * 2. Update config.json with new path (always in defaultPath)
   * 3. Move store.json from old path to new path
   * 4. Reload store from new location
   */
  async switchPath(newPath: string): Promise<void> {
    const oldFile = `${this.path}/${STORE_FILE}`;
    const newFile = `${newPath}/${STORE_FILE}`;

    // Flush current data to disk before closing
    await this.store.save();
    await this.store.close();

    // Write config.json to defaultPath so next startup knows the data location
    await writeTextFile(
      `${this.defaultPath}/${CONFIG_FILE}`,
      JSON.stringify({ dataPath: newPath })
    );

    // Ensure new directory exists
    try {
      await mkdir(newPath, { recursive: true });
    } catch {
      // directory may already exist
    }

    // Move store file from old path to new path (skip if old file doesn't exist)
    try {
      if (await exists(oldFile)) {
        await rename(oldFile, newFile);
      }
    } catch (e) {
      console.error('[StoreManager] Failed to move store file:', e);
    }

    // Update path and reload store from new location
    this.path = newPath;
    this.store = await load(newFile, { autoSave: false, defaults: {} });
  }

  /**
   * Reset storage to default path.
   * Moves store.json back to defaultPath and clears config.json.
   */
  async resetPath(): Promise<void> {
    await this.switchPath(this.defaultPath);
    // Clear config so dataPath is empty (uses default)
    await writeTextFile(
      `${this.defaultPath}/${CONFIG_FILE}`,
      JSON.stringify({ dataPath: '' })
    );
  }
}

// ─── zustand adapter ──────────────────────────────────────────────────

export const tauriStorage: StateStorage = {
  getItem: async (name: string): Promise<string | null> => {
    const mgr = StoreManager.getInstance();
    const value = await mgr.get<unknown>(name);
    if (value === undefined || value === null) return null;
    return JSON.stringify(value);
  },

  setItem: async (name: string, value: string): Promise<void> => {
    const mgr = StoreManager.getInstance();
    const parsed = JSON.parse(value);
    await mgr.set(name, parsed);
  },

  removeItem: async (name: string): Promise<void> => {
    const mgr = StoreManager.getInstance();
    await mgr.delete(name);
  },
};
