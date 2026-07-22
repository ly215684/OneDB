import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useThemeStore } from '../stores/themeStore';
import { useTabStore } from '../stores/tabStore';
import { useAIStore } from '../stores/aiStore';
import { useSettingsStore } from '../stores/settingsStore';
import { ConnectionDialog } from '../components/connection/ConnectionDialog';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { GlobalSearch } from '../components/ui/GlobalSearch';
import { DataTransferDialog } from '../components/ui/DataTransferDialog';
import { DriverManagerDialog } from '../components/ui/DriverManagerDialog';
import {
  Plus,
  FileText,
  ArrowLeftRight,
  Puzzle,
  MoreHorizontal,
  PanelLeftClose,
  PanelLeftOpen,
  Sun,
  Moon,
  Monitor,
  Languages,
  Settings,
  Search,
  Bot,
} from 'lucide-react';
import { IconButton } from '../components/ui/IconButton';
import { HoverTooltip } from '../components/ui/Tooltip';
import { DropdownMenu } from '../components/ui/DropdownMenu';

interface ToolbarProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

export function Toolbar({ onToggleSidebar, sidebarCollapsed }: ToolbarProps) {
  const { t, i18n } = useTranslation();
  const { mode, setMode } = useThemeStore();
  const addTab = useTabStore((s) => s.addTab);
  const aiVisible = useAIStore((s) => s.isVisible);
  const toggleAI = useAIStore((s) => s.toggleVisible);
  const aiEnabled = useSettingsStore((s) => s.ai.enabled);
  const [connDialogOpen, setConnDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [transferOpen, setTransferOpen] = useState(false);
  const [driverOpen, setDriverOpen] = useState(false);

  // Ctrl+K for global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const getActiveTab = useTabStore((s) => s.getActiveTab);

  const handleNewQuery = () => {
    // Inherit connection context from active tab
    const activeTab = getActiveTab();
    addTab({
      type: 'sql-editor',
      title: t('toolbar.newQuery'),
      connectionId: activeTab?.connectionId,
      database: activeTab?.database,
      data: { sql: '' },
    });
  };

  const themeItems = [
    { label: t('settings.light'), icon: <Sun size={14} />, onClick: () => setMode('light') },
    { label: t('settings.dark'), icon: <Moon size={14} />, onClick: () => setMode('dark') },
    { label: t('settings.system'), icon: <Monitor size={14} />, onClick: () => setMode('system') },
  ];

  const langItems = [
    { label: t('settings.chinese'), onClick: () => i18n.changeLanguage('zh') },
    { label: t('settings.english'), onClick: () => i18n.changeLanguage('en') },
  ];

  return (
    <div className="h-10 flex items-center justify-between px-2 bg-toolbar border-b border-toolbar-border select-none flex-shrink-0">
      {/* Left Section */}
      <div className="flex items-center gap-1">
        <HoverTooltip content={sidebarCollapsed ? t('toolbar.expandSidebar') : t('toolbar.collapseSidebar')} position="bottom">
          <IconButton
            icon={sidebarCollapsed ? PanelLeftOpen : PanelLeftClose}
            size={16}
            onClick={onToggleSidebar}
            label={sidebarCollapsed ? t('toolbar.expandSidebar') : t('toolbar.collapseSidebar')}
          />
        </HoverTooltip>

        <div className="w-px h-5 bg-border mx-1" />

        <HoverTooltip content={t('toolbar.newConnection')} position="bottom">
          <IconButton icon={Plus} size={16} onClick={() => setConnDialogOpen(true)} label={t('toolbar.newConnection')} />
        </HoverTooltip>

        <HoverTooltip content={t('toolbar.newQuery')} position="bottom">
          <IconButton icon={FileText} size={16} onClick={handleNewQuery} label={t('toolbar.newQuery')} />
        </HoverTooltip>

        <HoverTooltip content={t('toolbar.dataTransfer')} position="bottom">
          <IconButton icon={ArrowLeftRight} size={16} onClick={() => setTransferOpen(true)} label={t('toolbar.dataTransfer')} />
        </HoverTooltip>

        <HoverTooltip content={t('toolbar.driverManager')} position="bottom">
          <IconButton icon={Puzzle} size={16} onClick={() => setDriverOpen(true)} label={t('toolbar.driverManager')} />
        </HoverTooltip>

        <DropdownMenu
          items={[
            { label: 'Option 1' },
            { label: 'Option 2' },
          ]}
          trigger={
            <HoverTooltip content={t('toolbar.more')} position="bottom">
              <IconButton icon={MoreHorizontal} size={16} label={t('toolbar.more')} />
            </HoverTooltip>
          }
        />
      </div>

      {/* Center - Connection Info */}
      <div className="flex-1 flex items-center justify-center">
        <span className="text-xs text-muted-foreground">OneDB - Database Workbench</span>
      </div>

      {/* Right Section */}
      <div className="flex items-center gap-1">
        <HoverTooltip content={`${t('toolbar.search')} (Ctrl+K)`} position="bottom">
          <IconButton icon={Search} size={16} onClick={() => setSearchOpen(true)} label={t('toolbar.search')} />
        </HoverTooltip>

        <DropdownMenu
          items={themeItems}
          trigger={
            <HoverTooltip content={t('toolbar.theme')} position="bottom">
              <IconButton
                icon={mode === 'dark' ? Moon : mode === 'light' ? Sun : Monitor}
                size={16}
                label={t('toolbar.theme')}
              />
            </HoverTooltip>
          }
        />

        <DropdownMenu
          items={langItems}
          trigger={
            <HoverTooltip content={t('toolbar.language')} position="bottom">
              <IconButton icon={Languages} size={16} label={t('toolbar.language')} />
            </HoverTooltip>
          }
        />

        <HoverTooltip content={t('toolbar.settings')} position="bottom">
          <IconButton icon={Settings} size={16} onClick={() => setSettingsOpen(true)} label={t('toolbar.settings')} />
        </HoverTooltip>

        {aiEnabled && (
          <>
            <div className="w-px h-5 bg-border mx-0.5" />

            <HoverTooltip content={aiVisible ? t('toolbar.hideAI') : t('toolbar.showAI')} position="bottom">
              <IconButton
                icon={Bot}
                size={16}
                variant={aiVisible ? 'active' : 'ghost'}
                onClick={toggleAI}
                label={t('toolbar.ai')}
              />
            </HoverTooltip>
          </>
        )}
      </div>

      {/* Connection Dialog */}
      <ConnectionDialog open={connDialogOpen} onClose={() => setConnDialogOpen(false)} />

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Global Search */}
      <GlobalSearch open={searchOpen} onClose={() => setSearchOpen(false)} />

      {/* Data Transfer */}
      <DataTransferDialog open={transferOpen} onClose={() => setTransferOpen(false)} />

      {/* Driver Manager */}
      <DriverManagerDialog open={driverOpen} onClose={() => setDriverOpen(false)} />
    </div>
  );
}
