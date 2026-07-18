import React from 'react';
import ReactDOM from 'react-dom/client';
import './i18n';
import './index.css';
import { appDataDir } from '@tauri-apps/api/path';
import { StoreManager } from './stores/tauriStorage';

// Initialize StoreManager BEFORE importing App (and its stores)
// so zustand persist middleware can rehydrate data during store creation.
// We use dynamic import() because static imports are hoisted and evaluated
// before any module body code runs.
(async () => {
  try {
    const defaultPath = await appDataDir();
    await StoreManager.init(defaultPath);
  } catch (e) {
    console.error('[main] Failed to initialize storage:', e);
  }

  // Import App AFTER StoreManager is ready — this triggers store creation
  // and zustand persist rehydration with a valid storage backend.
  const { default: App } = await import('./App');

  ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
})();
