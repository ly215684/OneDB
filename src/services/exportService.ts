import type { QueryResult } from '../types/connection';
import * as XLSX from 'xlsx';

export type ExportFormat = 'csv' | 'json' | 'sql-insert' | 'xlsx';

export function exportData(
  data: QueryResult,
  format: ExportFormat,
  tableName: string = 'table'
): string {
  switch (format) {
    case 'csv':
      return exportToCSV(data);
    case 'json':
      return exportToJSON(data);
    case 'sql-insert':
      return exportToSQLInsert(data, tableName);
    case 'xlsx':
      // xlsx is binary; handled separately in exportToFile
      return '';
    default:
      throw new Error(`Unsupported export format: ${format}`);
  }
}

function exportToCSV(data: QueryResult): string {
  if (!data.columns || data.columns.length === 0) {
    return '';
  }

  const headers = data.columns.map((col) => escapeCSV(col));
  const rows = data.rows.map((row) =>
    data.columns.map((col) => escapeCSV(formatValue(row[col]))).join(',')
  );

  return [headers.join(','), ...rows].join('\n');
}

function escapeCSV(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: any): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value);
}

function exportToJSON(data: QueryResult): string {
  if (!data.rows || data.rows.length === 0) {
    return '[]';
  }

  const result = data.rows.map((row) => {
    const obj: Record<string, any> = {};
    data.columns.forEach((col) => {
      obj[col] = row[col];
    });
    return obj;
  });

  return JSON.stringify(result, null, 2);
}

function exportToSQLInsert(data: QueryResult, tableName: string): string {
  if (!data.rows || data.rows.length === 0) {
    return '';
  }

  const statements = data.rows.map((row) => {
    const columns = data.columns.join(', ');
    const values = data.columns
      .map((col) => formatSQLValue(row[col]))
      .join(', ');
    return `INSERT INTO ${tableName} (${columns}) VALUES (${values});`;
  });

  return statements.join('\n');
}

function formatSQLValue(value: any): string {
  if (value === null || value === undefined) {
    return 'NULL';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (typeof value === 'boolean') {
    return value ? 'TRUE' : 'FALSE';
  }
  if (typeof value === 'object') {
    return `'${JSON.stringify(value).replace(/'/g, "''")}'`;
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToFile(
  data: QueryResult,
  format: ExportFormat,
  tableName: string = 'table'
): void {
  if (format === 'xlsx') {
    exportToXLSX(data, tableName);
    return;
  }
  const content = exportData(data, format, tableName);
  const extensions: Record<Exclude<ExportFormat, 'xlsx'>, string> = {
    csv: 'csv',
    json: 'json',
    'sql-insert': 'sql',
  };
  const mimeTypes: Record<Exclude<ExportFormat, 'xlsx'>, string> = {
    csv: 'text/csv',
    json: 'application/json',
    'sql-insert': 'text/plain',
  };
  const filename = `${tableName}_${Date.now()}.${extensions[format]}`;
  downloadFile(content, filename, mimeTypes[format]);
}

function exportToXLSX(data: QueryResult, tableName: string): void {
  const rows = (data.rows || []).map((row) => {
    const obj: Record<string, unknown> = {};
    (data.columns || []).forEach((col) => {
      const v = row[col];
      obj[col] = typeof v === 'object' && v !== null ? JSON.stringify(v) : v;
    });
    return obj;
  });
  const ws = XLSX.utils.json_to_sheet(rows, { header: data.columns || [] });
  const wb = XLSX.utils.book_new();
  // Sheet names must not contain []:*?/\
  const sheetName = (tableName || 'Result').replace(/[\[\]:*?/\\]/g, '_').slice(0, 31) || 'Result';
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${tableName}_${Date.now()}.xlsx`);
}
