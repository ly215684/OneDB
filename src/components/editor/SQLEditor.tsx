import { useState, useCallback, useMemo, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { ResultPanel } from './ResultPanel';
import { useQueryHistoryStore } from '../../stores/queryHistoryStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useTabStore } from '../../stores/tabStore';
import type { QueryResult } from '../../types/connection';
import { executeQuery, listDatabases } from '../../services/connectionService';
import { Play, PlaySquare, Eraser, Clock, ArrowDownToLine, Database, ChevronDown, Server } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { DropdownMenu } from '../ui/DropdownMenu';
import { exportToFile } from '../../services/exportService';

interface SQLEditorProps {
  tabId: string;
  connectionId?: string;
  database?: string;
  initialSql?: string;
}

export function SQLEditor({ tabId, connectionId, database: initialDatabase, initialSql = '' }: SQLEditorProps) {
  const { t } = useTranslation();
  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedDb, setSelectedDb] = useState(initialDatabase || '');
  const [selectedConnId, setSelectedConnId] = useState(connectionId || '');
  const addHistory = useQueryHistoryStore((s) => s.addHistory);
  const history = useQueryHistoryStore((s) => s.history);
  const connections = useConnectionStore((s) => s.connections);
  const getConnection = useConnectionStore((s) => s.getConnection);
  const setDatabases = useConnectionStore((s) => s.setDatabases);
  const updateTab = useTabStore((s) => s.updateTab);
  const [loadingDbs, setLoadingDbs] = useState(false);

  // Get databases list from selected connection
  const conn = selectedConnId ? getConnection(selectedConnId) : undefined;
  const databases = conn?.databases || [];

  // Use selectedConnId for execution
  const activeConnId = selectedConnId || connectionId;

  // Handle connection selection
  const handleSelectConn = useCallback((connId: string) => {
    setSelectedConnId(connId);
    setSelectedDb('');
    updateTab(tabId, { connectionId: connId, database: undefined });
  }, [tabId, updateTab]);

  // Auto-load databases if not yet loaded
  useEffect(() => {
    if (!conn || databases.length > 0 || loadingDbs) return;
    setLoadingDbs(true);
    listDatabases(conn.type, conn.config)
      .then((dbs) => setDatabases(conn.id, dbs))
      .catch((e) => console.error('Failed to load databases:', e))
      .finally(() => setLoadingDbs(false));
  }, [conn?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Check if current connection is MongoDB
  const isMongo = useMemo(() => {
    if (!activeConnId) return false;
    const conn = getConnection(activeConnId);
    return conn?.type === 'mongodb' || conn?.type === 'mongodb_srv';
  }, [activeConnId, getConnection]);

  const editorPlaceholder = isMongo ? t('editor.mongoPlaceholder') : undefined;

  // Handle database selection
  const handleSelectDb = useCallback((dbName: string) => {
    setSelectedDb(dbName);
    updateTab(tabId, { database: dbName });
  }, [tabId, updateTab]);

  const handleExecute = useCallback(async (sqlText: string, _selectedOnly: boolean) => {
    if (!sqlText.trim()) return;
    setIsExecuting(true);
    setResult(null);
    try {
      const conn = activeConnId ? getConnection(activeConnId) : undefined;
      if (!conn) {
        setResult({ columns: [], rows: [], rowCount: 0, duration: 0, success: false, error: 'No active connection.' });
        setIsExecuting(false);
        return;
      }
      // Validate MongoDB query format
      const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
      if (isMongo) {
        try {
          JSON.parse(sqlText.trim());
        } catch {
          setResult({
            columns: [], rows: [], rowCount: 0, duration: 0, success: false,
            error: t('editor.mongoJsonFormat'),
          });
          setIsExecuting(false);
          return;
        }
      }
      const queryResult = await executeQuery(conn.type, conn.config, sqlText, selectedDb || undefined);
      setResult(queryResult);
      if (activeConnId) {
        addHistory({ sql: sqlText, connectionId: activeConnId, result: queryResult, duration: queryResult.duration });
      }
    } catch (error) {
      setResult({ columns: [], rows: [], rowCount: 0, duration: 0, success: false, error: String(error) });
    } finally {
      setIsExecuting(false);
    }
  }, [activeConnId, selectedDb, addHistory, getConnection]);

  const handleClear = () => { setSql(''); setResult(null); };
  const handleExport = (format: 'csv' | 'json' | 'sql-insert') => { if (result) exportToFile(result, format, 'query_result'); };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-toolbar">
        {/* Connection selector */}
        <DropdownMenu
          align="left"
          items={connections.length > 0
            ? connections.map((c) => ({
                label: c.name,
                icon: c.isConnected ? <span className="w-1.5 h-1.5 rounded-full bg-green-500" /> : <span className="w-1.5 h-1.5 rounded-full bg-gray-400" />,
                onClick: () => handleSelectConn(c.id),
                disabled: !c.isConnected,
              }))
            : [{ label: t('editor.noConnections'), disabled: true }]
          }
          trigger={
            <Tooltip content={t('editor.selectConnection')}>
              <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs">
                <Server size={12} />
                <span className="max-w-28 truncate">{conn?.name || t('editor.selectConnection')}</span>
                <ChevronDown size={10} />
              </Button>
            </Tooltip>
          }
        />
        {/* Database selector */}
        {conn && (
          <DropdownMenu
            align="left"
            items={loadingDbs
              ? [{ label: t('editor.loadingDatabases'), disabled: true }]
              : databases.length > 0
                ? databases.map((db) => ({
                    label: db.name,
                    onClick: () => handleSelectDb(db.name),
                    disabled: db.name === selectedDb,
                  }))
                : [{ label: t('editor.noDatabases'), disabled: true }]
            }
            trigger={
              <Tooltip content={t('editor.selectDatabase')}>
                <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-xs font-mono" disabled={loadingDbs}>
                  <Database size={12} />
                  <span className="max-w-32 truncate">{selectedDb || t('editor.selectDatabase')}</span>
                  <ChevronDown size={10} />
                </Button>
              </Tooltip>
            }
          />
        )}
        <div className="w-px h-5 bg-border mx-1" />
        <Tooltip content={`${t('editor.execute')} (Ctrl+Enter)`}>
          <Button variant="default" size="sm" className="h-7 gap-1.5" onClick={() => handleExecute(sql, false)}>
            <Play size={12} />{t('editor.execute')}
          </Button>
        </Tooltip>
        <Tooltip content={t('editor.executeSelected')}>
          <Button variant="ghost" size="icon" className="h-7 w-7"><PlaySquare size={14} /></Button>
        </Tooltip>
        <div className="w-px h-5 bg-border mx-1" />
        <Tooltip content={t('editor.clear')}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}><Eraser size={14} /></Button>
        </Tooltip>
        <Tooltip content={t('editor.history')}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(!showHistory)}><Clock size={14} /></Button>
        </Tooltip>
        <div className="flex-1" />
        {result && (
          <DropdownMenu
            items={[
              { label: t('table.exportCsv'), onClick: () => handleExport('csv') },
              { label: t('table.exportJson'), onClick: () => handleExport('json') },
              { label: t('table.exportSql'), onClick: () => handleExport('sql-insert') },
            ]}
            trigger={<Tooltip content={t('editor.export')}><Button variant="ghost" size="icon" className="h-7 w-7"><ArrowDownToLine size={14} /></Button></Tooltip>}
          />
        )}
      </div>
      <div className="flex-1 min-h-0 flex" style={{ flex: showHistory ? '2 1 0%' : '1 1 0%' }}>
        <div className="flex-1">
          <CodeMirrorEditor value={sql} onChange={setSql} onExecute={handleExecute} placeholder={editorPlaceholder} isMongo={isMongo} />
        </div>
        {showHistory && (
          <div className="w-64 border-l border-border flex flex-col">
            <div className="px-2 py-1 border-b border-border flex items-center justify-between">
              <span className="text-xs font-semibold">{t('editor.history')}</span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => setShowHistory(false)}><Eraser size={10} /></Button>
            </div>
            <div className="flex-1 overflow-auto">
              {history.length === 0 ? (
                <div className="p-3 text-xs text-muted-foreground text-center">{t('editor.noResults')}</div>
              ) : (
                history.slice(0, 50).map((item) => (
                  <div key={item.id} className="px-2 py-1.5 border-b border-border/50 cursor-pointer hover:bg-hover text-xs" onClick={() => { setSql(item.sql); setShowHistory(false); }}>
                    <div className="truncate font-mono text-2xs">{item.sql}</div>
                    <div className="text-2xs text-muted-foreground mt-0.5">{item.duration}ms · {new Date(item.timestamp).toLocaleTimeString()}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
      <div className="h-1 bg-border cursor-row-resize hover:bg-primary/30 transition-colors flex-shrink-0" />
      <div className="min-h-0 overflow-hidden" style={{ flex: '1 1 0%' }}>
        <ResultPanel result={result} isExecuting={isExecuting} />
      </div>
    </div>
  );
}
