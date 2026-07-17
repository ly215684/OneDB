import { useState, useEffect, useRef, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import { useTabStore } from '../../stores/tabStore';
import { Modal } from './Modal';
import { Search, Table, Database, FileText, ArrowRight } from 'lucide-react';
import { clsx } from 'clsx';

interface GlobalSearchProps {
  open: boolean;
  onClose: () => void;
}

interface SearchResult {
  id: string;
  type: 'connection' | 'table' | 'view' | 'function';
  label: string;
  sublabel: string;
  connectionId?: string;
  tableName?: string;
}

// Mock objects for search
const MOCK_OBJECTS: { name: string; type: 'table' | 'view' | 'function'; connName: string; connId: string }[] = [];

export function GlobalSearch({ open, onClose }: GlobalSearchProps) {
  const { t } = useTranslation();
  const connections = useConnectionStore((s) => s.connections);
  const addTab = useTabStore((s) => s.addTab);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const results: SearchResult[] = useCallback(() => {
    const q = query.toLowerCase();
    const items: SearchResult[] = [];

    // Search connections
    connections.forEach((conn) => {
      if (conn.name.toLowerCase().includes(q)) {
        items.push({
          id: `conn-${conn.id}`,
          type: 'connection',
          label: conn.name,
          sublabel: conn.type.toUpperCase(),
          connectionId: conn.id,
        });
      }
    });

    // Search mock objects
    MOCK_OBJECTS.forEach((obj) => {
      if (obj.name.toLowerCase().includes(q)) {
        items.push({
          id: `obj-${obj.connId}-${obj.name}`,
          type: obj.type,
          label: obj.name,
          sublabel: `${obj.connName} › ${obj.type}`,
          connectionId: obj.connId,
          tableName: obj.type === 'table' ? obj.name : undefined,
        });
      }
    });

    // Search real databases and tables from connections
    connections.forEach((conn) => {
      (conn.databases || []).forEach((db) => {
        if (db.name.toLowerCase().includes(q)) {
          items.push({
            id: `db-${conn.id}-${db.name}`,
            type: 'connection',
            label: db.name,
            sublabel: `${conn.name} › database`,
            connectionId: conn.id,
          });
        }
        (db.tables || []).forEach((tbl) => {
          if (tbl.name.toLowerCase().includes(q)) {
            items.push({
              id: `tbl-${conn.id}-${db.name}-${tbl.name}`,
              type: 'table',
              label: tbl.name,
              sublabel: `${conn.name} › ${db.name} › table`,
              connectionId: conn.id,
              tableName: tbl.name,
            });
          }
        });
        (db.collections || []).forEach((col) => {
          if (col.name.toLowerCase().includes(q)) {
            items.push({
              id: `col-${conn.id}-${db.name}-${col.name}`,
              type: 'table',
              label: col.name,
              sublabel: `${conn.name} › ${db.name} › collection`,
              connectionId: conn.id,
              tableName: col.name,
            });
          }
        });
        (db.views || []).forEach((v) => {
          if (v.name.toLowerCase().includes(q)) {
            items.push({
              id: `view-${conn.id}-${db.name}-${v.name}`,
              type: 'view',
              label: v.name,
              sublabel: `${conn.name} › ${db.name} › view`,
              connectionId: conn.id,
            });
          }
        });
      });
    });

    return items;
  }, [query, connections])();

  const handleSelect = (result: SearchResult) => {
    if (result.type === 'connection') {
      // Open connection or focus on it
      addTab({ type: 'sql-editor', title: result.label, connectionId: result.connectionId, data: { sql: '' } });
    } else if (result.type === 'table' && result.tableName) {
      addTab({ type: 'table-data', title: result.tableName, connectionId: result.connectionId, table: result.tableName, data: {} });
    } else {
      addTab({ type: 'sql-editor', title: result.label, connectionId: result.connectionId, data: { sql: '' } });
    }
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter' && results[selectedIndex]) {
      handleSelect(results[selectedIndex]);
    }
  };

  const getIcon = (type: SearchResult['type']) => {
    switch (type) {
      case 'connection': return <Database size={14} className="text-blue-500" />;
      case 'table': return <Table size={14} className="text-green-500" />;
      case 'view': return <Table size={14} className="text-purple-500" />;
      case 'function': return <FileText size={14} className="text-orange-500" />;
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="" width="max-w-lg">
      <div className="p-0">
        {/* Search Input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={16} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            onKeyDown={handleKeyDown}
            placeholder={t('toolbar.search') + '...'}
            className="flex-1 text-sm bg-transparent border-none outline-none text-foreground placeholder:text-muted-foreground"
          />
        </div>

        {/* Results */}
        <div className="max-h-80 overflow-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {t('common.noData')}
            </div>
          ) : (
            results.map((result, idx) => (
              <div
                key={result.id}
                className={clsx(
                  'flex items-center gap-3 px-4 py-2 cursor-pointer transition-colors',
                  idx === selectedIndex ? 'bg-hover' : 'hover:bg-hover/50'
                )}
                onClick={() => handleSelect(result)}
                onMouseEnter={() => setSelectedIndex(idx)}
              >
                {getIcon(result.type)}
                <div className="flex-1 min-w-0">
                  <div className="text-sm truncate">{result.label}</div>
                  <div className="text-2xs text-muted-foreground">{result.sublabel}</div>
                </div>
                <ArrowRight size={12} className="text-muted-foreground" />
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-4 px-4 py-2 border-t border-border text-2xs text-muted-foreground">
          <span>↑↓ {t('common.search')}</span>
          <span>↵ {t('common.confirm')}</span>
          <span>Esc {t('common.cancel')}</span>
        </div>
      </div>
    </Modal>
  );
}
