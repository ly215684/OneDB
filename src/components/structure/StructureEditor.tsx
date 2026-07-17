import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import { getTableStructure } from '../../services/connectionService';
import { Button } from '../ui/Button';
import { Tabs } from '../ui/Tabs';
import { RefreshCw, Key, Hash, Link, Plus, Trash2, Save } from 'lucide-react';

interface TableStructureEditorProps {
  tableName: string;
  connectionId?: string;
  database?: string;
}

interface ColumnInfo {
  name: string;
  type: string;
  length: number | null;
  defaultValue: string | null;
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  comment: string;
}

interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type: string;
}

interface ForeignKeyInfo {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete: string;
  onUpdate: string;
}

export function TableStructureEditor({ tableName, connectionId, database }: TableStructureEditorProps) {
  const { t } = useTranslation();
  const getConnection = useConnectionStore((s) => s.getConnection);
  const conn = connectionId ? getConnection(connectionId) : undefined;

  const [columns, setColumns] = useState<ColumnInfo[]>([]);
  const [indexes, setIndexes] = useState<IndexInfo[]>([]);
  const [foreignKeys, setForeignKeys] = useState<ForeignKeyInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('columns');

  const fetchStructure = async () => {
    if (!conn || !database) {
      setError('No connection or database selected');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await getTableStructure(conn.type, conn.config, database, tableName);
      setColumns(
        data.columns.map((c) => ({
          name: c.name,
          type: c.type,
          length: c.length,
          defaultValue: c.default_value,
          nullable: c.nullable,
          primaryKey: c.primary_key,
          autoIncrement: c.auto_increment,
          comment: c.comment,
        })),
      );
      setIndexes(
        data.indexes.map((i) => ({
          name: i.name,
          columns: i.columns,
          unique: i.unique,
          type: i.type,
        })),
      );
      setForeignKeys(
        data.foreign_keys.map((f) => ({
          name: f.name,
          columns: f.columns,
          referencedTable: f.referenced_table,
          referencedColumns: f.referenced_columns,
          onDelete: f.on_delete,
          onUpdate: f.on_update,
        })),
      );
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStructure();
  }, [tableName, connectionId, database]);

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchStructure}>
          <RefreshCw size={14} className="mr-1" />{t('common.retry')}
        </Button>
      </div>
    );
  }

  const tabDefs = [
    { id: 'columns', label: `${t('structure.columns')} (${columns.length})` },
    { id: 'indexes', label: `${t('structure.indexes')} (${indexes.length})` },
    { id: 'foreign_keys', label: `${t('structure.foreignKeys')} (${foreignKeys.length})` },
  ];

  const loadingSpinner = (
    <div className="flex items-center justify-center h-32">
      <RefreshCw size={20} className="animate-spin text-muted-foreground" />
    </div>
  );

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-toolbar flex-shrink-0">
        <span className="text-xs font-medium">{tableName}</span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchStructure} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Plus size={14} /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 size={14} /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Save size={14} /></Button>
      </div>
      <Tabs tabs={tabDefs} activeTab={activeTab} onChange={setActiveTab} />
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'columns' && (
          loading ? loadingSpinner : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">{t('structure.name')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.type')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.length')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.nullable')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.default')}</th>
                  <th className="px-3 py-2 text-left font-medium">PK</th>
                  <th className="px-3 py-2 text-left font-medium">AI</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.comment')}</th>
                </tr>
              </thead>
              <tbody>
                {columns.map((col, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-hover/50">
                    <td className="px-3 py-1.5 font-medium flex items-center gap-1.5">
                      {col.primaryKey && <Key size={10} className="text-yellow-500" />}
                      {col.name}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{col.type}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{col.length ?? '-'}</td>
                    <td className="px-3 py-1.5">{col.nullable ? '✓' : '✗'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground font-mono text-2xs">{col.defaultValue ?? '-'}</td>
                    <td className="px-3 py-1.5">{col.primaryKey ? '✓' : ''}</td>
                    <td className="px-3 py-1.5">{col.autoIncrement ? '✓' : ''}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{col.comment || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {activeTab === 'indexes' && (
          loading ? loadingSpinner : indexes.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">{t('structure.noIndexes')}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">{t('structure.name')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.columns')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.unique')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.type')}</th>
                </tr>
              </thead>
              <tbody>
                {indexes.map((idx, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-hover/50">
                    <td className="px-3 py-1.5 font-medium flex items-center gap-1.5">
                      <Hash size={10} className="text-blue-500" />
                      {idx.name}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{idx.columns.join(', ')}</td>
                    <td className="px-3 py-1.5">{idx.unique ? '✓' : '✗'}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{idx.type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
        {activeTab === 'foreign_keys' && (
          loading ? loadingSpinner : foreignKeys.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">{t('structure.noForeignKeys')}</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-muted/50 border-b border-border">
                  <th className="px-3 py-2 text-left font-medium">{t('structure.name')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.columns')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.refTable')}</th>
                  <th className="px-3 py-2 text-left font-medium">{t('structure.refColumns')}</th>
                  <th className="px-3 py-2 text-left font-medium">ON DELETE</th>
                  <th className="px-3 py-2 text-left font-medium">ON UPDATE</th>
                </tr>
              </thead>
              <tbody>
                {foreignKeys.map((fk, i) => (
                  <tr key={i} className="border-b border-border/50 hover:bg-hover/50">
                    <td className="px-3 py-1.5 font-medium flex items-center gap-1.5">
                      <Link size={10} className="text-green-500" />
                      {fk.name}
                    </td>
                    <td className="px-3 py-1.5 text-muted-foreground">{fk.columns.join(', ')}</td>
                    <td className="px-3 py-1.5">{fk.referencedTable}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{fk.referencedColumns.join(', ')}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{fk.onDelete}</td>
                    <td className="px-3 py-1.5 text-muted-foreground">{fk.onUpdate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}
      </div>
    </div>
  );
}
