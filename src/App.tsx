import { useEffect } from 'react';
import { useThemeStore } from './stores/themeStore';
import { MainLayout } from './layouts/MainLayout';
import { DialogProvider } from './components/ui/Dialog';
import { MessageProvider } from './components/ui/Message';

function App() {
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  // Disable browser default context menu globally
  useEffect(() => {
    const handler = (e: MouseEvent) => e.preventDefault();
    document.addEventListener('contextmenu', handler);
    return () => document.removeEventListener('contextmenu', handler);
  }, []);

  return (
    <DialogProvider>
      <MessageProvider>
        <MainLayout />
      </MessageProvider>
    </DialogProvider>
  );
}

export default App;
