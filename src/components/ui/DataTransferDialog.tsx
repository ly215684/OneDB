import { useState, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../../stores/connectionStore';
import { Modal } from './Modal';
import { Button } from './Button';
import { Select } from './Select';
import {
  Download,
  Upload,
  RefreshCw,
  Table,
  FileText,
  FileJson,
  FileCode,
  CheckCircle,
  AlertCircle,
  GitCompare,
  Plus,
  Minus,
  ArrowLeftRight,
  Loader2,
  Copy,
  Play,
} from 'lucide-react';
import { clsx } from 'clsx';
import { exportData, downloadFile, type ExportFormat } from '../../services/exportService';
import { importFromFile, type ImportFormat } from '../../services/importService';
import { executeQuery, getTableStructure } from '../../services/connectionService';

interface DataTransferDialogProps {
  open: boolean;
  onClose: () => void;
}

type TransferMode = 'export' | 'import' | 'sync' | 'schema-diff';

// ─── Export Panel ───────────────────────────────────────────────

function ExportPanel({
  connections,
  onDone,
}: {
  connections: ReturnType<typeof useConnectionStore.getState>['connections'];
  onDone: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useTranslation();
  const [sourceConn, setSourceConn] = useState('');
  const [sourceDb, setSourceDb] = useState('');
  const [objects, setObjects] = useState<Set<string>>(new Set());
  const [format, setFormat] = useState<Exclude<ExportFormat, 'xlsx'>>('sql-insert');
  const [exporting, setExporting] = useState(false);

  const sourceConnection = connections.find((c) => c.id === sourceConn);
  const sourceDatabases = sourceConnection?.databases || [];
  const selectedDb = sourceDatabases.find((db) => db.name === sourceDb);
  const availableTables = [
    ...(selectedDb?.tables || []).map((t) => t.name),
    ...(selectedDb?.collections || []).map((c) => c.name),
  ];

  const toggleObject = (name: string) => {
    setObjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const selectAll = () => {
    if (objects.size === availableTables.length) {
      setObjects(new Set());
    } else {
      setObjects(new Set(availableTables));
    }
  };

  const handleExport = async () => {
    if (!sourceConn || !sourceDb || objects.size === 0) return;
    setExporting(true);
    try {
      const selectedTables = Array.from(objects);
      for (const table of selectedTables) {
        const isMongo = sourceConnection?.type === 'mongodb' || sourceConnection?.type === 'mongodb_srv';
        const query = isMongo
          ? JSON.stringify({ collection: table, filter: {}, limit: 10000, skip: 0 })
          : `SELECT * FROM ${table}`;
        const result = await executeQuery(sourceConnection!.type, sourceConnection!.config, query, sourceDb);
        if (result.error) {
          onDone(`${t('transfer.exportFailed')}: ${table} - ${result.error}`, 'error');
          continue;
        }
        const content = exportData(result, format, table);
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
        const filename = `${table}.${extensions[format]}`;
        downloadFile(content, filename, mimeTypes[format]);
      }
      onDone(t('transfer.exportSuccess', { count: objects.size }), 'success');
    } catch (e) {
      onDone(`${t('transfer.exportFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setExporting(false);
    }
  };

  const formatOptions = [
    { id: 'sql-insert' as const, label: 'SQL', icon: FileCode, ext: '.sql' },
    { id: 'json' as const, label: 'JSON', icon: FileJson, ext: '.json' },
    { id: 'csv' as const, label: 'CSV', icon: FileText, ext: '.csv' },
  ];

  return (
    <div className="space-y-4">
      {/* Source */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t('transfer.sourceConnection')}
        </label>
        <Select
          value={sourceConn}
          onChange={(e) => {
            setSourceConn(e.target.value);
            setSourceDb('');
            setObjects(new Set());
          }}
          options={[
            { value: '', label: t('transfer.selectConnection') },
            ...connections.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        {sourceConn && (
          <Select
            value={sourceDb}
            onChange={(e) => {
              setSourceDb(e.target.value);
              setObjects(new Set());
            }}
            options={[
              { value: '', label: t('transfer.selectDatabase') },
              ...sourceDatabases.map((db) => ({ value: db.name, label: db.name })),
            ]}
          />
        )}
      </div>

      {/* Export Format */}
      {sourceDb && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t('transfer.exportFormat')}
          </label>
          <div className="flex gap-2">
            {formatOptions.map((f) => (
              <button
                key={f.id}
                onClick={() => setFormat(f.id)}
                className={clsx(
                  'flex-1 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-lg border-2 transition-all text-sm',
                  format === f.id
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground'
                )}
              >
                <f.icon size={18} />
                <span className="font-medium">{f.label}</span>
                <span className="text-[10px] opacity-60">{f.ext}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Table Selection */}
      {sourceDb && availableTables.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-muted-foreground">
              {t('transfer.selectTables')}
            </label>
            <button
              onClick={selectAll}
              className="text-xs text-primary hover:underline"
            >
              {objects.size === availableTables.length
                ? t('transfer.deselectAll')
                : t('transfer.selectAll')}
            </button>
          </div>
          <div className="border border-border rounded-lg p-2 max-h-40 overflow-y-auto">
            {availableTables.map((table) => (
              <label
                key={table}
                className="flex items-center gap-2 px-2 py-1 hover:bg-hover rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={objects.has(table)}
                  onChange={() => toggleObject(table)}
                  className="rounded border-border"
                />
                <Table size={12} className="text-muted-foreground" />
                <span className="text-xs">{table}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleExport}
          disabled={!sourceConn || !sourceDb || objects.size === 0 || exporting}
        >
          <Download size={14} className="mr-1.5" />
          {exporting ? t('transfer.exporting') : t('editor.export')}
        </Button>
      </div>
    </div>
  );
}

// ─── Import Panel ───────────────────────────────────────────────

function ImportPanel({
  connections,
  onDone,
}: {
  connections: ReturnType<typeof useConnectionStore.getState>['connections'];
  onDone: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useTranslation();
  const fileRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState('');
  const [fileContent, setFileContent] = useState('');
  const [importFormat, setImportFormat] = useState<ImportFormat>('json');
  const [targetConn, setTargetConn] = useState('');
  const [targetDb, setTargetDb] = useState('');
  const [targetTable, setTargetTable] = useState('');
  const [importing, setImporting] = useState(false);

  const targetConnection = connections.find((c) => c.id === targetConn);
  const targetDatabases = targetConnection?.databases || [];
  const selectedDb = targetDatabases.find((db) => db.name === targetDb);
  const availableTables = [
    ...(selectedDb?.tables || []).map((t) => t.name),
    ...(selectedDb?.collections || []).map((c) => c.name),
  ];

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const text = await file.text();
    setFileContent(text);
    // Auto-detect format from extension
    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext === 'csv') setImportFormat('csv');
    else if (ext === 'sql') setImportFormat('sql');
    else setImportFormat('json');
  };

  const handleImport = async () => {
    if (!fileContent || !targetConn || !targetDb || !targetTable) return;
    setImporting(true);
    try {
      const result = importFromFile(fileContent, importFormat);
      if (result.errors.length > 0 && result.rowCount === 0) {
        onDone(`${t('transfer.importFailed')}: ${result.errors[0]}`, 'error');
        return;
      }

      // Build INSERT statements and execute
      const sql = exportData(
        { columns: result.columns, rows: result.rows, rowCount: result.rowCount, duration: 0, success: true },
        'sql-insert',
        targetTable
      );
      const isMongo = targetConnection?.type === 'mongodb';

      if (isMongo) {
        // For MongoDB, insert as JSON documents
        const docs = result.rows;
        const query = JSON.stringify({
          operation: 'insertMany',
          collection: targetTable,
          documents: docs,
        });
        const res = await executeQuery(targetConnection!.type, targetConnection!.config, query, targetDb);
        if (res.error) {
          onDone(`${t('transfer.importFailed')}: ${res.error}`, 'error');
        } else {
          onDone(
            t('transfer.importSuccess', { count: result.rowCount, table: targetTable }),
            'success'
          );
        }
      } else {
        // For SQL databases, execute each INSERT
        const statements = sql.split(';\n').filter((s) => s.trim());
        let successCount = 0;
        let lastError = '';
        for (const stmt of statements) {
          const res = await executeQuery(targetConnection!.type, targetConnection!.config, stmt, targetDb);
          if (res.error) {
            lastError = res.error;
          } else {
            successCount++;
          }
        }
        if (successCount > 0) {
          onDone(
            t('transfer.importSuccess', { count: successCount, table: targetTable }),
            'success'
          );
        } else {
          onDone(`${t('transfer.importFailed')}: ${lastError}`, 'error');
        }
      }
    } catch (e) {
      onDone(`${t('transfer.importFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File Selection */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t('transfer.selectFile')}
        </label>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.json,.sql"
            onChange={handleFileSelect}
            className="hidden"
          />
          <Button variant="outline" onClick={() => fileRef.current?.click()} className="flex-1 justify-start">
            <Upload size={14} className="mr-1.5" />
            {fileName || t('transfer.chooseFile')}
          </Button>
        </div>
        {fileName && (
          <div className="flex gap-2">
            {(['json', 'sql', 'csv'] as const).map((fmt) => (
              <button
                key={fmt}
                onClick={() => setImportFormat(fmt)}
                className={clsx(
                  'px-3 py-1.5 rounded-md border text-xs transition-all',
                  importFormat === fmt
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border hover:border-primary/50 text-muted-foreground'
                )}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Target */}
      <div className="space-y-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t('transfer.targetConnection')}
        </label>
        <Select
          value={targetConn}
          onChange={(e) => {
            setTargetConn(e.target.value);
            setTargetDb('');
            setTargetTable('');
          }}
          options={[
            { value: '', label: t('transfer.selectConnection') },
            ...connections.map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
        {targetConn && (
          <Select
            value={targetDb}
            onChange={(e) => {
              setTargetDb(e.target.value);
              setTargetTable('');
            }}
            options={[
              { value: '', label: t('transfer.selectDatabase') },
              ...targetDatabases.map((db) => ({ value: db.name, label: db.name })),
            ]}
          />
        )}
        {targetDb && (
          <>
            <Select
              value={targetTable}
              onChange={(e) => setTargetTable(e.target.value)}
              options={[
                { value: '', label: t('transfer.selectTable') },
                ...availableTables.map((t) => ({ value: t, label: t })),
              ]}
            />
            <input
              type="text"
              placeholder={t('transfer.orEnterTableName')}
              value={targetTable}
              onChange={(e) => setTargetTable(e.target.value)}
              className="h-8 px-3 text-sm rounded-md border border-border bg-background w-full
                focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent"
            />
          </>
        )}
      </div>

      {/* Action */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleImport}
          disabled={!fileContent || !targetConn || !targetDb || !targetTable || importing}
        >
          <Upload size={14} className="mr-1.5" />
          {importing ? t('transfer.importing') : t('table.import')}
        </Button>
      </div>
    </div>
  );
}

// ─── Sync Panel ─────────────────────────────────────────────────

function SyncPanel({
  connections,
  onDone,
}: {
  connections: ReturnType<typeof useConnectionStore.getState>['connections'];
  onDone: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useTranslation();
  const [sourceConn, setSourceConn] = useState('');
  const [sourceDb, setSourceDb] = useState('');
  const [targetConn, setTargetConn] = useState('');
  const [targetDb, setTargetDb] = useState('');
  const [objects, setObjects] = useState<Set<string>>(new Set());
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState({ current: 0, total: 0, currentTable: '' });

  const sourceConnection = connections.find((c) => c.id === sourceConn);
  const sourceDatabases = sourceConnection?.databases || [];
  const selectedDb = sourceDatabases.find((db) => db.name === sourceDb);
  const availableTables = [
    ...(selectedDb?.tables || []).map((t) => t.name),
    ...(selectedDb?.collections || []).map((c) => c.name),
  ];

  const toggleObject = (name: string) => {
    setObjects((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const handleSync = async () => {
    if (!sourceConn || !sourceDb || !targetConn || !targetDb || objects.size === 0) return;
    setSyncing(true);
    const selectedTables = Array.from(objects);
    setSyncProgress({ current: 0, total: selectedTables.length, currentTable: '' });
    try {
      let successCount = 0;
      for (let i = 0; i < selectedTables.length; i++) {
        const table = selectedTables[i];
        setSyncProgress({ current: i + 1, total: selectedTables.length, currentTable: table });
        const isSourceMongo = sourceConnection?.type === 'mongodb' || sourceConnection?.type === 'mongodb_srv';
        const query = isSourceMongo
          ? JSON.stringify({ collection: table, filter: {}, limit: 100000, skip: 0 })
          : `SELECT * FROM ${table}`;
        const result = await executeQuery(sourceConnection!.type, sourceConnection!.config, query, sourceDb);
        if (result.error || result.rowCount === 0) continue;

        const sql = exportData(
          { columns: result.columns, rows: result.rows, rowCount: result.rowCount, duration: 0, success: true },
          'sql-insert',
          table
        );
        const targetConnObj = connections.find((c) => c.id === targetConn);
        const targetIsMongo = targetConnObj?.type === 'mongodb' || targetConnObj?.type === 'mongodb_srv';

        if (targetIsMongo) {
          const insertQuery = JSON.stringify({
            operation: 'insertMany',
            collection: table,
            documents: result.rows,
          });
          const res = await executeQuery(targetConnObj!.type, targetConnObj!.config, insertQuery, targetDb);
          if (!res.error) successCount++;
        } else {
          const statements = sql.split(';\n').filter((s) => s.trim());
          for (const stmt of statements) {
            const res = await executeQuery(targetConnObj!.type, targetConnObj!.config, stmt, targetDb);
            if (!res.error) successCount++;
          }
        }
      }
      onDone(t('transfer.syncSuccess', { count: successCount }), 'success');
    } catch (e) {
      onDone(`${t('transfer.syncFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setSyncing(false);
      setSyncProgress({ current: 0, total: 0, currentTable: '' });
    }
  };

  return (
    <div className="space-y-4">
      {/* Source & Target */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t('transfer.sourceConnection')}
          </label>
          <Select
            value={sourceConn}
            onChange={(e) => {
              setSourceConn(e.target.value);
              setSourceDb('');
              setObjects(new Set());
            }}
            options={[
              { value: '', label: t('transfer.selectConnection') },
              ...connections.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {sourceConn && (
            <Select
              value={sourceDb}
              onChange={(e) => {
                setSourceDb(e.target.value);
                setObjects(new Set());
              }}
              options={[
                { value: '', label: t('transfer.selectDatabase') },
                ...sourceDatabases.map((db) => ({ value: db.name, label: db.name })),
              ]}
            />
          )}
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t('transfer.targetConnection')}
          </label>
          <Select
            value={targetConn}
            onChange={(e) => {
              setTargetConn(e.target.value);
              setTargetDb('');
            }}
            options={[
              { value: '', label: t('transfer.selectConnection') },
              ...connections.map((c) => ({ value: c.id, label: c.name })),
            ]}
          />
          {targetConn && (
            <Select
              value={targetDb}
              onChange={(e) => setTargetDb(e.target.value)}
              options={[
                { value: '', label: t('transfer.selectDatabase') },
                ...(connections.find((c) => c.id === targetConn)?.databases || []).map((db) => ({
                  value: db.name,
                  label: db.name,
                })),
              ]}
            />
          )}
        </div>
      </div>

      {/* Object Selection */}
      {sourceDb && availableTables.length > 0 && (
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            {t('transfer.selectTables')}
          </label>
          <div className="border border-border rounded-lg p-2 max-h-40 overflow-y-auto">
            {availableTables.map((table) => (
              <label
                key={table}
                className="flex items-center gap-2 px-2 py-1 hover:bg-hover rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={objects.has(table)}
                  onChange={() => toggleObject(table)}
                  className="rounded border-border"
                />
                <Table size={12} className="text-muted-foreground" />
                <span className="text-xs">{table}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Progress */}
      {syncing && syncProgress.total > 0 && (
        <div className="space-y-1">
          <div className="flex justify-between text-2xs text-muted-foreground">
            <span>{t('transfer.syncProgress', { current: syncProgress.current, total: syncProgress.total })}</span>
            <span className="truncate max-w-[150px]">{syncProgress.currentTable}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(syncProgress.current / syncProgress.total) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Action */}
      <div className="flex justify-end pt-2">
        <Button
          onClick={handleSync}
          disabled={!sourceConn || !sourceDb || !targetConn || !targetDb || objects.size === 0 || syncing}
        >
          <RefreshCw size={14} className={clsx('mr-1.5', syncing && 'animate-spin')} />
          {syncing ? t('transfer.syncing') : t('transfer.startSync')}
        </Button>
      </div>
    </div>
  );
}

// ─── Schema Diff Types & Helpers ─────────────────────────────────

type ColumnDiff = {
  column: string;
  status: 'added' | 'removed' | 'modified';
  sourceDef?: string;
  targetDef?: string;
};

type TableDiff = {
  table: string;
  status: 'source-only' | 'target-only' | 'modified' | 'identical';
  columnDiffs: ColumnDiff[];
};

function quoteIdent(name: string, dbType: string): string {
  if (dbType === 'mysql' || dbType === 'mariadb') return `\`${name}\``;
  return `"${name}"`;
}

function colDefStr(col: { name: string; type: string; nullable: boolean; default_value: string | null; primary_key: boolean }): string {
  let s = `${col.name} ${col.type}`;
  if (!col.nullable) s += ' NOT NULL';
  if (col.default_value) s += ` DEFAULT ${col.default_value}`;
  if (col.primary_key) s += ' PRIMARY KEY';
  return s;
}

function generateMigrationSQL(
  diffs: TableDiff[],
  targetType: string,
): string {
  const q = (n: string) => quoteIdent(n, targetType);
  const stmts: string[] = [];

  for (const diff of diffs) {
    if (diff.status === 'source-only') {
      // Generate CREATE TABLE placeholder
      stmts.push(`-- CREATE TABLE ${q(diff.table)} (structure from source)`);
      stmts.push(`-- TODO: Generate full CREATE TABLE from source DDL`);
    } else if (diff.status === 'modified') {
      for (const col of diff.columnDiffs) {
        if (col.status === 'added' && col.sourceDef) {
          stmts.push(`ALTER TABLE ${q(diff.table)} ADD COLUMN ${q(col.column)} ${col.sourceDef};`);
        } else if (col.status === 'removed') {
          stmts.push(`ALTER TABLE ${q(diff.table)} DROP COLUMN ${q(col.column)};`);
        } else if (col.status === 'modified' && col.sourceDef) {
          if (targetType === 'mysql' || targetType === 'mariadb') {
            stmts.push(`ALTER TABLE ${q(diff.table)} MODIFY COLUMN ${q(col.column)} ${col.sourceDef};`);
          } else if (targetType === 'postgresql') {
            // PostgreSQL uses ALTER COLUMN ... TYPE / SET NOT NULL / DROP NOT NULL separately
            stmts.push(`-- ALTER TABLE ${q(diff.table)} ALTER COLUMN ${q(col.column)} TYPE ... (check manually)`);
          } else {
            stmts.push(`-- ALTER TABLE ${q(diff.table)} ALTER COLUMN ${q(col.column)} ${col.sourceDef};`);
          }
        }
      }
    }
  }
  return stmts.join('\n');
}

// ─── Schema Diff Panel ──────────────────────────────────────────

function SchemaDiffPanel({
  connections,
  onDone,
}: {
  connections: ReturnType<typeof useConnectionStore.getState>['connections'];
  onDone: (msg: string, type: 'success' | 'error') => void;
}) {
  const { t } = useTranslation();
  const [sourceConn, setSourceConn] = useState('');
  const [sourceDb, setSourceDb] = useState('');
  const [targetConn, setTargetConn] = useState('');
  const [targetDb, setTargetDb] = useState('');
  const [comparing, setComparing] = useState(false);
  const [diffs, setDiffs] = useState<TableDiff[] | null>(null);
  const [generatedSQL, setGeneratedSQL] = useState('');
  const [executing, setExecuting] = useState(false);

  const sourceConnection = connections.find((c) => c.id === sourceConn);
  const targetConnection = connections.find((c) => c.id === targetConn);
  const sourceTables = sourceConnection?.databases?.find((db) => db.name === sourceDb)?.tables || [];
  const targetTables = targetConnection?.databases?.find((db) => db.name === targetDb)?.tables || [];

  const handleCompare = async () => {
    if (!sourceConn || !sourceDb || !targetConn || !targetDb) return;
    if (!sourceConnection || !targetConnection) return;
    setComparing(true);
    setDiffs(null);
    setGeneratedSQL('');

    try {
      const srcTableNames = new Set(sourceTables.map((t) => t.name));
      const tgtTableNames = new Set(targetTables.map((t) => t.name));
      const result: TableDiff[] = [];

      // Source-only tables
      for (const name of srcTableNames) {
        if (!tgtTableNames.has(name)) {
          result.push({ table: name, status: 'source-only', columnDiffs: [] });
        }
      }

      // Target-only tables
      for (const name of tgtTableNames) {
        if (!srcTableNames.has(name)) {
          result.push({ table: name, status: 'target-only', columnDiffs: [] });
        }
      }

      // Common tables - compare columns
      const commonTables = Array.from(srcTableNames).filter((t) => tgtTableNames.has(t));
      for (const tableName of commonTables) {
        try {
          const [srcStruct, tgtStruct] = await Promise.all([
            getTableStructure(sourceConnection.type, sourceConnection.config, sourceDb, tableName),
            getTableStructure(targetConnection.type, targetConnection.config, targetDb, tableName),
          ]);

          const srcCols = new Map(srcStruct.columns.map((c) => [c.name, c]));
          const tgtCols = new Map(tgtStruct.columns.map((c) => [c.name, c]));
          const colDiffs: ColumnDiff[] = [];

          // Columns in source but not in target
          for (const [name, col] of srcCols) {
            if (!tgtCols.has(name)) {
              colDiffs.push({ column: name, status: 'added', sourceDef: colDefStr(col) });
            }
          }

          // Columns in target but not in source
          for (const [name] of tgtCols) {
            if (!srcCols.has(name)) {
              colDiffs.push({ column: name, status: 'removed', targetDef: colDefStr(tgtCols.get(name)!) });
            }
          }

          // Columns in both - check for type differences
          for (const [name, srcCol] of srcCols) {
            const tgtCol = tgtCols.get(name);
            if (!tgtCol) continue;
            const srcNorm = srcCol.type.toLowerCase().replace(/\s/g, '');
            const tgtNorm = tgtCol.type.toLowerCase().replace(/\s/g, '');
            if (srcNorm !== tgtNorm || srcCol.nullable !== tgtCol.nullable) {
              colDiffs.push({
                column: name,
                status: 'modified',
                sourceDef: colDefStr(srcCol),
                targetDef: colDefStr(tgtCol),
              });
            }
          }

          result.push({
            table: tableName,
            status: colDiffs.length > 0 ? 'modified' : 'identical',
            columnDiffs: colDiffs,
          });
        } catch {
          result.push({ table: tableName, status: 'modified', columnDiffs: [{ column: '?', status: 'modified', sourceDef: 'Error fetching structure' }] });
        }
      }

      // Sort: source-only first, then modified, then target-only, then identical
      result.sort((a, b) => {
        const order = { 'source-only': 0, 'modified': 1, 'target-only': 2, 'identical': 3 };
        return order[a.status] - order[b.status];
      });

      setDiffs(result);

      // Auto-generate migration SQL
      const sql = generateMigrationSQL(result, targetConnection.type);
      setGeneratedSQL(sql);

      const changedCount = result.filter((d) => d.status !== 'identical').length;
      onDone(t('schemaDiff.compareComplete', { total: result.length, changed: changedCount }), 'success');
    } catch (e) {
      onDone(`${t('schemaDiff.compareFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setComparing(false);
    }
  };

  const handleCopySQL = async () => {
    if (!generatedSQL) return;
    await navigator.clipboard.writeText(generatedSQL);
    onDone(t('schemaDiff.sqlCopied'), 'success');
  };

  const handleExecuteSQL = async () => {
    if (!generatedSQL || !targetConnection || !targetDb) return;
    setExecuting(true);
    try {
      const statements = generatedSQL.split('\n').filter((s) => s.trim() && !s.startsWith('--'));
      if (statements.length === 0) {
        onDone(t('schemaDiff.noExecutableSQL'), 'error');
        return;
      }
      let successCount = 0;
      for (const stmt of statements) {
        const res = await executeQuery(targetConnection.type, targetConnection.config, stmt, targetDb);
        if (!res.error) successCount++;
      }
      onDone(t('schemaDiff.executeComplete', { count: successCount }), 'success');
    } catch (e) {
      onDone(`${t('schemaDiff.executeFailed')}: ${e instanceof Error ? e.message : String(e)}`, 'error');
    } finally {
      setExecuting(false);
    }
  };

  const statusIcon = (status: string) => {
    switch (status) {
      case 'source-only': return <Plus size={12} className="text-green-500" />;
      case 'target-only': return <Minus size={12} className="text-red-500" />;
      case 'modified': return <ArrowLeftRight size={12} className="text-yellow-500" />;
      case 'identical': return <CheckCircle size={12} className="text-green-400" />;
      default: return null;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case 'source-only': return t('schemaDiff.onlyInSource');
      case 'target-only': return t('schemaDiff.onlyInTarget');
      case 'modified': return t('schemaDiff.modified');
      case 'identical': return t('schemaDiff.identical');
      default: return status;
    }
  };

  return (
    <div className="space-y-4">
      {/* Source & Target */}
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">{t('transfer.sourceConnection')}</label>
          <Select value={sourceConn} onChange={(e) => { setSourceConn(e.target.value); setSourceDb(''); setDiffs(null); }}
            options={[{ value: '', label: t('transfer.selectConnection') }, ...connections.map((c) => ({ value: c.id, label: c.name }))]}
          />
          {sourceConn && (
            <Select value={sourceDb} onChange={(e) => { setSourceDb(e.target.value); setDiffs(null); }}
              options={[{ value: '', label: t('transfer.selectDatabase') }, ...(sourceConnection?.databases || []).map((db) => ({ value: db.name, label: db.name }))]}
            />
          )}
        </div>
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">{t('transfer.targetConnection')}</label>
          <Select value={targetConn} onChange={(e) => { setTargetConn(e.target.value); setTargetDb(''); setDiffs(null); }}
            options={[{ value: '', label: t('transfer.selectConnection') }, ...connections.map((c) => ({ value: c.id, label: c.name }))]}
          />
          {targetConn && (
            <Select value={targetDb} onChange={(e) => { setTargetDb(e.target.value); setDiffs(null); }}
              options={[{ value: '', label: t('transfer.selectDatabase') }, ...(targetConnection?.databases || []).map((db) => ({ value: db.name, label: db.name }))]}
            />
          )}
        </div>
      </div>

      {/* Compare Button */}
      <div className="flex justify-center">
        <Button onClick={handleCompare} disabled={!sourceConn || !sourceDb || !targetConn || !targetDb || comparing}>
          {comparing ? <Loader2 size={14} className="mr-1.5 animate-spin" /> : <GitCompare size={14} className="mr-1.5" />}
          {comparing ? t('schemaDiff.comparing') : t('schemaDiff.compare')}
        </Button>
      </div>

      {/* Diff Results */}
      {diffs && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              {t('schemaDiff.results', { total: diffs.length })}
            </span>
            <div className="flex gap-3 text-2xs">
              <span className="flex items-center gap-1"><Plus size={10} className="text-green-500" />{diffs.filter((d) => d.status === 'source-only').length} {t('schemaDiff.onlyInSource')}</span>
              <span className="flex items-center gap-1"><ArrowLeftRight size={10} className="text-yellow-500" />{diffs.filter((d) => d.status === 'modified').length} {t('schemaDiff.modified')}</span>
              <span className="flex items-center gap-1"><Minus size={10} className="text-red-500" />{diffs.filter((d) => d.status === 'target-only').length} {t('schemaDiff.onlyInTarget')}</span>
            </div>
          </div>

          <div className="border border-border rounded-lg max-h-60 overflow-y-auto">
            {diffs.map((diff) => (
              <div key={diff.table} className={clsx(
                'border-b border-border last:border-b-0 px-3 py-2',
                diff.status === 'source-only' && 'bg-green-50/50 dark:bg-green-950/20',
                diff.status === 'target-only' && 'bg-red-50/50 dark:bg-red-950/20',
                diff.status === 'modified' && 'bg-yellow-50/50 dark:bg-yellow-950/20',
              )}>
                <div className="flex items-center gap-2">
                  {statusIcon(diff.status)}
                  <span className="text-xs font-medium flex-1">{diff.table}</span>
                  <span className="text-2xs text-muted-foreground">{statusLabel(diff.status)}</span>
                </div>
                {diff.columnDiffs.length > 0 && (
                  <div className="ml-5 mt-1 space-y-0.5">
                    {diff.columnDiffs.map((col, i) => (
                      <div key={i} className="flex items-center gap-2 text-2xs">
                        {col.status === 'added' && <Plus size={8} className="text-green-500" />}
                        {col.status === 'removed' && <Minus size={8} className="text-red-500" />}
                        {col.status === 'modified' && <ArrowLeftRight size={8} className="text-yellow-500" />}
                        <span className="font-mono">{col.column}</span>
                        {col.sourceDef && <span className="text-green-600 dark:text-green-400">{col.sourceDef}</span>}
                        {col.status === 'modified' && col.targetDef && (
                          <><span className="text-muted-foreground">←</span><span className="text-red-500 line-through">{col.targetDef}</span></>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated SQL */}
      {generatedSQL && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">{t('schemaDiff.migrationSQL')}</span>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" onClick={handleCopySQL}>
                <Copy size={12} className="mr-1" />{t('schemaDiff.copySQL')}
              </Button>
              <Button variant="ghost" size="sm" onClick={handleExecuteSQL} disabled={executing}>
                {executing ? <Loader2 size={12} className="mr-1 animate-spin" /> : <Play size={12} className="mr-1" />}
                {t('schemaDiff.executeSQL')}
              </Button>
            </div>
          </div>
          <pre className="text-2xs font-mono bg-muted p-3 rounded-lg overflow-x-auto max-h-40 overflow-y-auto whitespace-pre-wrap">
            {generatedSQL}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── Main Dialog ────────────────────────────────────────────────

export function DataTransferDialog({ open, onClose }: DataTransferDialogProps) {
  const { t } = useTranslation();
  const connections = useConnectionStore((s) => s.connections);
  const [mode, setMode] = useState<TransferMode>('export');
  const [resultMsg, setResultMsg] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const handleDone = (msg: string, type: 'success' | 'error') => {
    setResultMsg({ text: msg, type });
    setTimeout(() => setResultMsg(null), 5000);
  };

  const modes = [
    { id: 'export' as const, label: t('editor.export'), icon: Download },
    { id: 'import' as const, label: t('table.import'), icon: Upload },
    { id: 'sync' as const, label: t('transfer.sync'), icon: RefreshCw },
    { id: 'schema-diff' as const, label: t('transfer.schemaDiff'), icon: GitCompare },
  ];

  return (
    <Modal open={open} onClose={onClose} title={t('toolbar.dataTransfer')} width="max-w-2xl">
      <div className="p-4 space-y-4">
        {/* Mode Selection */}
        <div className="flex gap-2">
          {modes.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMode(m.id);
                setResultMsg(null);
              }}
              className={clsx(
                'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 transition-all text-sm',
                mode === m.id
                  ? 'border-primary bg-primary/5 text-primary'
                  : 'border-border hover:border-primary/50 text-muted-foreground'
              )}
            >
              <m.icon size={16} />
              {m.label}
            </button>
          ))}
        </div>

        {/* Panel */}
        {mode === 'export' && <ExportPanel connections={connections} onDone={handleDone} />}
        {mode === 'import' && <ImportPanel connections={connections} onDone={handleDone} />}
        {mode === 'sync' && <SyncPanel connections={connections} onDone={handleDone} />}
        {mode === 'schema-diff' && <SchemaDiffPanel connections={connections} onDone={handleDone} />}

        {/* Result Message */}
        {resultMsg && (
          <div
            className={clsx(
              'flex items-center gap-2 text-xs px-3 py-2 rounded-lg',
              resultMsg.type === 'success'
                ? 'bg-green-500/10 text-green-500'
                : 'bg-red-500/10 text-red-500'
            )}
          >
            {resultMsg.type === 'success' ? (
              <CheckCircle size={14} />
            ) : (
              <AlertCircle size={14} />
            )}
            {resultMsg.text}
          </div>
        )}

        {/* Cancel */}
        <div className="flex justify-start">
          <Button variant="outline" onClick={onClose}>
            {t('common.cancel')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
