import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import { executeQuery } from '../../services/connectionService';
import { exportToFile } from '../../services/exportService';
import { useDragScroll } from '../../hooks/useDragScroll';
import { Button } from '../ui/Button';
import { DropdownMenu } from '../ui/DropdownMenu';
import {
  RefreshCw,
  Plus,
  Trash2,
  Save,
  ArrowDownToLine,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Search,
} from 'lucide-react';

interface DataTableViewProps {
  tableName: string;
  connectionId?: string;
  database?: string;
}

interface RowData {
  [key: string]: unknown;
}

export function DataTableView({ tableName, connectionId, database }: DataTableViewProps) {
  const { t } = useTranslation();
  const getConnection = useConnectionStore((s) => s.getConnection);
  const conn = connectionId ? getConnection(connectionId) : undefined;
  const isNoSql = conn?.type === 'mongodb' || conn?.type === 'mongodb_srv' || conn?.type === 'redis';
  const dragScrollRef = useDragScroll();

  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  // Filtering
  const [filterText, setFilterText] = useState('');
  // Pagination
  const [pageSize, setPageSize] = useState(50);
  const pageSizeOptions = [10, 20, 50, 100, 200, 500];
  const [currentPage, setCurrentPage] = useState(1);
  // Sort
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  // Selection
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  // Editing
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);
  const [editValue, setEditValue] = useState('');

  const fetchData = useCallback(async () => {
    if (!conn) {
      setError('No active connection');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query: string;
      if (isNoSql) {
        query = JSON.stringify({ collection: tableName, filter: {} });
      } else {
        const parts = [`SELECT * FROM ${tableName}`];
        if (sortCol) parts.push(`ORDER BY ${sortCol} ${sortDir.toUpperCase()}`);
        parts.push(`LIMIT ${pageSize} OFFSET ${(currentPage - 1) * pageSize}`);
        query = parts.join(' ');
      }
      const result = await executeQuery(conn.type, conn.config, query, database);
      if (result.success) {
        setColumns(result.columns);
        setRows(result.rows);
        setDuration(result.duration);
      } else {
        setError(result.error || 'Query failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [conn, tableName, database, isNoSql, sortCol, sortDir, currentPage, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering
  const filteredRows = rows.filter((row) => {
    if (!filterText) return true;
    const lower = filterText.toLowerCase();
    return columns.some((col) => {
      const val = row[col];
      return val !== null && val !== undefined && String(val).toLowerCase().includes(lower);
    });
  });

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const handleSort = (col: string) => {
    if (sortCol === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortCol(col);
      setSortDir('asc');
    }
  };

  const toggleRowSelection = (index: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const startEdit = (rowIdx: number, col: string) => {
    setEditingCell({ row: rowIdx, col });
    setEditValue(String(pagedRows[rowIdx]?.[col] ?? ''));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    const actualIdx = (currentPage - 1) * pageSize + row;
    setRows((prev) => {
      const next = [...prev];
      if (next[actualIdx]) next[actualIdx] = { ...next[actualIdx], [col]: editValue };
      return next;
    });
    setEditingCell(null);
  };

  const handleExport = (format: 'csv' | 'json' | 'sql-insert') => {
    exportToFile(
      { columns, rows: filteredRows, rowCount: filteredRows.length, duration: 0, success: true },
      format,
      tableName,
    );
  };

  if (error) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 p-6">
        <p className="text-sm text-destructive">{error}</p>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw size={14} className="mr-1" />{t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-toolbar flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={fetchData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Plus size={14} /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Trash2 size={14} /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7"><Save size={14} /></Button>
        <div className="w-px h-5 bg-border" />
        <div className="relative flex-1 max-w-xs">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setCurrentPage(1); }}
            placeholder={t('table.filter')}
            className="h-7 pl-6 pr-2 text-xs w-full rounded border border-border bg-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <div className="flex-1" />
        <DropdownMenu
          items={[
            { label: t('table.exportCsv'), onClick: () => handleExport('csv') },
            { label: t('table.exportJson'), onClick: () => handleExport('json') },
            { label: t('table.exportSql'), onClick: () => handleExport('sql-insert') },
          ]}
          trigger={<Button variant="ghost" size="icon" className="h-7 w-7"><ArrowDownToLine size={14} /></Button>}
        />
        <span className="text-2xs text-muted-foreground">
          {filteredRows.length} {t('table.rows')} · {duration} {t('editor.ms')}
        </span>
      </div>

      {/* Table */}
      <div ref={dragScrollRef} className="flex-1 overflow-auto min-h-0 cursor-grab">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : columns.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('table.noData')}
          </div>
        ) : (
          <table className="min-w-full text-xs border-collapse">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted">
                <th className="w-8 px-2 py-1.5 border-b border-r border-border text-center">
                  <input
                    type="checkbox"
                    checked={selectedRows.size === pagedRows.length && pagedRows.length > 0}
                    onChange={() => {
                      if (selectedRows.size === pagedRows.length) setSelectedRows(new Set());
                      else setSelectedRows(new Set(pagedRows.map((_, i) => i)));
                    }}
                    className="rounded"
                  />
                </th>
                <th className="w-10 px-1 py-1.5 border-b border-r border-border text-center text-muted-foreground text-2xs">
                  #
                </th>
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-2 py-1.5 border-b border-r border-border text-left cursor-pointer hover:bg-hover select-none whitespace-nowrap"
                    onClick={() => handleSort(col)}
                  >
                    <div className="flex items-center gap-1">
                      <span className="font-medium">{col}</span>
                      {sortCol === col ? (
                        sortDir === 'asc' ? <ArrowUp size={10} /> : <ArrowDown size={10} />
                      ) : (
                        <ArrowUpDown size={10} className="text-muted-foreground/50" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`${selectedRows.has(rowIdx) ? 'bg-primary/10' : rowIdx % 2 === 0 ? '' : 'bg-muted/20'} hover:bg-hover/50`}
                >
                  <td className="px-2 py-1 border-b border-r border-border text-center">
                    <input
                      type="checkbox"
                      checked={selectedRows.has(rowIdx)}
                      onChange={() => toggleRowSelection(rowIdx)}
                      className="rounded"
                    />
                  </td>
                  <td className="px-1 py-1 border-b border-r border-border text-center text-2xs text-muted-foreground">
                    {(currentPage - 1) * pageSize + rowIdx + 1}
                  </td>
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-2 py-1 border-b border-r border-border whitespace-nowrap max-w-[200px] truncate cursor-text"
                      onDoubleClick={() => startEdit(rowIdx, col)}
                    >
                      {editingCell?.row === rowIdx && editingCell?.col === col ? (
                        <input
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={commitEdit}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') commitEdit();
                            if (e.key === 'Escape') setEditingCell(null);
                          }}
                          className="w-full h-5 text-xs px-1 border border-primary rounded focus:outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className={row[col] === null ? 'text-muted-foreground italic' : ''}>
                          {row[col] === null ? 'NULL' : String(row[col])}
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-2 py-1 border-t border-border bg-toolbar flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-2xs text-muted-foreground">
            {t('table.page')} {currentPage} / {totalPages}
          </span>
          <span className="text-2xs text-muted-foreground">|</span>
          <div className="flex items-center gap-1">
            <span className="text-2xs text-muted-foreground">{t('table.perPage')}:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              className="h-5 text-2xs px-1 rounded border border-border bg-background text-foreground focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>{size}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentPage(1)} disabled={currentPage === 1}>
            <ChevronsLeft size={12} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))} disabled={currentPage === 1}>
            <ChevronLeft size={12} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>
            <ChevronRight size={12} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setCurrentPage(totalPages)} disabled={currentPage === totalPages}>
            <ChevronsRight size={12} />
          </Button>
        </div>
      </div>
    </div>
  );
}
