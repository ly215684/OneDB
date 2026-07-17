import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { QueryResult } from '../../types/connection';
import { Tabs } from '../ui/Tabs';
import { ScrollArea } from '../ui/ScrollArea';
import { Badge } from '../ui/Badge';
import { CheckCircle, XCircle, Loader2, Table2, MessageSquare, BarChart3 } from 'lucide-react';
import { clsx } from 'clsx';

interface ResultPanelProps {
  result: QueryResult | null;
  isExecuting: boolean;
}

export function ResultPanel({ result, isExecuting }: ResultPanelProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState('results');

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

  if (!result) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-sm text-muted-foreground">{t('editor.noResults')}</p>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Execution Summary */}
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

      {/* Tab Content */}
      <div className="flex-1 min-h-0 overflow-auto">
        {activeTab === 'results' && <ResultTable result={result} />}
        {activeTab === 'messages' && (
          <div className="p-3">
            <pre className="text-xs font-mono text-foreground whitespace-pre-wrap">
              {result.success ? 'Query executed successfully.' : result.error}
            </pre>
          </div>
        )}
        {activeTab === 'plan' && (
          <div className="p-3">
            <p className="text-xs text-muted-foreground">Execution plan not available for mock queries.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultTable({ result }: { result: QueryResult }) {
  return (
    <ScrollArea className="h-full">
      <table className="w-full text-xs border-collapse">
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
