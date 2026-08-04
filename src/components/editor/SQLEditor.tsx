import { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { CodeMirrorEditor, type EditorApi } from './CodeMirrorEditor';
import { ResultPanel } from './ResultPanel';
import { useQueryHistoryStore } from '../../stores/queryHistoryStore';
import { useConnectionStore } from '../../stores/connectionStore';
import { useTabStore } from '../../stores/tabStore';
import type { QueryResult } from '../../types/connection';
import { executeQuery, listDatabases } from '../../services/connectionService';
import { Play, PlaySquare, Eraser, Clock, ArrowDownToLine, Database, ChevronDown, Server, Wand2, FileSearch } from 'lucide-react';
import { Button } from '../ui/Button';
import { Tooltip } from '../ui/Tooltip';
import { DropdownMenu } from '../ui/DropdownMenu';
import { useMessage } from '../ui/Message';
import { exportToFile, type ExportFormat } from '../../services/exportService';
import { splitSqlStatements } from '../../utils/sqlSplitter';
import { formatSql } from '../../utils/sqlFormatter';
import { useSettingsStore } from '../../stores/settingsStore';

interface SQLEditorProps {
  tabId: string;
  connectionId?: string;
  database?: string;
  initialSql?: string;
}

export function SQLEditor({ tabId, connectionId, database: initialDatabase, initialSql = '' }: SQLEditorProps) {
  const { t } = useTranslation();
  const executeSqlShortcut = useSettingsStore((s) => s.shortcuts.executeSql);
  const formatSqlShortcut = useSettingsStore((s) => s.shortcuts.formatSql);
  const msg = useMessage();
  const editorApi = useRef<EditorApi | null>(null);
  const [sql, setSql] = useState(initialSql);
  const [results, setResults] = useState<QueryResult[]>([]);
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
    setResults([]);
    try {
      const conn = activeConnId ? getConnection(activeConnId) : undefined;
      if (!conn) {
        setResults([{ columns: [], rows: [], rowCount: 0, duration: 0, success: false, error: 'No active connection.' }]);
        setIsExecuting(false);
        return;
      }

      const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
      const isRedis = conn.type === 'redis';

      // For Redis, treat entire text as a single statement
      if (isRedis) {
        const queryResult = await executeQuery(conn.type, conn.config, sqlText, selectedDb || undefined, conn.readOnly);
        setResults([queryResult]);
        if (activeConnId) {
          addHistory({ sql: sqlText, connectionId: activeConnId, result: queryResult, duration: queryResult.duration });
        }
        setIsExecuting(false);
        return;
      }

      // For MongoDB, support single object or array of operations
      if (isMongo) {
        let parsed: unknown;
        try {
          parsed = JSON.parse(sqlText.trim());
        } catch {
          setResults([{
            columns: [], rows: [], rowCount: 0, duration: 0, success: false,
            error: t('editor.mongoJsonFormat'),
          }]);
          setIsExecuting(false);
          return;
        }

        // If array, execute each operation individually
        const operations: string[] = Array.isArray(parsed)
          ? (parsed as unknown[]).map(op => JSON.stringify(op))
          : [sqlText.trim()];

        const allResults: QueryResult[] = [];
        for (const op of operations) {
          const queryResult = await executeQuery(conn.type, conn.config, op, selectedDb || undefined, conn.readOnly);
          allResults.push(queryResult);
          if (activeConnId) {
            addHistory({ sql: op, connectionId: activeConnId, result: queryResult, duration: queryResult.duration });
          }
          // Stop on first error
          if (!queryResult.success) break;
        }
        setResults(allResults);
        setIsExecuting(false);
        return;
      }

      // For SQL databases: split into individual statements
      const statements = splitSqlStatements(sqlText);

      if (statements.length === 0) {
        setIsExecuting(false);
        return;
      }

      const allResults: QueryResult[] = [];
      for (const stmt of statements) {
        const queryResult = await executeQuery(conn.type, conn.config, stmt, selectedDb || undefined, conn.readOnly);
        allResults.push(queryResult);
        if (activeConnId) {
          addHistory({ sql: stmt, connectionId: activeConnId, result: queryResult, duration: queryResult.duration });
        }
        // Stop on first error
        if (!queryResult.success) break;
      }
      setResults(allResults);
    } catch (error) {
      setResults([{ columns: [], rows: [], rowCount: 0, duration: 0, success: false, error: String(error) }]);
    } finally {
      setIsExecuting(false);
    }
  }, [activeConnId, selectedDb, addHistory, getConnection, t]);

  const handleClear = () => { setSql(''); setResults([]); };

  // Execute only the selected text (falls back to whole editor if nothing selected)
  const handleExecuteSelected = useCallback(() => {
    const api = editorApi.current;
    const selected = api?.hasSelection() ? api.getSelectedText() : '';
    if (!selected.trim()) {
      msg.info(t('editor.noSelection'));
      return;
    }
    handleExecute(selected, true);
  }, [handleExecute, msg, t]);

  // Format SQL: format the selection if any, otherwise the whole editor
  const handleFormat = useCallback(() => {
    const api = editorApi.current;
    if (!api) return;
    if (api.hasSelection()) {
      const formatted = formatSql(api.getSelectedText());
      api.replaceSelection(formatted);
      setSql(api.getText());
    } else {
      const formatted = formatSql(api.getText());
      api.replaceText(formatted);
      setSql(formatted);
    }
  }, []);

  // EXPLAIN the current selection (or the first statement)
  const handleExplain = useCallback(() => {
    const api = editorApi.current;
    const text = api?.hasSelection() ? api.getSelectedText() : sql;
    const trimmed = text.trim().replace(/;\s*$/, '');
    if (!trimmed) return;
    const conn = activeConnId ? getConnection(activeConnId) : undefined;
    if (!conn) {
      msg.error(t('editor.noConnection'));
      return;
    }
    if (conn.type === 'redis' || conn.type === 'mongodb' || conn.type === 'mongodb_srv') {
      msg.info(t('editor.explainUnsupported'));
      return;
    }
    const firstStmt = splitSqlStatements(trimmed)[0] || trimmed;
    const explainSql = /^\s*explain\b/i.test(firstStmt) ? firstStmt : `EXPLAIN ${firstStmt}`;
    handleExecute(explainSql, false);
  }, [sql, activeConnId, getConnection, handleExecute, msg, t]);

  const handleExport = (format: ExportFormat) => {
    // Export the last successful result
    const lastSuccess = [...results].reverse().find(r => r.success);
    if (lastSuccess) exportToFile(lastSuccess, format, 'query_result');
  };

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
        <Tooltip content={`${t('editor.execute')} (${executeSqlShortcut})`}>
          <Button variant="default" size="sm" className="h-7 gap-1.5" onClick={() => handleExecute(sql, false)}>
            <Play size={12} />{t('editor.execute')}
          </Button>
        </Tooltip>
        <Tooltip content={t('editor.executeSelected')}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExecuteSelected}><PlaySquare size={14} /></Button>
        </Tooltip>
        <Tooltip content={`${t('editor.format')} (${formatSqlShortcut})`}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleFormat}><Wand2 size={14} /></Button>
        </Tooltip>
        <Tooltip content={t('editor.explain')}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleExplain}><FileSearch size={14} /></Button>
        </Tooltip>
        <div className="w-px h-5 bg-border mx-1" />
        <Tooltip content={t('editor.clear')}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleClear}><Eraser size={14} /></Button>
        </Tooltip>
        <Tooltip content={t('editor.history')}>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowHistory(!showHistory)}><Clock size={14} /></Button>
        </Tooltip>
        <div className="flex-1" />
        {results.length > 0 && (
          <DropdownMenu
            items={[
              { label: t('table.exportCsv'), onClick: () => handleExport('csv') },
              { label: t('table.exportJson'), onClick: () => handleExport('json') },
              { label: t('table.exportSql'), onClick: () => handleExport('sql-insert') },
              { label: t('table.exportXlsx'), onClick: () => handleExport('xlsx') },
            ]}
            trigger={<Tooltip content={t('editor.export')}><Button variant="ghost" size="icon" className="h-7 w-7"><ArrowDownToLine size={14} /></Button></Tooltip>}
          />
        )}
      </div>
      <div className="flex-1 min-h-0 flex" style={{ flex: showHistory ? '2 1 0%' : '1 1 0%' }}>
        <div className="flex-1">
          <CodeMirrorEditor value={sql} onChange={setSql} onExecute={handleExecute} onFormat={handleFormat} apiRef={editorApi} placeholder={editorPlaceholder} isMongo={isMongo} />
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
        <ResultPanel results={results} isExecuting={isExecuting} />
      </div>
    </div>
  );
}
