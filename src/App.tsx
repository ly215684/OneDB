import { useEffect } from 'react';
import { useThemeStore } from './stores/themeStore';
import { MainLayout } from './layouts/MainLayout';
import { DialogProvider } from './components/ui/Dialog';

function App() {
  const applyTheme = useThemeStore((s) => s.applyTheme);

  useEffect(() => {
    applyTheme();
  }, [applyTheme]);

  return (
    <DialogProvider>
      <MainLayout />
    </DialogProvider>
  );
}

export default App;
