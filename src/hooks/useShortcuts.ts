import { useEffect } from 'react';
import { useTabStore } from '../stores/tabStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useAIStore } from '../stores/aiStore';
import { useTranslation } from 'react-i18next';

/**
 * Parse a shortcut string like "Ctrl+Shift+T" into its components.
 */
function parseShortcut(shortcut: string) {
  const parts = shortcut.split('+');
  return {
    ctrl: parts.includes('Ctrl') || parts.includes('Cmd'),
    shift: parts.includes('Shift'),
    alt: parts.includes('Alt'),
    key: parts.filter((p) => !['Ctrl', 'Cmd', 'Shift', 'Alt'].includes(p))[0] || '',
  };
}

/**
 * Check if a keyboard event matches a shortcut string.
 */
function matchShortcut(e: KeyboardEvent, shortcut: string): boolean {
  const { ctrl, shift, alt, key } = parseShortcut(shortcut);
  const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
  const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;

  if (ctrl && !ctrlOrCmd) return false;
  if (!ctrl && ctrlOrCmd) return false;
  if (shift && !e.shiftKey) return false;
  if (!shift && e.shiftKey) return false;
  if (alt && !e.altKey) return false;
  if (!alt && e.altKey) return false;

  // Case-insensitive key comparison
  return e.key.toLowerCase() === key.toLowerCase();
}

export function useShortcuts() {
  const { t } = useTranslation();
  const addTab = useTabStore((s) => s.addTab);
  const removeTab = useTabStore((s) => s.removeTab);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const getActiveTab = useTabStore((s) => s.getActiveTab);
  const shortcuts = useSettingsStore((s) => s.shortcuts);
  const aiEnabled = useSettingsStore((s) => s.ai.enabled);
  const toggleAI = useAIStore((s) => s.toggleVisible);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // New Query
      if (matchShortcut(e, shortcuts.newQuery)) {
        e.preventDefault();
        addTab({
          type: 'sql-editor',
          title: t('toolbar.newQuery'),
          connectionId: getActiveTab()?.connectionId,
          database: getActiveTab()?.database,
          data: { sql: '' },
        });
        return;
      }

      // Close Tab
      if (matchShortcut(e, shortcuts.closeTab)) {
        e.preventDefault();
        if (activeTabId) {
          removeTab(activeTabId);
        }
        return;
      }

      // Reopen Tab (placeholder)
      if (matchShortcut(e, shortcuts.reopenTab)) {
        e.preventDefault();
        // TODO: Implement reopen last tab
        return;
      }

      // Toggle AI Panel (only when AI is enabled)
      if (matchShortcut(e, shortcuts.toggleAI)) {
        e.preventDefault();
        if (aiEnabled) {
          toggleAI();
        }
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [addTab, removeTab, activeTabId, t, shortcuts, aiEnabled, toggleAI, getActiveTab]);
}
