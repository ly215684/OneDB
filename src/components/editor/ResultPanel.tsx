import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QueryResult } from '../../types/connection';
import { useDragScroll } from '../../hooks/useDragScroll';
import { Tabs } from '../ui/Tabs';
import { ScrollArea } from '../ui/ScrollArea';
import { Badge } from '../ui/Badge';
import { CheckCircle, XCircle, Loader2, Table2, MessageSquare, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

interface ResultPanelProps {
  results: QueryResult[];
  isExecuting: boolean;
}

export function ResultPanel({ results, isExecuting }: ResultPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('results');
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const dragScrollRef = useDragScroll();

  // Reset active result index when results change
  const safeIdx = Math.min(activeResultIdx, Math.max(0, results.length - 1));

  if (isExecuting) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 size={16} className="animate-spin" />
          <span className="text-sm">{t('table.loading')}</span>
        </div>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('editor.noResults')}</p>
      </div>
    );
  }

  // Single result
  if (results.length === 1) {
    return (
      <div className="h-full flex flex-col">
        <SingleResultHeader result={results[0]} />
        <Tabs
          tabs={[
            { id: 'results', label: t('editor.results'), icon: <Table2 size={12} /> },
            { id: 'messages', label: t('editor.messages'), icon: <MessageSquare size={12} /> },
            { id: 'plan', label: t('editor.executionPlan'), icon: <BarChart3 size={12} /> },
          ]}
          activeTab={activeTab}
          onChange={setActiveTab}
        />
        <div ref={dragScrollRef} className="flex-1 min-h-0 overflow-auto cursor-grab">
          {activeTab === 'results' && <ResultTable result={results[0]} />}
          {activeTab === 'messages' && <MessagesTab result={results[0]} />}
          {activeTab === 'plan' && <PlanTab />}
        </div>
      </div>
    );
  }

  // Multiple results
  const currentResult = results[safeIdx];
  const successCount = results.filter(r => r.success).length;
  const failCount = results.length - successCount;

  return (
    <div className="h-full flex flex-col">
      {/* Multi-result summary bar */}
      <div className="flex items-center gap-2 px-3 py-1 border-b border-border bg-toolbar text-xs">
        <span className="text-muted-foreground">{results.length} {t('editor.statementsExecuted')}</span>
        <div className="w-px h-3 bg-border" />
        {successCount > 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle size={11} />{successCount}
          </span>
        )}
        {failCount > 0 && (
          <span className="flex items-center gap-1 text-destructive">
            <XCircle size={11} />{failCount}
          </span>
        )}
      </div>

      {/* Statement tabs */}
      <div className="flex items-center gap-0 border-b border-border bg-toolbar overflow-x-auto">
        {results.map((r, idx) => (
          <button
            key={idx}
            onClick={() => setActiveResultIdx(idx)}
            className={clsx(
              'px-2.5 py-1 text-xs whitespace-nowrap border-r border-border/50 flex items-center gap-1.5 transition-colors',
              safeIdx === idx
                ? 'bg-background text-foreground font-medium'
                : 'text-muted-foreground hover:bg-hover'
            )}
          >
            {r.success
              ? <CheckCircle size={10} className="text-green-500 flex-shrink-0" />
              : <XCircle size={10} className="text-destructive flex-shrink-0" />
            }
            <span>#{idx + 1}</span>
            <span className="text-2xs opacity-70">{r.duration}ms</span>
          </button>
        ))}
      </div>

      {/* Current result summary */}
      <SingleResultHeader result={currentResult} />

      {/* Tabs */}
      <Tabs
        tabs={[
          { id: 'results', label: t('editor.results'), icon: <Table2 size={12} /> },
          { id: 'messages', label: t('editor.messages'), icon: <MessageSquare size={12} /> },
          { id: 'plan', label: t('editor.executionPlan'), icon: <BarChart3 size={12} /> },
        ]}
        activeTab={activeTab}
        onChange={setActiveTab}
      />

      {/* Tab content */}
      <div ref={dragScrollRef} className="flex-1 min-h-0 overflow-auto cursor-grab">
        {activeTab === 'results' && <ResultTable result={currentResult} />}
        {activeTab === 'messages' && <MessagesTab result={currentResult} />}
        {activeTab === 'plan' && <PlanTab />}
      </div>
    </div>
  );
}

function SingleResultHeader({ result }: { result: QueryResult }) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-3 px-3 py-1.5 border-b border-border bg-toolbar">
      {result.success ? (
        <CheckCircle size={14} className="text-green-500" />
      ) : (
        <XCircle size={14} className="text-destructive" />
      )}
      <span className="text-xs text-muted-foreground">
        {result.success ? t('editor.success') : t('editor.error')}
      </span>
      <Badge variant="info">{result.rowCount} {t('editor.rows')}</Badge>
      {result.affectedRows !== undefined && (
        <Badge variant="warning">{result.affectedRows} {t('editor.affected')}</Badge>
      )}
      <Badge variant="default">{result.duration} {t('editor.ms')} {t('editor.duration')}</Badge>
    </div>
  );
}

function MessagesTab({ result }: { result: QueryResult }) {
  return (
    <div className="p-3">
      <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
        {result.success ? 'Query executed successfully.' : result.error}
      </pre>
    </div>
  );
}

function PlanTab() {
  return (
    <div className="p-3">
      <p className="text-xs text-muted-foreground">Execution plan not available for mock queries.</p>
    </div>
  );
}

function ResultTable({ result }: { result: QueryResult }) {
  return (
    <ScrollArea className="h-full">
      <table className="min-w-full text-xs border-collapse">
        <thead className="sticky top-0 bg-toolbar z-10">
          <tr>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground border-b border-r border-border w-12 text-center">
              #
            </th>
            {result.columns.map((col) => (
              <th
                key={col}
                className="px-3 py-1.5 text-left font-medium text-muted-foreground border-b border-r border-border whitespace-nowrap"
              >
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {result.rows.map((row, i) => (
            <tr
              key={i}
              className={clsx(
                'hover:bg-hover transition-colors',
                i % 2 === 0 ? 'bg-background' : 'bg-muted/30'
              )}
            >
              <td className="px-2 py-1 text-center text-muted-foreground border-r border-border text-2xs">
                {i + 1}
              </td>
              {result.columns.map((col) => (
                <td
                  key={col}
                  className="px-3 py-1 border-r border-border whitespace-nowrap max-w-64 truncate"
                  title={String(row[col] ?? '')}
                >
                  {row[col] === null ? (
                    <span className="text-muted-foreground italic">NULL</span>
                  ) : (
                    String(row[col])
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </ScrollArea>
  );
}
