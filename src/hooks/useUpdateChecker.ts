import { useState, useCallback, useRef } from 'react';
import { check, type Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';

export type UpdateStatus = 'idle' | 'checking' | 'available' | 'downloading' | 'ready' | 'error' | 'up-to-date';

export interface UpdateState {
  status: UpdateStatus;
  version: string | null;
  body: string | null;
  progress: number;
  error: string | null;
}

export function useUpdateChecker() {
  const [state, setState] = useState<UpdateState>({
    status: 'idle',
    version: null,
    body: null,
    progress: 0,
    error: null,
  });
  const updateRef = useRef<Update | null>(null);

  const checkForUpdate = useCallback(async () => {
    setState((prev) => ({ ...prev, status: 'checking', error: null }));
    try {
      const update = await check();
      if (update?.available) {
        updateRef.current = update;
        setState((prev) => ({
          ...prev,
          status: 'available',
          version: update.version,
          body: update.body || null,
        }));
      } else {
        updateRef.current = null;
        setState((prev) => ({ ...prev, status: 'up-to-date' }));
      }
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const downloadAndInstall = useCallback(async () => {
    const update = updateRef.current;
    if (!update) return;

    setState((prev) => ({ ...prev, status: 'downloading', progress: 0 }));
    let contentLength = 0;
    let downloaded = 0;
    try {
      await update.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            contentLength = event.data.contentLength || 0;
            break;
          case 'Progress':
            downloaded += event.data.chunkLength;
            if (contentLength > 0) {
              setState((prev) => ({
                ...prev,
                progress: Math.round((downloaded / contentLength) * 100),
              }));
            }
            break;
          case 'Finished':
            setState((prev) => ({ ...prev, status: 'ready', progress: 100 }));
            break;
        }
      });
      setState((prev) => ({ ...prev, status: 'ready', progress: 100 }));
    } catch (err) {
      setState((prev) => ({
        ...prev,
        status: 'error',
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  const restart = useCallback(async () => {
    await relaunch();
  }, []);

  return {
    ...state,
    checkForUpdate,
    downloadAndInstall,
    restart,
  };
}
