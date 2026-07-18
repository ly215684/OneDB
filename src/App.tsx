import { useEffect, useRef, useCallback } from 'react';
import { useThemeStore } from './stores/themeStore';
import { useSettingsStore } from './stores/settingsStore';
import { MainLayout } from './layouts/MainLayout';
import { DialogProvider } from './components/ui/Dialog';
import { MessageProvider } from './components/ui/Message';
import { LockScreen } from './components/LockScreen';
import { encryptionKeyManager } from './services/cryptoService';

function App() {
  const applyTheme = useThemeStore((s) => s.applyTheme);
  const isLocked = useSettingsStore((s) => s.isLocked);
  const setLocked = useSettingsStore((s) => s.setLocked);
  const security = useSettingsStore((s) => s.security);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // StoreManager is already initialized in main.tsx before React renders.
  // Apply theme on mount.
  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  // Disable browser default context menu globally
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  // ─── Auto-lock logic ───────────────────────────────────────────────
  const resetAutoLockTimer = useCallback(() => {
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }

    if (security.masterPasswordEnabled && security.autoLockEnabled && !isLocked) {
      const minutes = security.autoLockMinutes || 15;
      autoLockTimerRef.current = setTimeout(() => {
        encryptionKeyManager.lock();
        setLocked(true);
      }, minutes * 60 * 1000);
    }
  }, [security.masterPasswordEnabled, security.autoLockEnabled, security.autoLockMinutes, isLocked, setLocked]);

  useEffect(() => {
    resetAutoLockTimer();

    if (!security.masterPasswordEnabled || !security.autoLockEnabled || isLocked) {
      return;
    }

    // Reset timer on user activity
    const events = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart'];
    const handleActivity = () => resetAutoLockTimer();

    events.forEach((event) => document.addEventListener(event, handleActivity, { passive: true }));
    return () => {
      events.forEach((event) => document.removeEventListener(event, handleActivity));
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    };
  }, [resetAutoLockTimer, security.masterPasswordEnabled, security.autoLockEnabled, isLocked]);

  // Lock on startup if master password is enabled
  useEffect(() => {
    if (security.masterPasswordEnabled && security.passwordHash) {
      encryptionKeyManager.lock();
      setLocked(true);
    }
  }, []); // Only on initial load

  return (
    <DialogProvider>
      <MessageProvider>
        {isLocked ? <LockScreen /> : <MainLayout />}
      </MessageProvider>
    </DialogProvider>
  );
}

export default App;
