import { useState, useEffect, useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { executeQuery } from '../../services/connectionService';
import { exportToFile, exportData } from '../../services/exportService';
import { useDragScroll } from '../../hooks/useDragScroll';
import { Button } from '../ui/Button';
import { DropdownMenu, ContextMenu } from '../ui/DropdownMenu';
import { useMessage } from '../ui/Message';
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
  Search,
  Copy,
  FileCode2,
} from 'lucide-react';

interface DataTableViewProps {
  tableName: string;
  connectionId?: string;
  database?: string;
}

interface RowData {
  [key: string]: unknown;
}

interface CellRange {
  rowStart: number;
  rowEnd: number;
  colStart: number;
  colEnd: number;
}

export function DataTableView({ tableName, connectionId, database }: DataTableViewProps) {
  const { t } = useTranslation();
  const getConnection = useConnectionStore((s) => s.getConnection);
  const conn = connectionId ? getConnection(connectionId) : undefined;
  const isNoSql = conn?.type === 'mongodb' || conn?.type === 'mongodb_srv' || conn?.type === 'redis';
  const dragScrollRef = useDragScroll(false);
  const msg = useMessage();

  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);
  const [totalRows, setTotalRows] = useState(0);

  // Filtering
  const [filterText, setFilterText] = useState('');
  // Pagination
  const defaultPageSize = useSettingsStore((s) => s.editor.defaultPageSize);
  const [pageSize, setPageSize] = useState(defaultPageSize || 50);
  const pageSizeOptions = [10, 20, 50, 100, 200, 500].includes(pageSize)
    ? [10, 20, 50, 100, 200, 500]
    : [10, 20, 50, 100, 200, 500, pageSize].sort((a, b) => a - b);
  const [currentPage, setCurrentPage] = useState(1);
  // Range selection (box selection of cells)
  const [selection, setSelection] = useState<CellRange | null>(null);
  const anchorRef = useRef<{ row: number; col: number } | null>(null);
  const isSelectingRef = useRef(false);
  const tbodyRef = useRef<HTMLTableSectionElement>(null);
  const lastClickTimeRef = useRef(0);
  const lastClickTargetRef = useRef<EventTarget | null>(null);
  // Context menu
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
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
      let countQuery: string;
      if (isNoSql) {
        query = JSON.stringify({ collection: tableName, operation: 'find', filter: {}, limit: pageSize, skip: (currentPage - 1) * pageSize });
        countQuery = JSON.stringify({ collection: tableName, operation: 'count', filter: {} });
      } else {
        const parts = [`SELECT * FROM ${tableName}`];
        parts.push(`LIMIT ${pageSize} OFFSET ${(currentPage - 1) * pageSize}`);
        query = parts.join(' ');
        countQuery = `SELECT COUNT(*) as cnt FROM ${tableName}`;
      }
      const [result, countResult] = await Promise.all([
        executeQuery(conn.type, conn.config, query, database),
        executeQuery(conn.type, conn.config, countQuery, database),
      ]);
      if (result.success) {
        setColumns(result.columns);
        setRows(result.rows);
        setDuration(result.duration);
        // Parse total count
        if (countResult.success && countResult.rows.length > 0) {
          const row = countResult.rows[0];
          const cnt = isNoSql ? (row['count'] as number) : (row['cnt'] ?? row['COUNT(*)'] ?? Object.values(row)[0]) as number;
          setTotalRows(Number(cnt) || 0);
        } else {
          setTotalRows(result.rows.length);
        }
      } else {
        setError(result.error || 'Query failed');
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [conn, tableName, database, isNoSql, currentPage, pageSize]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Client-side filtering (on current page data only)
  const filteredRows = rows.filter((row) => {
    if (!filterText) return true;
    const lower = filterText.toLowerCase();
    return columns.some((col) => {
      const val = row[col];
      return val !== null && val !== undefined && String(val).toLowerCase().includes(lower);
    });
  });

  const totalPages = Math.max(1, Math.ceil(totalRows / pageSize));
  const pagedRows = filteredRows;

  // Normalized selection range
  const selRange = selection
    ? {
        rowStart: Math.min(selection.rowStart, selection.rowEnd),
        rowEnd: Math.max(selection.rowStart, selection.rowEnd),
        colStart: Math.min(selection.colStart, selection.colEnd),
        colEnd: Math.max(selection.colStart, selection.colEnd),
      }
    : null;

  // Full-row highlight only when ALL columns are selected (row-number click or # double-click)
  const isFullRowSelected = (rowIdx: number) =>
    !!selRange &&
    rowIdx >= selRange.rowStart &&
    rowIdx <= selRange.rowEnd &&
    selRange.colStart === 0 &&
    selRange.colEnd === columns.length - 1;

  const isCellSelected = (rowIdx: number, colIdx: number) =>
    !!selRange &&
    rowIdx >= selRange.rowStart &&
    rowIdx <= selRange.rowEnd &&
    colIdx >= selRange.colStart &&
    colIdx <= selRange.colEnd;

  // Clear selection when data view changes
  useEffect(() => {
    setSelection(null);
    anchorRef.current = null;
  }, [rows, currentPage, pageSize, filterText]);

  // Native event system for reliable drag-selection and double-click detection
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!isSelectingRef.current || !anchorRef.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY);
      if (!el) return;
      const cell = (el as HTMLElement).closest?.('td[data-row]') as HTMLElement | null;
      if (!cell) return;
      // Only handle cells within tbody (not row-number cells)
      if (tbodyRef.current && !tbodyRef.current.contains(cell)) return;
      const row = Number(cell.getAttribute('data-row'));
      const col = Number(cell.getAttribute('data-col'));
      if (isNaN(row) || isNaN(col)) return;
      setSelection({
        rowStart: anchorRef.current.row,
        rowEnd: row,
        colStart: anchorRef.current.col,
        colEnd: col,
      });
    };

    const onMouseUp = () => {
      isSelectingRef.current = false;
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

  const handleCellMouseDown = (rowIdx: number, colIdx: number, e: ReactMouseEvent) => {
    if (e.button !== 0) return;
    // Do not interfere with the active cell editor
    if (editingCell && editingCell.row === rowIdx && editingCell.col === columns[colIdx]) return;
    isSelectingRef.current = true;
    if (e.shiftKey && anchorRef.current) {
      setSelection({ rowStart: anchorRef.current.row, rowEnd: rowIdx, colStart: anchorRef.current.col, colEnd: colIdx });
    } else {
      anchorRef.current = { row: rowIdx, col: colIdx };
      setSelection({ rowStart: rowIdx, rowEnd: rowIdx, colStart: colIdx, colEnd: colIdx });
    }
  };

  // Double-click "#" header selects all rows and columns
  const handleRowNumberDoubleClick = () => {
    if (pagedRows.length === 0 || columns.length === 0) return;
    anchorRef.current = { row: 0, col: 0 };
    setSelection({ rowStart: 0, rowEnd: pagedRows.length - 1, colStart: 0, colEnd: columns.length - 1 });
  };

  // Double-click column header selects all rows in that column
  const handleHeaderDoubleClick = (colIdx: number) => {
    if (pagedRows.length === 0) return;
    anchorRef.current = { row: 0, col: colIdx };
    setSelection({ rowStart: 0, rowEnd: pagedRows.length - 1, colStart: colIdx, colEnd: colIdx });
  };

  const selectRow = (rowIdx: number, extend = false) => {
    if (columns.length === 0) return;
    if (extend && anchorRef.current) {
      setSelection({ rowStart: anchorRef.current.row, rowEnd: rowIdx, colStart: 0, colEnd: columns.length - 1 });
    } else {
      anchorRef.current = { row: rowIdx, col: 0 };
      setSelection({ rowStart: rowIdx, rowEnd: rowIdx, colStart: 0, colEnd: columns.length - 1 });
    }
  };

  const getSelectedSlice = () => {
    if (!selRange) return null;
    const cols = columns.slice(selRange.colStart, selRange.colEnd + 1);
    const rowsData = pagedRows.slice(selRange.rowStart, selRange.rowEnd + 1);
    return { cols, rowsData };
  };

  const formatTextValue = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
  };

  const copyAsText = useCallback(async () => {
    const slice = getSelectedSlice();
    if (!slice || slice.rowsData.length === 0) return;
    const text = slice.rowsData
      .map((row) => slice.cols.map((col) => formatTextValue(row[col])).join('\t'))
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      msg.success(t('table.copied'));
    } catch {
      msg.error(t('table.copyFailed'));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selRange, pagedRows, columns]);

  const copyAsSql = async () => {
    const slice = getSelectedSlice();
    if (!slice || slice.rowsData.length === 0) return;
    const sql = exportData(
      { columns: slice.cols, rows: slice.rowsData, rowCount: slice.rowsData.length, duration: 0, success: true },
      'sql-insert',
      tableName,
    );
    try {
      await navigator.clipboard.writeText(sql);
      msg.success(t('table.copied'));
    } catch {
      msg.error(t('table.copyFailed'));
    }
  };

  const deleteSelectedRows = () => {
    const slice = getSelectedSlice();
    if (!slice || slice.rowsData.length === 0) return;
    const toDelete = new Set(slice.rowsData);
    setRows((prev) => prev.filter((row) => !toDelete.has(row)));
    setSelection(null);
    anchorRef.current = null;
  };

  const handleCellContextMenu = (rowIdx: number, colIdx: number, e: ReactMouseEvent) => {
    e.preventDefault();
    if (!isCellSelected(rowIdx, colIdx)) {
      anchorRef.current = { row: rowIdx, col: colIdx };
      setSelection({ rowStart: rowIdx, rowEnd: rowIdx, colStart: colIdx, colEnd: colIdx });
    }
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleRowHeaderContextMenu = (rowIdx: number, e: ReactMouseEvent) => {
    e.preventDefault();
    if (!isFullRowSelected(rowIdx)) selectRow(rowIdx);
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  // Ctrl/Cmd+C copies the selection as text
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== 'c') return;
      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return;
      if (!selRange || editingCell) return;
      e.preventDefault();
      copyAsText();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [selRange, editingCell, copyAsText]);

  const startEdit = (rowIdx: number, col: string) => {
    setEditingCell({ row: rowIdx, col });
    setEditValue(String(pagedRows[rowIdx]?.[col] ?? ''));
  };

  const commitEdit = () => {
    if (!editingCell) return;
    const { row, col } = editingCell;
    setRows((prev) => {
      const next = [...prev];
      if (next[row]) next[row] = { ...next[row], [col]: editValue };
      return next;
    });
    setEditingCell(null);
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: 'csv' | 'json' | 'sql-insert', scope: 'all' | 'page') => {
    if (scope === 'page') {
      exportToFile(
        { columns, rows: filteredRows, rowCount: filteredRows.length, duration: 0, success: true },
        format,
        tableName,
      );
      return;
    }
    // Export all: fetch full data without LIMIT
    if (!conn) return;
    setExporting(true);
    try {
      const query = isNoSql
        ? JSON.stringify({ collection: tableName, operation: 'find', filter: {}, limit: 0, skip: 0 })
        : `SELECT * FROM ${tableName}`;
      const result = await executeQuery(conn.type, conn.config, query, database);
      if (result.success) {
        exportToFile(
          { columns: result.columns, rows: result.rows, rowCount: result.rows.length, duration: 0, success: true },
          format,
          tableName,
        );
      }
    } finally {
      setExporting(false);
    }
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
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={deleteSelectedRows} disabled={!selRange}><Trash2 size={14} /></Button>
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
            { label: t('table.exportAllCsv'), onClick: () => handleExport('csv', 'all') },
            { label: t('table.exportAllJson'), onClick: () => handleExport('json', 'all') },
            { label: t('table.exportAllSql'), onClick: () => handleExport('sql-insert', 'all') },
            { separator: true, label: '' },
            { label: t('table.exportPageCsv'), onClick: () => handleExport('csv', 'page') },
            { label: t('table.exportPageJson'), onClick: () => handleExport('json', 'page') },
            { label: t('table.exportPageSql'), onClick: () => handleExport('sql-insert', 'page') },
          ]}
          trigger={<Button variant="ghost" size="icon" className="h-7 w-7" disabled={exporting}><ArrowDownToLine size={14} className={exporting ? 'animate-pulse' : ''} /></Button>}
        />
        <span className="text-2xs text-muted-foreground">
          {totalRows} {t('table.rows')} · {duration} {t('editor.ms')}
        </span>
      </div>

      {/* Table */}
      <div ref={dragScrollRef} className="flex-1 overflow-auto min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <RefreshCw size={24} className="animate-spin text-muted-foreground" />
          </div>
        ) : columns.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('table.noData')}
          </div>
        ) : (
          <table className="min-w-full text-xs border-collapse select-none">
            <thead className="sticky top-0 z-10">
              <tr className="bg-muted">
                <th
                  className="w-10 px-1 py-1.5 border-b border-r border-border text-center text-muted-foreground text-2xs cursor-pointer select-none hover:bg-hover"
                  onClick={(e) => {
                    const now = Date.now();
                    if (now - lastClickTimeRef.current < 300 && lastClickTargetRef.current === e.currentTarget) {
                      handleRowNumberDoubleClick();
                      lastClickTimeRef.current = 0;
                    } else {
                      lastClickTimeRef.current = now;
                      lastClickTargetRef.current = e.currentTarget;
                    }
                  }}
                >
                  #
                </th>
                {columns.map((col, colIdx) => (
                  <th
                    key={col}
                    className={`px-2 py-1.5 border-b border-r border-border text-left cursor-pointer select-none whitespace-nowrap ${
                      selRange && colIdx >= selRange.colStart && colIdx <= selRange.colEnd ? 'bg-selection' : 'hover:bg-hover'
                    }`}
                    onClick={(e) => {
                      const now = Date.now();
                      if (now - lastClickTimeRef.current < 300 && lastClickTargetRef.current === e.currentTarget) {
                        handleHeaderDoubleClick(colIdx);
                        lastClickTimeRef.current = 0;
                      } else {
                        lastClickTimeRef.current = now;
                        lastClickTargetRef.current = e.currentTarget;
                      }
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      handleHeaderDoubleClick(colIdx);
                      setContextMenu({ x: e.clientX, y: e.clientY });
                    }}
                    title={col}
                  >
                    <span className="font-medium">{col}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody ref={tbodyRef}>
              {pagedRows.map((row, rowIdx) => (
                <tr
                  key={rowIdx}
                  className={`${isFullRowSelected(rowIdx) ? 'bg-selection' : rowIdx % 2 === 0 ? '' : 'bg-muted/20'} hover:bg-hover/50`}
                >
                  <td
                    className={`px-1 py-1 border-b border-r border-border text-center text-2xs cursor-pointer ${
                      isFullRowSelected(rowIdx) ? 'bg-selection text-foreground' : 'text-muted-foreground hover:bg-hover'
                    }`}
                    onClick={(e) => selectRow(rowIdx, e.shiftKey)}
                    onContextMenu={(e) => handleRowHeaderContextMenu(rowIdx, e)}
                  >
                    {(currentPage - 1) * pageSize + rowIdx + 1}
                  </td>
                  {columns.map((col, colIdx) => (
                    <td
                      key={col}
                      className={`px-2 py-1 border-b border-r border-border whitespace-nowrap max-w-[200px] truncate cursor-cell ${
                        isCellSelected(rowIdx, colIdx) ? 'bg-selection' : ''
                      }`}
                      data-row={rowIdx}
                      data-col={colIdx}
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, colIdx, e)}
                      onContextMenu={(e) => handleCellContextMenu(rowIdx, colIdx, e)}
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

      {/* Context menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            { label: t('table.copyAsText'), icon: <Copy size={12} />, onClick: copyAsText, disabled: !selRange },
            { label: t('table.copyAsSql'), icon: <FileCode2 size={12} />, onClick: copyAsSql, disabled: !selRange },
            { separator: true, label: '' },
            { label: t('table.deleteRows'), icon: <Trash2 size={12} />, onClick: deleteSelectedRows, danger: true, disabled: !selRange },
          ]}
        />
      )}
    </div>
  );
}
