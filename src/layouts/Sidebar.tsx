import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useConnectionStore } from '../stores/connectionStore';
import { useTabStore } from '../stores/tabStore';
import { DATABASE_TYPES } from '../types/connection';
import { listDatabases, executeQuery } from '../services/connectionService';
import { exportData, downloadFile, type ExportFormat } from '../services/exportService';
import { importFromFile, type ImportFormat } from '../services/importService';
import { ConnectionDialog } from '../components/connection/ConnectionDialog';
import { useDialog } from '../components/ui/Dialog';
import { useMessage } from '../components/ui/Message';
import {
  Plus,
  Search,
  ChevronRight,
  ChevronDown,
  Database,
  Table,
  Eye,
  FunctionSquare,
  Box,
  Key,
  Hash,
  Circle,
  Edit,
  Copy,
  Trash2,
  Plug,
  PlugZap,
  FileText,
  Code,
  Trash,
  DatabaseZap,
  Download,
  Upload,
  Columns,
  Layers,
  Eraser,
  Loader2,
  BotOff,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ScrollArea } from '../components/ui/ScrollArea';
import { ContextMenu } from '../components/ui/DropdownMenu';

interface SidebarProps {
  width?: number;
}

export function Sidebar({ width = 260 }: SidebarProps) {
  const { t } = useTranslation();
  const dialog = useDialog();
  const message = useMessage();
  const connections = useConnectionStore((s) => s.connections);
  const setConnectionStatus = useConnectionStore((s) => s.setConnectionStatus);
  const setDatabases = useConnectionStore((s) => s.setDatabases);
  const removeConnection = useConnectionStore((s) => s.removeConnection);
  const duplicateConnection = useConnectionStore((s) => s.duplicateConnection);
  const getConnection = useConnectionStore((s) => s.getConnection);
  const toggleAIDisabled = useConnectionStore((s) => s.toggleAIDisabled);
  const addTab = useTabStore((s) => s.addTab);

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedConnections, setExpandedConnections] = useState<Set<string>>(new Set());
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; connectionId: string } | null>(null);
  const [objectMenu, setObjectMenu] = useState<{ x: number; y: number; tableName: string; connId: string; database?: string; connType: string } | null>(null);
  const [dbMenu, setDbMenu] = useState<{ x: number; y: number; connId: string; dbName: string; connType: string } | null>(null);
  const [connDialogOpen, setConnDialogOpen] = useState(false);
  const [editingConnection, setEditingConnection] = useState<import('../types/connection').Connection | null>(null);
  const [loadingTable, setLoadingTable] = useState<{ connId: string; dbName: string; tableName: string } | null>(null);

  const toggleConnection = (id: string) => {
    setExpandedConnections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleGroup = (key: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const handleDoubleClick = async (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return;

    if (conn.isConnected) {
      // Disconnect
      setConnectionStatus(connId, false);
      setDatabases(connId, []);
    } else {
      // Connect - load real databases from backend
      setConnectionStatus(connId, true);
      setExpandedConnections((prev) => new Set(prev).add(connId));
      try {
        const dbs = await listDatabases(conn.type, conn.config);
        setDatabases(connId, dbs);
      } catch (error) {
        setConnectionStatus(connId, false);
        console.error('Failed to connect:', error);
        message.error(`${t('connection.testFailed')}: ${error}`);
      }
    }
  };

  const handleTableDoubleClick = (tableName: string, connId: string, dbName?: string) => {
    addTab({
      type: 'table-data',
      title: tableName,
      connectionId: connId,
      database: dbName,
      table: tableName,
      data: {},
    });
  };

  const handleContextMenu = (e: React.MouseEvent, connectionId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, connectionId });
  };

  const handleConnect = async (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn) return;

    setConnectionStatus(connId, true);
    setExpandedConnections((prev) => new Set(prev).add(connId));
    try {
      const dbs = await listDatabases(conn.type, conn.config);
      setDatabases(connId, dbs);
    } catch (error) {
      setConnectionStatus(connId, false);
      console.error('Failed to connect:', error);
      message.error(`${t('connection.testFailed')}: ${error}`);
    }
  };

  const handleDisconnect = (connId: string) => {
    setConnectionStatus(connId, false);
    setDatabases(connId, []);
  };

  const handleEdit = (connId: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (conn) {
      setEditingConnection(conn);
      setConnDialogOpen(true);
    }
  };

  const handleDuplicate = (connId: string) => {
    duplicateConnection(connId);
  };

  const handleDelete = async (connId: string) => {
    const ok = await dialog.confirm(t('connection.confirmDelete'), { title: t('connection.delete'), variant: 'warning' });
    if (ok) removeConnection(connId);
  };

  const handleCreateDatabase = async (connId: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;

    // SQLite doesn't support creating databases (file-based)
    if (conn.type === 'sqlite') {
      dialog.alert(t('connection.sqliteNoCreateDb'), { title: 'SQLite', variant: 'info' });
      return;
    }
    // DuckDB doesn't support creating databases (file-based)
    if (conn.type === 'duckdb') {
      dialog.alert(t('connection.duckdbNoCreateDb'), { title: 'DuckDB', variant: 'info' });
      return;
    }
    // Redis doesn't support creating databases (fixed db0-15)
    if (conn.type === 'redis') {
      dialog.alert(t('connection.redisNoCreateDb'), { title: 'Redis', variant: 'info' });
      return;
    }

    const dbName = await dialog.prompt(t('connection.enterDbName'), { title: t('connection.createDatabase'), placeholder: 'my_database' });
    if (!dbName || !dbName.trim()) return;
    const safeName = dbName.trim().replace(/[^a-zA-Z0-9_]/g, '_');

    try {
      let query: string;
      let targetDb: string | undefined;

      if (conn.type === 'mongodb' || conn.type === 'mongodb_srv') {
        query = JSON.stringify({ operation: 'createCollection', collection: safeName });
      } else if (conn.type === 'mysql' || conn.type === 'mariadb') {
        query = `CREATE DATABASE \`${safeName}\``;
      } else if (conn.type === 'postgresql') {
        query = `CREATE DATABASE "${safeName}"`;
        targetDb = 'postgres'; // Must connect to postgres DB to create new ones
      } else {
        query = `CREATE DATABASE ${safeName}`;
      }

      const result = await executeQuery(conn.type, conn.config, query, targetDb);
      if (result.error) {
        message.error(`${t('connection.createDbFailed')}: ${result.error}`);
        return;
      }
      // Refresh database list
      const dbs = await listDatabases(conn.type, conn.config);
      setDatabases(connId, dbs);
      message.success(t('connection.createDbSuccess', { name: safeName }));
    } catch (error) {
      message.error(`${t('connection.createDbFailed')}: ${error}`);
    }
  };

  // ─── Database operations ───────────────────────────────

  const isRedis = (type: string) => type === 'redis';
  const isRedisOrSqlite = (type: string) => type === 'redis' || type === 'sqlite' || type === 'duckdb';
  const isMongoDB = (type: string) => type === 'mongodb' || type === 'mongodb_srv';
  const supportsTableStructure = (type: string) => !isRedis(type) && !isMongoDB(type);

  const handleDeleteDatabase = async (connId: string, dbName: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;
    const ok = await dialog.confirm(t('sidebar.confirmDeleteDb', { name: dbName }), { title: t('sidebar.deleteDatabase'), variant: 'warning' });
    if (!ok) return;
    try {
      const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
      const query = isMongo
        ? JSON.stringify({ operation: 'dropDatabase' })
        : (conn.type === 'mysql' || conn.type === 'mariadb')
          ? `DROP DATABASE \`${dbName}\``
          : conn.type === 'postgresql'
            ? `DROP DATABASE "${dbName}"`
            : `DROP DATABASE ${dbName}`;
      const targetDb = isMongo ? dbName : undefined;
      const result = await executeQuery(conn.type, conn.config, query, targetDb);
      if (result.error) {
        message.error(`${t('sidebar.deleteDbFailed')}: ${result.error}`);
        return;
      }
      const dbs = await listDatabases(conn.type, conn.config);
      setDatabases(connId, dbs);
      message.success(t('sidebar.deleteDbSuccess', { name: dbName }));
    } catch (error) {
      message.error(`${t('sidebar.deleteDbFailed')}: ${error}`);
    }
  };

  const handleCreateTable = async (connId: string, dbName: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;
    const tableName = await dialog.prompt(t('sidebar.enterTableName'), { title: t('sidebar.createTable'), placeholder: 'new_table' });
    if (!tableName || !tableName.trim()) return;
    const safeName = tableName.trim().replace(/[^a-zA-Z0-9_]/g, '_');
    try {
      const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
      let query: string;
      if (isMongo) {
        query = JSON.stringify({ operation: 'createCollection', collection: safeName });
      } else if (conn.type === 'mysql' || conn.type === 'mariadb') {
        query = `CREATE TABLE \`${safeName}\` (\`id\` INT NOT NULL AUTO_INCREMENT, PRIMARY KEY (\`id\`))`;
      } else if (conn.type === 'postgresql') {
        query = `CREATE TABLE "${safeName}" (id SERIAL PRIMARY KEY)`;
      } else if (conn.type === 'sqlite' || conn.type === 'duckdb') {
        query = `CREATE TABLE "${safeName}" (id INTEGER PRIMARY KEY)`;
      } else {
        query = `CREATE TABLE ${safeName} (id INT PRIMARY KEY)`;
      }
      const result = await executeQuery(conn.type, conn.config, query, dbName);
      if (result.error) {
        message.error(`${t('sidebar.createTableFailed')}: ${result.error}`);
        return;
      }
      const dbs = await listDatabases(conn.type, conn.config);
      setDatabases(connId, dbs);
      // Open structure editor for the new table
      addTab({
        type: 'table-structure',
        title: `${safeName} - Structure`,
        connectionId: connId,
        database: dbName,
        table: safeName,
        data: {},
      });
    } catch (error) {
      message.error(`${t('sidebar.createTableFailed')}: ${error}`);
    }
  };

  const handleExportDatabase = async (connId: string, dbName: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;
    const db = conn.databases?.find((d) => d.name === dbName);
    if (!db) return;
    const tables = [...(db.tables || []).map((t) => t.name), ...(db.collections || []).map((c) => c.name)];
    if (tables.length === 0) {
      dialog.alert(t('sidebar.noTablesToExport'), { title: t('sidebar.exportData'), variant: 'info' });
      return;
    }
    const exportOptions = [
      { value: 'sql-insert', label: 'SQL' },
      { value: 'json', label: 'JSON' },
      { value: 'csv', label: 'CSV' },
    ];
    const format = (await dialog.select(t('sidebar.selectExportFormat'), { title: t('sidebar.exportData'), options: exportOptions, defaultValue: 'sql-insert' })) as ExportFormat || 'sql-insert';
    try {
      const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
      for (const table of tables) {
        const query = isMongo
          ? JSON.stringify({ collection: table, filter: {}, limit: 10000, skip: 0 })
          : `SELECT * FROM ${table}`;
        const result = await executeQuery(conn.type, conn.config, query, dbName);
        if (!result.error) {
          const content = exportData(result, format, table);
          const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'sql';
          const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain';
          downloadFile(content, `${table}.${ext}`, mime);
        }
      }
      message.success(t('sidebar.exportSuccess'));
    } catch (error) {
      message.error(`${t('sidebar.exportFailed')}: ${error}`);
    }
  };

  const handleImportDatabase = async (connId: string, dbName: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.sql';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const ext = file.name.split('.').pop()?.toLowerCase();
        const format: ImportFormat = ext === 'json' ? 'json' : ext === 'csv' ? 'csv' : 'sql';
        const parsed = importFromFile(text, format);
        if (parsed.errors.length > 0 && parsed.rowCount === 0) {
          message.error(`${t('sidebar.importFailed')}: ${parsed.errors[0]}`);
          return;
        }
        const tableName = file.name.replace(/\.[^.]+$/, '').replace(/[^a-zA-Z0-9_]/g, '_');
        const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
        if (isMongo) {
          const query = JSON.stringify({
            operation: 'insertMany',
            collection: tableName,
            documents: parsed.rows,
          });
          const result = await executeQuery(conn.type, conn.config, query, dbName);
          if (result.error) throw new Error(result.error);
        } else {
          for (const row of parsed.rows) {
            const cols = parsed.columns.join(', ');
            const vals = parsed.columns.map((c) => {
              const v = row[c];
              if (v === null || v === undefined) return 'NULL';
              if (typeof v === 'number') return String(v);
              if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
              return `'${String(v).replace(/'/g, "''")}'`;
            }).join(', ');
            const sql = `INSERT INTO ${tableName} (${cols}) VALUES (${vals})`;
            const result = await executeQuery(conn.type, conn.config, sql, dbName);
            if (result.error) throw new Error(result.error);
          }
        }
        const dbs = await listDatabases(conn.type, conn.config);
        setDatabases(connId, dbs);
        message.success(t('sidebar.importSuccess', { count: parsed.rowCount }));
      } catch (error) {
        message.error(`${t('sidebar.importFailed')}: ${error}`);
      }
    };
    input.click();
  };

  // ─── Table operations ────────────────────────────────

  const handleDeleteTable = async (connId: string, dbName: string, tableName: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;
    const ok = await dialog.confirm(t('sidebar.confirmDeleteTable', { name: tableName }), { title: t('sidebar.deleteTable'), variant: 'warning' });
    if (!ok) return;
    try {
      const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
      let query: string;
      if (isMongo) {
        query = JSON.stringify({ operation: 'dropCollection', collection: tableName });
      } else if (conn.type === 'mysql' || conn.type === 'mariadb') {
        query = `DROP TABLE \`${tableName}\``;
      } else {
        query = `DROP TABLE "${tableName}"`;
      }
      const result = await executeQuery(conn.type, conn.config, query, dbName);
      if (result.error) {
        message.error(`${t('sidebar.deleteTableFailed')}: ${result.error}`);
        return;
      }
      const dbs = await listDatabases(conn.type, conn.config);
      setDatabases(connId, dbs);
      message.success(t('sidebar.deleteTableSuccess', { name: tableName }));
    } catch (error) {
      message.error(`${t('sidebar.deleteTableFailed')}: ${error}`);
    }
  };

  const handleTruncateTable = async (connId: string, dbName: string, tableName: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;
    const ok = await dialog.confirm(t('sidebar.confirmTruncateTable', { name: tableName }), { title: t('sidebar.truncateTable'), variant: 'warning' });
    if (!ok) return;
    setLoadingTable({ connId, dbName, tableName });
    try {
      const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
      let query: string;
      if (isMongo) {
        query = JSON.stringify({ operation: 'deleteMany', collection: tableName, filter: {} });
      } else if (conn.type === 'mysql' || conn.type === 'mariadb') {
        query = `TRUNCATE TABLE \`${tableName}\``;
      } else {
        query = `TRUNCATE TABLE "${tableName}"`;
      }
      const result = await executeQuery(conn.type, conn.config, query, dbName);
      if (result.error) {
        message.error(`${t('sidebar.truncateTableFailed')}: ${result.error}`);
        return;
      }
      message.success(t('sidebar.truncateTableSuccess', { name: tableName }));
    } catch (error) {
      message.error(`${t('sidebar.truncateTableFailed')}: ${error}`);
    } finally {
      setLoadingTable(null);
    }
  };

  const handleExportTable = async (connId: string, dbName: string, tableName: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;
    const exportOptions = [
      { value: 'sql-insert', label: 'SQL' },
      { value: 'json', label: 'JSON' },
      { value: 'csv', label: 'CSV' },
    ];
    const format = (await dialog.select(t('sidebar.selectExportFormat'), { title: t('sidebar.exportData'), options: exportOptions, defaultValue: 'sql-insert' })) as ExportFormat || 'sql-insert';
    try {
      const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
      const query = isMongo
        ? JSON.stringify({ collection: tableName, filter: {}, limit: 10000, skip: 0 })
        : `SELECT * FROM ${tableName}`;
      const result = await executeQuery(conn.type, conn.config, query, dbName);
      if (result.error) throw new Error(result.error);
      const content = exportData(result, format, tableName);
      const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'sql';
      const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain';
      downloadFile(content, `${tableName}_${Date.now()}.${ext}`, mime);
      message.success(t('sidebar.exportSuccess'));
    } catch (error) {
      message.error(`${t('sidebar.exportFailed')}: ${error}`);
    }
  };

  const handleImportTable = async (connId: string, dbName: string, tableName: string) => {
    const conn = getConnection(connId);
    if (!conn || !conn.isConnected) return;
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.csv,.sql';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const ext = file.name.split('.').pop()?.toLowerCase();
        const format: ImportFormat = ext === 'json' ? 'json' : ext === 'csv' ? 'csv' : 'sql';
        const parsed = importFromFile(text, format);
        if (parsed.errors.length > 0 && parsed.rowCount === 0) {
          message.error(`${t('sidebar.importFailed')}: ${parsed.errors[0]}`);
          return;
        }
        const isMongo = conn.type === 'mongodb' || conn.type === 'mongodb_srv';
        if (isMongo) {
          const query = JSON.stringify({
            operation: 'insertMany',
            collection: tableName,
            documents: parsed.rows,
          });
          const result = await executeQuery(conn.type, conn.config, query, dbName);
          if (result.error) throw new Error(result.error);
        } else {
          for (const row of parsed.rows) {
            const cols = parsed.columns.join(', ');
            const vals = parsed.columns.map((c) => {
              const v = row[c];
              if (v === null || v === undefined) return 'NULL';
              if (typeof v === 'number') return String(v);
              if (typeof v === 'boolean') return v ? 'TRUE' : 'FALSE';
              return `'${String(v).replace(/'/g, "''")}'`;
            }).join(', ');
            const sql = `INSERT INTO ${tableName} (${cols}) VALUES (${vals})`;
            const result = await executeQuery(conn.type, conn.config, sql, dbName);
            if (result.error) throw new Error(result.error);
          }
        }
        message.success(t('sidebar.importSuccess', { count: parsed.rowCount }));
      } catch (error) {
        message.error(`${t('sidebar.importFailed')}: ${error}`);
      }
    };
    input.click();
  };

  const filteredConnections = connections.filter((conn) => {
    const q = searchQuery.toLowerCase();
    if (conn.name.toLowerCase().includes(q)) return true;
    // Match database names and their children
    if (conn.databases?.some((db) => {
      if (db.name.toLowerCase().includes(q)) return true;
      if (db.tables?.some((t) => t.name.toLowerCase().includes(q))) return true;
      if (db.views?.some((v) => v.name.toLowerCase().includes(q))) return true;
      if (db.functions?.some((f) => f.name.toLowerCase().includes(q))) return true;
      if (db.collections?.some((c) => c.name.toLowerCase().includes(q))) return true;
      return false;
    })) return true;
    return false;
  });

  // Database type badge: short label + brand color
  const dbTypeBadge = (type: string) => {
    switch (type) {
      case 'mysql':      return { label: 'My', color: '#00758f' };
      case 'mariadb':    return { label: 'Ma', color: '#003545' };
      case 'postgresql': return { label: 'Pg', color: '#336791' };
      case 'mongodb':
      case 'mongodb_srv': return { label: 'Mo', color: '#47A248' };
      case 'sqlite':     return { label: 'SL', color: '#0F80AA' };
      case 'duckdb':     return { label: 'Dk', color: '#FFF000' };
      case 'redis':      return { label: 'Rd', color: '#DC382D' };
      default:           return { label: 'DB', color: '#6b7280' };
    }
  };

  // Group connections by type
  const groupedConnections = DATABASE_TYPES.map((dbType) => ({
    ...dbType,
    connections: filteredConnections.filter((c) => c.type === dbType.type),
  })).filter((group) => group.connections.length > 0);

  return (
    <div className="flex flex-col bg-sidebar border-r border-sidebar-border h-full overflow-hidden" style={{ width: `${width}px`, minWidth: '180px', maxWidth: '400px' }}>
      {/* Sidebar Header */}
      <div className="p-2 border-b border-sidebar-border">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-sidebar-foreground uppercase tracking-wider">
            {t('sidebar.connections')}
          </span>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setConnDialogOpen(true)}>
            <Plus size={14} />
          </Button>
        </div>
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder={t('sidebar.search')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-7 pl-7 pr-2 text-xs rounded border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
      </div>

      {/* Connection Tree */}
      <ScrollArea className="flex-1 overflow-x-hidden">
        <div className="py-1">
          {groupedConnections.length === 0 ? (
            <div className="px-3 py-8 text-center">
              <Database size={32} className="mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">{t('sidebar.noConnections')}</p>
              <p className="text-2xs text-muted-foreground/70 mt-1">{t('sidebar.clickToAdd')}</p>
            </div>
          ) : (
            groupedConnections.map((group) => (
              <div key={group.type}>
                {group.connections.map((conn) => (
                  <div key={conn.id}>
                    <div
                      className="flex items-center gap-1 px-2 py-1 cursor-pointer hover:bg-hover rounded-sm mx-1 group min-w-0"
                      onContextMenu={(e) => handleContextMenu(e, conn.id)}
                      onClick={() => toggleConnection(conn.id)}
                      onDoubleClick={() => handleDoubleClick(conn.id)}
                    >
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: conn.color || '#3b82f6' }}
                      />
                      {expandedConnections.has(conn.id) ? (
                        <ChevronDown size={12} className="text-muted-foreground flex-shrink-0" />
                      ) : (
                        <ChevronRight size={12} className="text-muted-foreground flex-shrink-0" />
                      )}
                      <span
                        className="text-2xs font-bold px-1 py-0 rounded flex-shrink-0"
                        style={{ color: dbTypeBadge(conn.type).color, backgroundColor: `${dbTypeBadge(conn.type).color}15` }}
                      >
                        {dbTypeBadge(conn.type).label}
                      </span>
                      <span className="text-xs truncate flex-1 min-w-0">{conn.name}</span>
                      {conn.isConnected && (
                        <Circle size={8} className="text-green-500 fill-green-500 flex-shrink-0" />
                      )}
                      {conn.aiDisabled && (
                        <span title={t('connection.aiDisabledHint')}>
                          <BotOff size={10} className="text-muted-foreground/50 flex-shrink-0" />
                        </span>
                      )}
                    </div>

                    {/* Expanded Tree */}
                    {expandedConnections.has(conn.id) && conn.isConnected && (
                      <div className="ml-4 border-l border-border/50 min-w-0 overflow-hidden">
                        {(conn.databases || []).map((db) => (
                          <div key={db.name}>
                            <div
                              className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-hover rounded-sm mx-1 text-xs min-w-0"
                              onClick={() => toggleGroup(`${conn.id}-${db.name}`)}
                              onContextMenu={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                setDbMenu({ x: e.clientX, y: e.clientY, connId: conn.id, dbName: db.name, connType: conn.type });
                              }}
                            >
                              {expandedGroups.has(`${conn.id}-${db.name}`) ? (
                                <ChevronDown size={10} className="text-muted-foreground flex-shrink-0" />
                              ) : (
                                <ChevronRight size={10} className="text-muted-foreground flex-shrink-0" />
                              )}
                              <span className="text-muted-foreground flex-shrink-0"><Database size={12} /></span>
                              <span className="truncate flex-1 min-w-0">{db.name}</span>
                            </div>

                            {expandedGroups.has(`${conn.id}-${db.name}`) && (
                              <div className="ml-4 min-w-0 overflow-hidden">
                                {/* Collections (for MongoDB / Redis) */}
                                {db.collections && db.collections.length > 0 && (
                                  <TreeGroup
                                    icon={<Layers size={12} />}
                                    label={t('sidebar.collections')}
                                    count={db.collections.length}
                                    expanded={expandedGroups.has(`${conn.id}-${db.name}-collections`)}
                                    onToggle={() => toggleGroup(`${conn.id}-${db.name}-collections`)}
                                  >
                                    {db.collections.map((col) => (
                                      <TreeItem
                                        key={col.name}
                                        icon={<Box size={12} />}
                                        label={col.name}
                                        onDoubleClick={() => handleTableDoubleClick(col.name, conn.id, db.name)}
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setObjectMenu({ x: e.clientX, y: e.clientY, tableName: col.name, connId: conn.id, database: db.name, connType: conn.type });
                                        }}
                                      />
                                    ))}
                                  </TreeGroup>
                                )}

                                {/* Tables Group */}
                                {db.tables && db.tables.length > 0 && (
                                  <TreeGroup
                                    icon={<Table size={12} />}
                                    label={t('sidebar.tables')}
                                    count={db.tables.length}
                                    expanded={expandedGroups.has(`${conn.id}-${db.name}-tables`)}
                                    onToggle={() => toggleGroup(`${conn.id}-${db.name}-tables`)}
                                  >
                                    {db.tables.map((table) => (
                                      <TreeItem
                                        key={table.name}
                                        icon={<Columns size={12} />}
                                        label={table.name}
                                        loading={loadingTable?.connId === conn.id && loadingTable?.dbName === db.name && loadingTable?.tableName === table.name}
                                        onDoubleClick={() => handleTableDoubleClick(table.name, conn.id, db.name)}
                                        onContextMenu={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          setObjectMenu({ x: e.clientX, y: e.clientY, tableName: table.name, connId: conn.id, database: db.name, connType: conn.type });
                                        }}
                                      />
                                    ))}
                                  </TreeGroup>
                                )}

                                {/* Views Group */}
                                {db.views && db.views.length > 0 && (
                                  <TreeGroup
                                    icon={<Eye size={12} />}
                                    label={t('sidebar.views')}
                                    count={db.views.length}
                                    expanded={expandedGroups.has(`${conn.id}-${db.name}-views`)}
                                    onToggle={() => toggleGroup(`${conn.id}-${db.name}-views`)}
                                  >
                                    {db.views.map((view) => (
                                      <TreeItem
                                        key={view.name}
                                        icon={<Eye size={12} />}
                                        label={view.name}
                                      />
                                    ))}
                                  </TreeGroup>
                                )}

                                {/* Functions Group */}
                                {db.functions && db.functions.length > 0 && (
                                  <TreeGroup
                                    icon={<FunctionSquare size={12} />}
                                    label={t('sidebar.functions')}
                                    count={db.functions.length}
                                    expanded={expandedGroups.has(`${conn.id}-${db.name}-functions`)}
                                    onToggle={() => toggleGroup(`${conn.id}-${db.name}-functions`)}
                                  >
                                    {db.functions.map((func) => (
                                      <TreeItem
                                        key={func.name}
                                        icon={<FunctionSquare size={12} />}
                                        label={func.name}
                                      />
                                    ))}
                                  </TreeGroup>
                                )}

                                {/* Other groups */}
                                <TreeItem icon={<Box size={12} />} label={t('sidebar.procedures')} />
                                <TreeItem icon={<Key size={12} />} label={t('sidebar.indexes')} />
                                <TreeItem icon={<Hash size={12} />} label={t('sidebar.sequences')} />
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          items={[
            {
              label: t('connection.connect'),
              icon: <Plug size={12} />,
              onClick: () => handleConnect(contextMenu.connectionId),
            },
            {
              label: t('connection.disconnect'),
              icon: <PlugZap size={12} />,
              onClick: () => handleDisconnect(contextMenu.connectionId),
            },
            ...(connections.find((c) => c.id === contextMenu.connectionId)?.isConnected
              && !isRedisOrSqlite(connections.find((c) => c.id === contextMenu.connectionId)?.type || '')
              ? [
                  { separator: true, label: '' },
                  {
                    label: t('connection.createDatabase'),
                    icon: <DatabaseZap size={12} />,
                    onClick: () => handleCreateDatabase(contextMenu.connectionId),
                  },
                ]
              : []),
            { separator: true, label: '' },
            {
              label: t('connection.edit'),
              icon: <Edit size={12} />,
              onClick: () => handleEdit(contextMenu.connectionId),
            },
            {
              label: t('connection.duplicate'),
              icon: <Copy size={12} />,
              onClick: () => handleDuplicate(contextMenu.connectionId),
            },
            {
              label: connections.find((c) => c.id === contextMenu.connectionId)?.aiDisabled
                ? t('connection.enableAI')
                : t('connection.disableAI'),
              icon: <BotOff size={12} />,
              onClick: () => toggleAIDisabled(contextMenu.connectionId),
            },
            { separator: true, label: '' },
            {
              label: t('connection.delete'),
              icon: <Trash2 size={12} />,
              danger: true,
              onClick: () => handleDelete(contextMenu.connectionId),
            },
          ]}
        />
      )}

      {/* Object Context Menu (Table) */}
      {objectMenu && !isRedis(objectMenu.connType) && (
        <ContextMenu
          x={objectMenu.x}
          y={objectMenu.y}
          onClose={() => setObjectMenu(null)}
          items={[
            {
              label: t('sidebar.openTable'),
              icon: <Table size={12} />,
              onClick: () => handleTableDoubleClick(objectMenu.tableName, objectMenu.connId, objectMenu.database),
            },
            {
              label: t('sidebar.viewStructure'),
              icon: <Code size={12} />,
              onClick: () => {
                addTab({
                  type: 'table-structure',
                  title: `${objectMenu.tableName} - Structure`,
                  connectionId: objectMenu.connId,
                  database: objectMenu.database,
                  table: objectMenu.tableName,
                  data: {},
                });
              },
              hidden: !supportsTableStructure(objectMenu.connType),
            },
            {
              label: t('sidebar.generateSql'),
              icon: <FileText size={12} />,
              onClick: () => {
                addTab({
                  type: 'sql-editor',
                  title: t('toolbar.newQuery'),
                  connectionId: objectMenu.connId,
                  database: objectMenu.database,
                  data: { sql: `SELECT * FROM ${objectMenu.tableName};` },
                });
              },
            },
            { separator: true, label: '' },
            {
              label: t('sidebar.importData'),
              icon: <Upload size={12} />,
              onClick: () => handleImportTable(objectMenu.connId, objectMenu.database || '', objectMenu.tableName),
            },
            {
              label: t('sidebar.exportData'),
              icon: <Download size={12} />,
              onClick: () => handleExportTable(objectMenu.connId, objectMenu.database || '', objectMenu.tableName),
            },
            { separator: true, label: '' },
            {
              label: t('sidebar.truncateTable'),
              icon: <Eraser size={12} />,
              danger: true,
              onClick: () => handleTruncateTable(objectMenu.connId, objectMenu.database || '', objectMenu.tableName),
            },
            {
              label: t('sidebar.deleteTable'),
              icon: <Trash size={12} />,
              danger: true,
              onClick: () => handleDeleteTable(objectMenu.connId, objectMenu.database || '', objectMenu.tableName),
            },
          ]}
        />
      )}

      {/* Database Context Menu */}
      {dbMenu && !isRedis(dbMenu.connType) && (
        <ContextMenu
          x={dbMenu.x}
          y={dbMenu.y}
          onClose={() => setDbMenu(null)}
          items={[
            {
              label: t('sidebar.createTable'),
              icon: <Columns size={12} />,
              onClick: () => handleCreateTable(dbMenu.connId, dbMenu.dbName),
            },
            { separator: true, label: '' },
            {
              label: t('sidebar.importData'),
              icon: <Upload size={12} />,
              onClick: () => handleImportDatabase(dbMenu.connId, dbMenu.dbName),
            },
            {
              label: t('sidebar.exportData'),
              icon: <Download size={12} />,
              onClick: () => handleExportDatabase(dbMenu.connId, dbMenu.dbName),
            },
            ...(!isRedisOrSqlite(dbMenu.connType)
              ? [
                  { separator: true, label: '' },
                  {
                    label: t('sidebar.deleteDatabase'),
                    icon: <Trash2 size={12} />,
                    danger: true,
                    onClick: () => handleDeleteDatabase(dbMenu.connId, dbMenu.dbName),
                  },
                ]
              : []),
          ]}
        />
      )}

      {/* Connection Dialog */}
      <ConnectionDialog
        open={connDialogOpen}
        onClose={() => {
          setConnDialogOpen(false);
          setEditingConnection(null);
        }}
        editConnection={editingConnection || undefined}
      />
    </div>
  );
}

function TreeItem({
  icon,
  label,
  badge,
  loading,
  onDoubleClick,
  onContextMenu,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  loading?: boolean;
  onDoubleClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  return (
    <div
      className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-hover rounded-sm mx-1 text-xs min-w-0"
      onDoubleClick={onDoubleClick}
      onContextMenu={onContextMenu}
    >
      <span className="text-muted-foreground flex-shrink-0">{icon}</span>
      <span className="truncate flex-1 min-w-0">{label}</span>
      {loading && <Loader2 size={12} className="text-primary animate-spin flex-shrink-0" />}
      {badge && (
        <span className="text-2xs text-muted-foreground bg-muted px-1 rounded">{badge}</span>
      )}
    </div>
  );
}

function TreeGroup({
  icon,
  label,
  count,
  expanded,
  onToggle,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div
        className="flex items-center gap-1.5 px-2 py-0.5 cursor-pointer hover:bg-hover rounded-sm mx-1 text-xs"
        onClick={onToggle}
      >
        {expanded ? (
          <ChevronDown size={10} className="text-muted-foreground flex-shrink-0" />
        ) : (
          <ChevronRight size={10} className="text-muted-foreground flex-shrink-0" />
        )}
        <span className="text-muted-foreground flex-shrink-0">{icon}</span>
        <span className="truncate flex-1 min-w-0">{label}</span>
        <span className="text-2xs text-muted-foreground bg-muted px-1 rounded flex-shrink-0">{count}</span>
      </div>
      {expanded && <div className="ml-4 min-w-0 overflow-hidden">{children}</div>}
    </div>
  );
}
