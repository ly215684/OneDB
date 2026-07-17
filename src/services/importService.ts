export interface ImportResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  errors: string[];
}

export type ImportFormat = 'csv' | 'json' | 'sql';

export function parseCSV(content: string, options?: { delimiter?: string; hasHeader?: boolean }): ImportResult {
  const delimiter = options?.delimiter ?? detectDelimiter(content);
  const hasHeader = options?.hasHeader ?? true;
  const errors: string[] = [];

  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);

  if (lines.length === 0) {
    return { columns: [], rows: [], rowCount: 0, errors: ['File is empty'] };
  }

  let columns: string[];
  let dataLines: string[];

  if (hasHeader) {
    columns = parseCSVLine(lines[0], delimiter);
    dataLines = lines.slice(1);
  } else {
    const firstRowCols = parseCSVLine(lines[0], delimiter);
    columns = firstRowCols.map((_, i) => `column_${i + 1}`);
    dataLines = lines;
  }

  const rows: Record<string, unknown>[] = [];

  dataLines.forEach((line, idx) => {
    try {
      const values = parseCSVLine(line, delimiter);
      const row: Record<string, unknown> = {};
      columns.forEach((col, colIdx) => {
        const raw = values[colIdx];
        row[col] = raw === undefined || raw === '' ? null : parseValue(raw);
      });
      rows.push(row);
    } catch (e) {
      errors.push(`Line ${idx + 2}: ${e instanceof Error ? e.message : 'Parse error'}`);
    }
  });

  return { columns, rows, rowCount: rows.length, errors };
}

function detectDelimiter(content: string): string {
  const firstLine = content.split('\n')[0] || '';
  const commaCount = (firstLine.match(/,/g) || []).length;
  const tabCount = (firstLine.match(/\t/g) || []).length;
  const semicolonCount = (firstLine.match(/;/g) || []).length;
  const pipeCount = (firstLine.match(/\|/g) || []).length;

  const counts = [
    { delim: ',', count: commaCount },
    { delim: '\t', count: tabCount },
    { delim: ';', count: semicolonCount },
    { delim: '|', count: pipeCount },
  ];

  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delim : ',';
}

function parseCSVLine(line: string, delimiter: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === delimiter) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
  }

  result.push(current.trim());
  return result;
}

function parseValue(value: string): unknown {
  if (value.toLowerCase() === 'null' || value.toLowerCase() === 'none') return null;
  if (value.toLowerCase() === 'true') return true;
  if (value.toLowerCase() === 'false') return false;

  const num = Number(value);
  if (!isNaN(num) && value !== '') return num;

  return value;
}

export function parseJSON(content: string): ImportResult {
  const errors: string[] = [];
  try {
    const data = JSON.parse(content);
    if (!Array.isArray(data)) {
      return { columns: [], rows: [], rowCount: 0, errors: ['JSON must be an array of objects'] };
    }

    const columnSet = new Set<string>();
    data.forEach((item: Record<string, unknown>) => {
      if (typeof item === 'object' && item !== null) {
        Object.keys(item).forEach((k) => columnSet.add(k));
      }
    });

    const columns = Array.from(columnSet);
    const rows = data.map((item: Record<string, unknown>) => {
      const row: Record<string, unknown> = {};
      columns.forEach((col) => {
        row[col] = item[col] ?? null;
      });
      return row;
    });

    return { columns, rows, rowCount: rows.length, errors };
  } catch (e) {
    errors.push(`JSON parse error: ${e instanceof Error ? e.message : 'Invalid JSON'}`);
    return { columns: [], rows: [], rowCount: 0, errors };
  }
}

export function parseSQLInserts(content: string): ImportResult {
  const errors: string[] = [];
  const rows: Record<string, unknown>[] = [];
  let columns: string[] = [];

  const insertRegex = /INSERT\s+INTO\s+\w+\s*\(([^)]+)\)\s*VALUES\s*\(([^)]+)\)/gi;
  let match;

  while ((match = insertRegex.exec(content)) !== null) {
    const cols = match[1].split(',').map((c) => c.trim());
    const vals = match[2].split(',').map((v) => v.trim());

    if (columns.length === 0) {
      columns = cols;
    }

    const row: Record<string, unknown> = {};
    cols.forEach((col, i) => {
      const raw = vals[i];
      if (raw === undefined) {
        row[col] = null;
      } else if (raw.toUpperCase() === 'NULL') {
        row[col] = null;
      } else if (raw.startsWith("'") && raw.endsWith("'")) {
        row[col] = raw.slice(1, -1).replace(/''/g, "'");
      } else {
        const num = Number(raw);
        row[col] = isNaN(num) ? raw : num;
      }
    });
    rows.push(row);
  }

  if (rows.length === 0) {
    errors.push('No INSERT statements found');
  }

  return { columns, rows, rowCount: rows.length, errors };
}

export function importFromFile(content: string, format: ImportFormat): ImportResult {
  switch (format) {
    case 'csv':
      return parseCSV(content);
    case 'json':
      return parseJSON(content);
    case 'sql':
      return parseSQLInserts(content);
    default:
      return { columns: [], rows: [], rowCount: 0, errors: [`Unsupported format: ${format}`] };
  }
}
