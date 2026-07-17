import { useEffect } from 'react';
import { useTabStore } from '../stores/tabStore';
import { useTranslation } from 'react-i18next';

export function useShortcuts() {
  const { t } = useTranslation();
  const addTab = useTabStore((s) => s.addTab);
  const removeTab = useTabStore((s) => s.removeTab);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const getActiveTab = useTabStore((s) => s.getActiveTab);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl/Cmd + N: New Query
      if (ctrlOrCmd && e.key === 'n') {
        e.preventDefault();
        addTab({
          type: 'sql-editor',
          title: t('toolbar.newQuery'),
          connectionId: getActiveTab()?.connectionId,
          database: getActiveTab()?.database,
          data: { sql: '' },
        });
      }

      // Ctrl/Cmd + W: Close Tab
      if (ctrlOrCmd && e.key === 'w') {
        e.preventDefault();
        if (activeTabId) {
          removeTab(activeTabId);
        }
      }

      // Ctrl/Cmd + Shift + T: Reopen last tab (placeholder)
      if (ctrlOrCmd && e.shiftKey && e.key === 'T') {
        e.preventDefault();
        // TODO: Implement reopen last tab
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addTab, removeTab, activeTabId, t]);
}
