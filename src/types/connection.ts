export type DatabaseType = 'mysql' | 'postgresql' | 'sqlite' | 'mongodb' | 'mongodb_srv' | 'redis';

export interface ConnectionConfig {
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  database?: string;
  schema?: string;
  authDatabase?: string;
  replicaSet?: string;
  srvAddress?: string;
  filePath?: string;
  dbNumber?: number;
  ssl?: boolean;
  sshTunnel?: SSHTunnelConfig;
  connectionString?: string;
}

export interface SSHTunnelConfig {
  enabled: boolean;
  host?: string;
  port?: number;
  username?: string;
  password?: string;
  privateKey?: string;
}

export interface Connection {
  id: string;
  name: string;
  type: DatabaseType;
  config: ConnectionConfig;
  color?: string;
  createdAt: number;
  updatedAt: number;
  isConnected?: boolean;
  databases?: DatabaseInfo[];
  aiDisabled?: boolean;
}

export interface DatabaseInfo {
  name: string;
  tables?: TableInfo[];
  views?: ViewInfo[];
  functions?: FunctionInfo[];
  procedures?: ProcedureInfo[];
  sequences?: SequenceInfo[];
  collections?: { name: string }[];
}

export interface TableInfo {
  name: string;
  schema?: string;
  rowCount?: number;
  size?: string;
  comment?: string;
  columns: ColumnInfo[];
  indexes: IndexInfo[];
  foreignKeys: ForeignKeyInfo[];
}

export interface ViewInfo {
  name: string;
  schema?: string;
  definition?: string;
}

export interface FunctionInfo {
  name: string;
  schema?: string;
  language?: string;
  returnType?: string;
}

export interface ProcedureInfo {
  name: string;
  schema?: string;
  language?: string;
}

export interface SequenceInfo {
  name: string;
  schema?: string;
  startValue?: number;
  increment?: number;
}

export interface ColumnInfo {
  name: string;
  type: string;
  length?: number;
  precision?: number;
  scale?: number;
  defaultValue?: string;
  nullable: boolean;
  primaryKey: boolean;
  autoIncrement: boolean;
  comment?: string;
}

export interface IndexInfo {
  name: string;
  columns: string[];
  unique: boolean;
  type?: string;
}

export interface ForeignKeyInfo {
  name: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  onDelete?: string;
  onUpdate?: string;
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, unknown>[];
  rowCount: number;
  affectedRows?: number;
  duration: number;
  success: boolean;
  error?: string;
}

export interface TreeNode {
  id: string;
  type: 'connection' | 'database' | 'schema' | 'group' | 'table' | 'view' | 'function' | 'procedure' | 'index' | 'sequence' | 'collection';
  label: string;
  icon?: string;
  children?: TreeNode[];
  data?: unknown;
  isExpanded?: boolean;
  isLoading?: boolean;
}

export const COLOR_OPTIONS = [
  { name: 'connection.colorBlue', value: '#3b82f6' },
  { name: 'connection.colorGreen', value: '#22c55e' },
  { name: 'connection.colorOrange', value: '#f59e0b' },
  { name: 'connection.colorRed', value: '#ef4444' },
  { name: 'connection.colorPurple', value: '#a855f7' },
  { name: 'connection.colorCyan', value: '#06b6d4' },
  { name: 'connection.colorPink', value: '#ec4899' },
  { name: 'connection.colorTeal', value: '#14b8a6' },
] as const;

export const DEFAULT_PORTS: Record<DatabaseType, number> = {
  mysql: 3306,
  postgresql: 5432,
  sqlite: 0,
  mongodb: 27017,
  mongodb_srv: 0,
  redis: 6379,
};

export const DATABASE_TYPES: { type: DatabaseType; name: string; icon: string; description: string }[] = [
  { type: 'mysql', name: 'MySQL', icon: '🐬', description: 'database.mysqlDesc' },
  { type: 'postgresql', name: 'PostgreSQL', icon: '🐘', description: 'database.postgresqlDesc' },
  { type: 'mongodb', name: 'MongoDB', icon: '🍃', description: 'database.mongodbDesc' },
  { type: 'mongodb_srv', name: 'MongoDB SRV', icon: '🍃', description: 'database.mongodbSrvDesc' },
  { type: 'sqlite', name: 'SQLite', icon: '🗄️', description: 'database.sqliteDesc' },
  { type: 'redis', name: 'Redis', icon: '🔴', description: 'database.redisDesc' },
];
