import { useState, useEffect, useCallback, useRef } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import { useSettingsStore } from '../../stores/settingsStore';
import { executeQuery, executeBatch, getTableStructure } from '../../services/connectionService';
import { exportToFile, exportData, type ExportFormat } from '../../services/exportService';
import { useDragScroll } from '../../hooks/useDragScroll';
import { Button } from '../ui/Button';
import { DropdownMenu, ContextMenu } from '../ui/DropdownMenu';
import { useMessage } from '../ui/Message';
import { Modal } from '../ui/Modal';
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
  X,
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

  // Escape a table/column identifier per dialect to avoid injection via names
  const quoteIdent = (name: string): string => {
    if (conn?.type === 'mysql' || conn?.type === 'mariadb') {
      return '`' + name.replace(/`/g, '``') + '`';
    }
    return '"' + name.replace(/"/g, '""') + '"';
  };

  // Cached total row count (recount only on manual refresh)
  const countCacheRef = useRef<number | null>(null);
  useEffect(() => {
    countCacheRef.current = null;
    setCellChanges(new Map());
    setDeletedIndices(new Set());
    setNewRows([]);
    setEditingCell(null);
  }, [tableName, database, connectionId]);

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

  // Changeset tracking for data writeback
  const [primaryKeys, setPrimaryKeys] = useState<string[]>([]);
  const [cellChanges, setCellChanges] = useState<Map<number, Map<string, unknown>>>(new Map());
  const [deletedIndices, setDeletedIndices] = useState<Set<number>>(new Set());
  const [newRows, setNewRows] = useState<RowData[]>([]);
  const [previewSql, setPreviewSql] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const [autoCommit, setAutoCommit] = useState(true);

  // Cell value viewer (for NULL/BLOB/long text)
  const [cellViewer, setCellViewer] = useState<{ col: string; value: string; type: string } | null>(null);

  // Fetch primary key columns for SQL generation
  useEffect(() => {
    if (!conn || !tableName || !database || isNoSql) {
      setPrimaryKeys([]);
      return;
    }
    getTableStructure(conn.type, conn.config, database, tableName)
      .then((struct) => {
        setPrimaryKeys(struct.columns.filter((c) => c.primary_key).map((c) => c.name));
      })
      .catch(() => setPrimaryKeys([]));
  }, [conn, tableName, database, isNoSql]);

  const fetchData = useCallback(async (forceCount = false) => {
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
        const ident = quoteIdent(tableName);
        const parts = [`SELECT * FROM ${ident}`];
        parts.push(`LIMIT ${pageSize} OFFSET ${(currentPage - 1) * pageSize}`);
        query = parts.join(' ');
        countQuery = `SELECT COUNT(*) as cnt FROM ${ident}`;
      }
      const needCount = forceCount || countCacheRef.current === null;
      const [result, countResult] = await Promise.all([
        executeQuery(conn.type, conn.config, query, database),
        needCount
          ? executeQuery(conn.type, conn.config, countQuery, database)
          : Promise.resolve(null),
      ]);
      if (result.success) {
        setColumns(result.columns);
        setRows(result.rows);
        setDuration(result.duration);
        // Parse total count (cached across page changes)
        if (countResult && countResult.success && countResult.rows.length > 0) {
          const row = countResult.rows[0];
          const cnt = isNoSql ? (row['count'] as number) : (row['cnt'] ?? row['COUNT(*)'] ?? Object.values(row)[0]) as number;
          const total = Number(cnt) || 0;
          countCacheRef.current = total;
          setTotalRows(total);
        } else if (countCacheRef.current !== null) {
          setTotalRows(countCacheRef.current);
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
    if (!selRange) return;
    const newDeleted = new Set(deletedIndices);
    for (let i = selRange.rowStart; i <= selRange.rowEnd; i++) {
      if (i < rows.length) newDeleted.add(i);
    }
    setDeletedIndices(newDeleted);
    setSelection(null);
    anchorRef.current = null;
  };

  const addNewRow = () => {
    const emptyRow: RowData = {};
    columns.forEach((col) => { emptyRow[col] = null; });
    setNewRows((prev) => [...prev, emptyRow]);
    setTotalRows((prev) => prev + 1);
  };

  const pendingCount = cellChanges.size + deletedIndices.size + newRows.length;

  const formatSqlValue = (val: unknown): string => {
    if (val === null || val === undefined) return 'NULL';
    if (typeof val === 'number') return String(val);
    if (typeof val === 'boolean') return conn?.type === 'postgresql' ? String(val) : (val ? '1' : '0');
    const str = typeof val === 'object' ? JSON.stringify(val) : String(val);
    return "'" + str.replace(/'/g, "''") + "'";
  };

  const buildWhereClause = (row: RowData): string => {
    if (primaryKeys.length === 0) return '1=1 /* no PK */';
    return primaryKeys.map((pk) => {
      const v = row[pk];
      return v === null || v === undefined ? `${quoteIdent(pk)} IS NULL` : `${quoteIdent(pk)} = ${formatSqlValue(v)}`;
    }).join(' AND ');
  };

  const generatePreviewSql = (): string => {
    const stmts: string[] = [];
    const ident = quoteIdent(tableName);
    deletedIndices.forEach((idx) => {
      stmts.push(`DELETE FROM ${ident} WHERE ${buildWhereClause(rows[idx])};`);
    });
    cellChanges.forEach((colMap, idx) => {
      if (deletedIndices.has(idx)) return;
      const sets: string[] = [];
      colMap.forEach((val, col) => { sets.push(`${quoteIdent(col)} = ${formatSqlValue(val)}`); });
      if (sets.length > 0) stmts.push(`UPDATE ${ident} SET ${sets.join(', ')} WHERE ${buildWhereClause(rows[idx])};`);
    });
    newRows.forEach((row) => {
      const cols = columns.map((c) => quoteIdent(c));
      const vals = columns.map((c) => formatSqlValue(row[c]));
      stmts.push(`INSERT INTO ${ident} (${cols.join(', ')}) VALUES (${vals.join(', ')});`);
    });
    return stmts.join('\n');
  };

  const openPreview = () => {
    const sql = generatePreviewSql();
    if (!sql) { msg.info(t('table.noChanges')); return; }
    setPreviewSql(sql);
  };

  const applyChanges = async () => {
    if (!conn || !previewSql) return;
    setApplying(true);
    const statements = previewSql.split(';').map((s) => s.trim()).filter((s) => s.length > 0);
    try {
      const results = await executeBatch(conn.type, conn.config, statements, database, !autoCommit);
      const failures = results.filter((r) => !r.success);
      if (failures.length === 0) {
        msg.success(t('table.applySuccess', { count: results.length }));
        setPreviewSql(null);
        fetchData(true);
      } else {
        msg.error(t('table.applyPartial', { success: results.length - failures.length, failed: failures.length }) + ': ' + (failures[0].error || 'Unknown'));
      }
    } catch (err) {
      msg.error(String(err));
    } finally {
      setApplying(false);
    }
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
    const original = rows[row];
    if (original && String(original[col]) !== editValue) {
      setCellChanges((prev) => {
        const next = new Map(prev);
        const colMap = new Map(next.get(row) || []);
        colMap.set(col, editValue);
        next.set(row, colMap);
        return next;
      });
    }
    setEditingCell(null);
  };

  const [exporting, setExporting] = useState(false);

  const handleExport = async (format: ExportFormat, scope: 'all' | 'page') => {
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
        : `SELECT * FROM ${quoteIdent(tableName)}`;
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
        <Button variant="outline" size="sm" onClick={() => fetchData(true)}>
          <RefreshCw size={14} className="mr-1" />{t('common.retry')}
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-2 py-1.5 border-b border-border bg-toolbar flex-shrink-0">
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => fetchData(true)} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
        </Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={addNewRow}><Plus size={14} /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={deleteSelectedRows} disabled={!selRange}><Trash2 size={14} /></Button>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={openPreview} disabled={pendingCount === 0}>
          <Save size={14} />
        </Button>
        {pendingCount > 0 && (
          <span className="text-2xs text-amber-500 dark:text-amber-400 font-medium">
            {t('table.pendingChanges', { count: pendingCount })}
          </span>
        )}
        <div className="w-px h-5 bg-border" />
        <label className="flex items-center gap-1 text-2xs text-muted-foreground cursor-pointer select-none" title={t('table.autoCommitHint')}>
          <input type="checkbox" checked={autoCommit} onChange={(e) => setAutoCommit(e.target.checked)} className="rounded border-border" />
          {t('table.autoCommit')}
        </label>
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
            { label: t('table.exportAllXlsx'), onClick: () => handleExport('xlsx', 'all') },
            { separator: true, label: '' },
            { label: t('table.exportPageCsv'), onClick: () => handleExport('csv', 'page') },
            { label: t('table.exportPageJson'), onClick: () => handleExport('json', 'page') },
            { label: t('table.exportPageSql'), onClick: () => handleExport('sql-insert', 'page') },
            { label: t('table.exportPageXlsx'), onClick: () => handleExport('xlsx', 'page') },
          ]}
          trigger={<Button variant="ghost" size="icon" className="h-7 w-7" disabled={exporting}><ArrowDownToLine size={14} className={exporting ? 'animate-pulse' : ''} /></Button>}
        />
        <span className="text-2xs text-muted-foreground">
          {totalRows + newRows.length} {t('table.rows')} · {duration} {t('editor.ms')}
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
                  className={`${deletedIndices.has(rowIdx) ? 'opacity-40 line-through' : isFullRowSelected(rowIdx) ? 'bg-selection' : rowIdx % 2 === 0 ? '' : 'bg-muted/20'} hover:bg-hover/50`}
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
                        deletedIndices.has(rowIdx) ? '' :
                        isCellSelected(rowIdx, colIdx) ? 'bg-selection' :
                        cellChanges.get(rowIdx)?.has(col) ? 'bg-amber-100 dark:bg-amber-900/30' : ''
                      }`}
                      data-row={rowIdx}
                      data-col={colIdx}
                      onMouseDown={(e) => handleCellMouseDown(rowIdx, colIdx, e)}
                      onContextMenu={(e) => handleCellContextMenu(rowIdx, colIdx, e)}
                      onDoubleClick={() => {
                        const val = row[col];
                        const str = val === null || val === undefined ? '' : typeof val === 'object' ? JSON.stringify(val, null, 2) : String(val);
                        const isBlob = typeof val === 'string' && val.startsWith('<blob ');
                        const isLong = str.length > 100;
                        const isJson = typeof val === 'object' || (typeof val === 'string' && (val.startsWith('{') || val.startsWith('[')));
                        if (isBlob || isLong || isJson || val === null) {
                          setCellViewer({ col, value: val === null ? 'NULL' : str, type: isBlob ? 'blob' : isJson ? 'json' : 'text' });
                        } else {
                          startEdit(rowIdx, col);
                        }
                      }}
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
              {newRows.map((_row, idx) => (
                <tr key={`new-${idx}`} className="bg-green-50 dark:bg-green-950/20 hover:bg-green-100 dark:hover:bg-green-950/30">
                  <td className="px-1 py-1 border-b border-r border-border text-center text-2xs text-green-600 dark:text-green-400 font-medium">
                    +
                  </td>
                  {columns.map((col, colIdx) => (
                    <td
                      key={col}
                      className="px-2 py-1 border-b border-r border-border whitespace-nowrap max-w-[200px] truncate cursor-cell"
                      data-row={rows.length + idx}
                      data-col={colIdx}
                      onMouseDown={(e) => handleCellMouseDown(rows.length + idx, colIdx, e)}
                      onDoubleClick={() => startEdit(rows.length + idx, col)}
                    >
                      <span className="text-muted-foreground italic">NULL</span>
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

      {/* Cell Value Viewer Modal */}
      <Modal open={cellViewer !== null} onClose={() => setCellViewer(null)} title={cellViewer ? `${cellViewer.col} (${cellViewer.type})` : ''} width="max-w-2xl">
        {cellViewer && (
          <div className="p-4">
            <pre className="text-xs bg-background rounded p-3 overflow-auto max-h-[60vh] font-mono whitespace-pre-wrap border border-border">
              {cellViewer.value}
            </pre>
          </div>
        )}
      </Modal>

      {/* Preview SQL Modal */}
      <Modal open={previewSql !== null} onClose={() => setPreviewSql(null)} title={t('table.previewChanges')} width="max-w-3xl">
        <div className="p-4 space-y-3">
          <pre className="text-xs bg-background rounded p-3 overflow-auto max-h-[50vh] font-mono whitespace-pre-wrap border border-border">
            {previewSql}
          </pre>
          <div className="flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setPreviewSql(null)}>
              <X size={14} className="mr-1" />{t('common.cancel')}
            </Button>
            <Button size="sm" onClick={applyChanges} disabled={applying}>
              <Save size={14} className="mr-1" />
              {applying ? t('table.applying') : t('table.applyChanges')}
            </Button>
          </div>
        </div>
      </Modal>

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
