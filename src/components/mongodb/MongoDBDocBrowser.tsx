import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import { executeQuery } from '../../services/connectionService';
import { Button } from '../ui/Button';
import { CodeMirrorEditor } from '../editor/CodeMirrorEditor';
import { RefreshCw, Play, ChevronLeft, ChevronRight, Copy, Eye } from 'lucide-react';

interface MongoDBDocBrowserProps {
  collectionName: string;
  connectionId?: string;
  database?: string;
}

export function MongoDBDocBrowser({ collectionName, connectionId, database }: MongoDBDocBrowserProps) {
  const { t } = useTranslation();
  const getConnection = useConnectionStore((s) => s.getConnection);
  const conn = connectionId ? getConnection(connectionId) : undefined;

  const [filter, setFilter] = useState('{}');
  const [documents, setDocuments] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'json' | 'table'>('json');
  const [selectedDoc, setSelectedDoc] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const pageSizeOptions = [10, 20, 50, 100, 200];

  const fetchDocuments = useCallback(async () => {
    if (!conn) {
      setError('No active connection');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let filterObj: Record<string, unknown> = {};
      try {
        filterObj = JSON.parse(filter);
      } catch {
        setError('Invalid JSON filter');
        setLoading(false);
        return;
      }
      const query = JSON.stringify({
        collection: collectionName,
        filter: filterObj,
        limit: pageSize,
        skip: (page - 1) * pageSize,
      });
      const result = await executeQuery(conn.type, conn.config, query, database);
      if (result.success) {
        setDocuments(result.rows);
      } else {
        setError(result.error || 'Query failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [conn, collectionName, database, filter, page, pageSize]);

  useEffect(() => {
    fetchDocuments();
  }, [collectionName, connectionId, database]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (error && documents.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchDocuments}>
          <RefreshCw size={14} className="mr-1" />{t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-toolbar flex-shrink-0">
        <Button variant="default" size="sm" className="h-7 gap-1.5" onClick={fetchDocuments} disabled={loading}>
          <Play size={12} />{t('mongodb.query', 'Query')}
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchDocuments} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
        <div className="w-px h-5 bg-border" />
        <Button
          variant={viewMode === 'json' ? 'default' : 'ghost'}
          size="sm"
          className="h-7"
          onClick={() => setViewMode('json')}
        >
          JSON
        </Button>
        <Button
          variant={viewMode === 'table' ? 'default' : 'ghost'}
          size="sm"
          className="h-7"
          onClick={() => setViewMode('table')}
        >
          <Eye size={12} />
        </Button>
        <div className="flex-1" />
        <span className="text-2xs text-muted-foreground">{documents.length} {t('mongodb.documents', 'documents')}</span>
      </div>

      {/* Filter editor */}
      <div className="h-24 border-b border-border flex-shrink-0">
        <CodeMirrorEditor value={filter} onChange={setFilter} />
      </div>

      {/* Documents */}
      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : documents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('mongodb.noDocuments', 'No documents found')}
          </div>
        ) : viewMode === 'json' ? (
          <div className="p-2 space-y-2">
            {documents.map((doc, idx) => (
              <div
                key={idx}
                className="border border-border rounded-md p-3 text-xs font-mono bg-muted/20 hover:bg-muted/40 cursor-pointer relative group"
                onClick={() => setSelectedDoc(selectedDoc === idx ? null : idx)}
              >
                <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-5 w-5"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyToClipboard(JSON.stringify(doc, null, 2));
                    }}
                  >
                    <Copy size={10} />
                  </Button>
                </div>
                <pre className="whitespace-pre-wrap text-foreground/90 overflow-x-auto">
                  {selectedDoc === idx
                    ? JSON.stringify(doc, null, 2)
                    : JSON.stringify(doc)}
                </pre>
              </div>
            ))}
          </div>
        ) : (
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                {(() => {
                  const allKeys = new Set<string>();
                  documents.forEach((doc) => Object.keys(doc).forEach((k) => allKeys.add(k)));
                  return [...allKeys].map((key) => (
                    <th key={key} className="px-3 py-2 text-left font-medium whitespace-nowrap">{key}</th>
                  ));
                })()}
              </tr>
            </thead>
            <tbody>
              {documents.map((doc, idx) => {
                const allKeys = new Set<string>();
                documents.forEach((d) => Object.keys(d).forEach((k) => allKeys.add(k)));
                return (
                  <tr key={idx} className="border-b border-border/50 hover:bg-hover/50">
                    {[...allKeys].map((key) => (
                      <td key={key} className="px-3 py-1.5 whitespace-nowrap max-w-[200px] truncate">
                        {doc[key] === null || doc[key] === undefined
                          ? <span className="text-muted-foreground italic">null</span>
                          : typeof doc[key] === 'object'
                            ? <span className="font-mono text-2xs">{JSON.stringify(doc[key])}</span>
                            : String(doc[key])}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-border bg-toolbar flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground">{t('table.page', 'Page')} {page}</span>
          <span className="text-2xs text-muted-foreground">|</span>
          <div className="flex items-center gap-1">
            <span className="text-2xs text-muted-foreground">{t('table.perPage')}:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="h-5 text-2xs px-1 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
            <ChevronLeft size={12} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setPage((p) => p + 1)} disabled={documents.length < pageSize}>
            <ChevronRight size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
