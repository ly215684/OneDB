import { create } from 'zustand';
import type { Tab, TabType } from '../types/tab';

interface TabState {
  tabs: Tab[];
  activeTabId: string | null;
  addTab: (tab: Omit<Tab, 'id' | 'isActive'>) => string;
  removeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  updateTab: (id: string, updates: Partial<Tab>) => void;
  closeOtherTabs: (id: string) => void;
  closeAllTabs: () => void;
  closeTabsToRight: (id: string) => void;
  getActiveTab: () => Tab | undefined;
}

function generateTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

const TAB_ICONS: Record<TabType, string> = {
  'sql-editor': '📝',
  'table-data': '📊',
  'table-structure': '🏗️',
  'er-diagram': '🔗',
  'mongodb-docs': '🍃',
  'welcome': '🏠',
};

export const useTabStore = create<TabState>()((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tabData) => {
    const id = generateTabId();
    const tab: Tab = {
      ...tabData,
      id,
      icon: tabData.icon || TAB_ICONS[tabData.type],
      isActive: true,
    };
    set((state) => ({
      tabs: [
        ...state.tabs.map((t) => ({ ...t, isActive: false })),
        tab,
      ],
      activeTabId: id,
    }));
    return id;
  },

  removeTab: (id) => {
    const { tabs, activeTabId } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.filter((t) => t.id !== id);

    let newActiveId = activeTabId;
    if (activeTabId === id) {
      if (newTabs.length === 0) {
        newActiveId = null;
      } else if (idx >= newTabs.length) {
        newActiveId = newTabs[newTabs.length - 1].id;
      } else {
        newActiveId = newTabs[idx].id;
      }
    }

    set({
      tabs: newTabs.map((t) => ({ ...t, isActive: t.id === newActiveId })),
      activeTabId: newActiveId,
    });
  },

  setActiveTab: (id) => {
    set((state) => ({
      tabs: state.tabs.map((t) => ({ ...t, isActive: t.id === id })),
      activeTabId: id,
    }));
  },

  updateTab: (id, updates) => {
    set((state) => ({
      tabs: state.tabs.map((t) => (t.id === id ? { ...t, ...updates } : t)),
    }));
  },

  closeOtherTabs: (id) => {
    set((state) => ({
      tabs: state.tabs.filter((t) => t.id === id).map((t) => ({ ...t, isActive: true })),
      activeTabId: id,
    }));
  },

  closeAllTabs: () => {
    set({ tabs: [], activeTabId: null });
  },

  closeTabsToRight: (id) => {
    const { tabs } = get();
    const idx = tabs.findIndex((t) => t.id === id);
    const newTabs = tabs.slice(0, idx + 1);
    const activeInNew = newTabs.some((t) => t.id === get().activeTabId);
    set({
      tabs: newTabs.map((t) => ({ ...t, isActive: activeInNew ? t.isActive : t.id === id })),
      activeTabId: activeInNew ? get().activeTabId : id,
    });
  },

  getActiveTab: () => get().tabs.find((t) => t.id === get().activeTabId),
}));
