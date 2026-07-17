import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { CodeMirrorEditor } from './CodeMirrorEditor';
import { ResultPanel } from './ResultPanel';
import { useQueryHistoryStore } from '../../stores/queryHistoryStore';
import { useConnectionStore } from '../../stores/connectionStore';
import type { QueryResult } from '../../types/connection';
import { executeQuery } from '../../services/connectionService';
import { Play, PlaySquare, Eraser, Clock, ArrowDownToLine } from 'lucide-react';
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

export function SQLEditor({ tabId: _tabId, connectionId, database, initialSql = '' }: SQLEditorProps) {
  const { t } = useTranslation();
  const [sql, setSql] = useState(initialSql);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const addHistory = useQueryHistoryStore((s) => s.addHistory);
  const history = useQueryHistoryStore((s) => s.history);
  const getConnection = useConnectionStore((s) => s.getConnection);

  const handleExecute = useCallback(async (sqlText: string, _selectedOnly: boolean) => {
    if (!sqlText.trim()) return;
    setIsExecuting(true);
    setResult(null);
    try {
      const conn = connectionId ? getConnection(connectionId) : undefined;
      if (!conn) {
        setResult({ columns: [], rows: [], rowCount: 0, duration: 0, success: false, error: 'No active connection.' });
        setIsExecuting(false);
        return;
      }
      const queryResult = await executeQuery(conn.type, conn.config, sqlText, database);
      setResult(queryResult);
      if (connectionId) {
        addHistory({ sql: sqlText, connectionId, result: queryResult, duration: queryResult.duration });
      }
    } catch (error) {
      setResult({ columns: [], rows: [], rowCount: 0, duration: 0, success: false, error: String(error) });
    } finally {
      setIsExecuting(false);
    }
  }, [connectionId, database, addHistory, getConnection]);

  const handleClear = () => { setSql(''); setResult(null); };
  const handleExport = (format: 'csv' | 'json' | 'sql-insert') => { if (result) exportToFile(result, format, 'query_result'); };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-1 px-2 py-1.5 border-b border-border bg-toolbar">
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
          <CodeMirrorEditor value={sql} onChange={setSql} onExecute={handleExecute} />
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
