import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useTabStore } from '../stores/tabStore';
import { X, Database, FileText, Table, Settings, HelpCircle } from 'lucide-react';
import { clsx } from 'clsx';
import { SQLEditor } from '../components/editor/SQLEditor';
import { DataTableView } from '../components/table/DataTableView';
import { ERDiagram } from '../components/er/ERDiagram';
import { TableStructureEditor } from '../components/structure/StructureEditor';
import { MongoDBDocBrowser } from '../components/mongodb/MongoDBDocBrowser';
import { ConnectionDialog } from '../components/connection/ConnectionDialog';
import { SettingsDialog } from '../components/settings/SettingsDialog';
import { ContextMenu } from '../components/ui/DropdownMenu';
import { Button } from '../components/ui/Button';

export function Workspace() {
  const { t } = useTranslation();
  const tabs = useTabStore((s) => s.tabs);
  const activeTabId = useTabStore((s) => s.activeTabId);
  const setActiveTab = useTabStore((s) => s.setActiveTab);
  const removeTab = useTabStore((s) => s.removeTab);
  const closeOtherTabs = useTabStore((s) => s.closeOtherTabs);
  const closeAllTabs = useTabStore((s) => s.closeAllTabs);
  const closeTabsToRight = useTabStore((s) => s.closeTabsToRight);
  const addTab = useTabStore((s) => s.addTab);

  const [tabContextMenu, setTabContextMenu] = useState<{ x: number; y: number; tabId: string } | null>(null);
  const [connDialogOpen, setConnDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const handleContextMenu = (e: React.MouseEvent, tabId: string) => {
    e.preventDefault();
    setTabContextMenu({ x: e.clientX, y: e.clientY, tabId });
  };

  const getActiveTab = useTabStore((s) => s.getActiveTab);

  const handleNewQuery = () => {
    const activeTab = getActiveTab();
    addTab({
      type: 'sql-editor',
      title: t('toolbar.newQuery'),
      connectionId: activeTab?.connectionId,
      database: activeTab?.database,
      data: { sql: '' },
    });
  };

  if (tabs.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center bg-background overflow-auto p-4">
        <div className="text-center max-w-2xl flex-shrink-0">
          <Database size={64} className="mx-auto mb-6 text-muted-foreground/30" />
          <h2 className="text-2xl font-semibold text-foreground mb-2">
            {t('app.name')}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            {t('app.description')}
          </p>

          {/* Quick Actions */}
          <div className="grid grid-cols-2 gap-3 max-w-lg mx-auto">
            <Button
              variant="outline"
              className="h-12 flex items-center gap-3 px-4 justify-start"
              onClick={handleNewQuery}
            >
              <FileText size={22} className="text-blue-500 flex-shrink-0" />
              <span className="text-sm">{t('toolbar.newQuery')}</span>
            </Button>

            <Button
              variant="outline"
              className="h-12 flex items-center gap-3 px-4 justify-start"
              onClick={() => setConnDialogOpen(true)}
            >
              <Database size={22} className="text-green-500 flex-shrink-0" />
              <span className="text-sm">{t('toolbar.newConnection')}</span>
            </Button>

            <Button
              variant="outline"
              className="h-12 flex items-center gap-3 px-4 justify-start"
              onClick={() => {
                addTab({
                  type: 'er-diagram',
                  title: 'ER Diagram',
                  data: {},
                });
              }}
            >
              <Table size={22} className="text-purple-500 flex-shrink-0" />
              <span className="text-sm">ER Diagram</span>
            </Button>

            <Button
              variant="outline"
              className="h-12 flex items-center gap-3 px-4 justify-start"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings size={22} className="text-orange-500 flex-shrink-0" />
              <span className="text-sm">{t('toolbar.settings')}</span>
            </Button>
          </div>

          {/* Help */}
          <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1">
              <HelpCircle size={14} />
              <span>Ctrl+N: New Query</span>
            </div>
            <div className="flex items-center gap-1">
              <HelpCircle size={14} />
              <span>Ctrl+Enter: Execute SQL</span>
            </div>
          </div>

          {/* Dialogs */}
          <ConnectionDialog open={connDialogOpen} onClose={() => setConnDialogOpen(false)} />
          <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-background overflow-hidden">
      {/* Tab Bar */}
      <div className="flex items-center h-9 bg-muted/30 border-b border-border overflow-x-auto flex-shrink-0">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            onContextMenu={(e) => handleContextMenu(e, tab.id)}
            className={clsx(
              'flex items-center gap-1.5 px-3 h-full border-r border-border cursor-pointer select-none min-w-0 max-w-48 group',
              activeTabId === tab.id
                ? 'bg-background text-foreground border-b-2 border-b-primary'
                : 'text-muted-foreground hover:bg-hover'
            )}
          >
            <span className="text-xs flex-shrink-0">{tab.icon}</span>
            <span className="text-xs truncate flex-1">{tab.title}</span>
            {tab.isDirty && <span className="w-1.5 h-1.5 rounded-full bg-primary flex-shrink-0" />}
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeTab(tab.id);
              }}
              className="h-4 w-4 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-hover transition-opacity flex-shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={clsx('h-full', tab.id === activeTabId ? 'block' : 'hidden')}
          >
            <TabContent tab={tab} />
          </div>
        ))}
      </div>

      {/* Tab Context Menu */}
      {tabContextMenu && (
        <ContextMenu
          x={tabContextMenu.x}
          y={tabContextMenu.y}
          onClose={() => setTabContextMenu(null)}
          items={[
            {
              label: t('tabs.close'),
              onClick: () => removeTab(tabContextMenu.tabId),
            },
            {
              label: t('tabs.closeOthers'),
              onClick: () => closeOtherTabs(tabContextMenu.tabId),
            },
            {
              label: t('tabs.closeAll'),
              onClick: () => closeAllTabs(),
            },
            {
              label: t('tabs.closeToRight'),
              onClick: () => closeTabsToRight(tabContextMenu.tabId),
            },
          ]}
        />
      )}
    </div>
  );
}

function TabContent({ tab }: { tab: import('../types/tab').Tab }) {
  const { t } = useTranslation();

  switch (tab.type) {
    case 'sql-editor':
      return (
        <SQLEditor
          tabId={tab.id}
          connectionId={tab.connectionId}
          database={tab.database}
          initialSql={tab.data?.sql}
        />
      );
    case 'table-data':
      return (
        <DataTableView
          tableName={tab.table || tab.title}
          connectionId={tab.connectionId}
          database={tab.database}
        />
      );
    case 'table-structure':
      return (
        <TableStructureEditor
          tableName={tab.table || tab.title}
          connectionId={tab.connectionId}
          database={tab.database}
        />
      );
    case 'er-diagram':
      return <ERDiagram connectionId={tab.connectionId} database={tab.database} />;
    case 'mongodb-docs':
      return (
        <MongoDBDocBrowser
          collectionName={tab.table || tab.title}
          connectionId={tab.connectionId}
          database={tab.database}
        />
      );
    default:
      return (
        <div className="h-full flex items-center justify-center">
          <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
        </div>
      );
  }
}
