import type { ConnectionConfig, DatabaseInfo, DatabaseType, QueryResult } from '../types/connection';
import { invoke } from '@tauri-apps/api/core';

// Parse connection URL string into config
export function parseConnectionUrl(url: string, type: DatabaseType): ConnectionConfig | null {
  try {
    switch (type) {
      case 'mysql': {
        // mysql://user:password@host:port/database
        const match = url.match(/^mysql:\/\/(?:([^:]+):([^@]*)@)?([^:/]+)?(?::(\d+))?(?:\/(.+))?/);
        if (!match) return null;
        return {
          username: match[1] || undefined,
          password: match[2] || undefined,
          host: match[3] || 'localhost',
          port: match[4] ? parseInt(match[4]) : 3306,
          database: match[5] || undefined,
          connectionString: url,
        };
      }
      case 'mariadb': {
        // mariadb://user:password@host:port/database
        const match = url.match(/^mariadb:\/\/(?:([^:]+):([^@]*)@)?([^:/]+)?(?::(\d+))?(?:\/(.+))?/);
        if (!match) return null;
        return {
          username: match[1] || undefined,
          password: match[2] || undefined,
          host: match[3] || 'localhost',
          port: match[4] ? parseInt(match[4]) : 3306,
          database: match[5] || undefined,
          connectionString: url,
        };
      }
      case 'postgresql': {
        // postgresql://user:password@host:port/database
        const match = url.match(/^postgres(?:ql)?:\/\/(?:([^:]+):([^@]*)@)?([^:/]+)?(?::(\d+))?(?:\/(.+))?/);
        if (!match) return null;
        return {
          username: match[1] || undefined,
          password: match[2] || undefined,
          host: match[3] || 'localhost',
          port: match[4] ? parseInt(match[4]) : 5432,
          database: match[5] || undefined,
          connectionString: url,
        };
      }
      case 'sqlite': {
        // sqlite:///path/to/db
        const match = url.match(/^sqlite:\/\/\/(.+)/);
        if (!match) return null;
        return { filePath: match[1], connectionString: url };
      }
      case 'duckdb': {
        // duckdb:///path/to/db
        const match = url.match(/^duckdb:\/\/\/(.+)/);
        if (!match) return null;
        return { filePath: match[1], connectionString: url };
      }
      case 'mongodb': {
        // mongodb://user:password@host:port/database?authSource=admin
        const match = url.match(/^mongodb:\/\/(?:([^:]+):([^@]*)@)?([^:/]+)?(?::(\d+))?(?:\/([^?]*))?(?:\?(.+))?/);
        if (!match) return null;
        const params = new URLSearchParams(match[6] || '');
        return {
          username: match[1] || undefined,
          password: match[2] || undefined,
          host: match[3] || 'localhost',
          port: match[4] ? parseInt(match[4]) : 27017,
          database: match[5] || undefined,
          authDatabase: params.get('authSource') || 'admin',
          replicaSet: params.get('replicaSet') || undefined,
          ssl: params.get('ssl') === 'true' || params.get('tls') === 'true',
          connectionString: url,
        };
      }
      case 'mongodb_srv': {
        // mongodb+srv://user:password@cluster.mongodb.net/database?params
        const match = url.match(/^mongodb\+srv:\/\/(?:([^:]+):([^@]*)@)?([^:/]+)(?:\/([^?]*))?(?:\?(.+))?/);
        if (!match) return null;
        const params = new URLSearchParams(match[5] || '');
        return {
          username: match[1] || undefined,
          password: match[2] || undefined,
          srvAddress: match[3],
          database: match[4] || undefined,
          authDatabase: params.get('authSource') || 'admin',
          replicaSet: params.get('replicaSet') || undefined,
          ssl: params.get('ssl') !== 'false',
          connectionString: url,
        };
      }
      case 'redis': {
        // redis://[:password@]host:port/db
        const match = url.match(/^redis:\/\/(?:([^:]+):([^@]*)@)?([^:/]+)?(?::(\d+))?(?:\/(\d+))?/);
        if (!match) return null;
        return {
          password: match[2] || undefined,
          host: match[3] || 'localhost',
          port: match[4] ? parseInt(match[4]) : 6379,
          dbNumber: match[5] ? parseInt(match[5]) : 0,
          connectionString: url,
        };
      }
      default:
        return null;
    }
  } catch {
    return null;
  }
}

// Generate connection URL from config
export function generateConnectionUrl(config: ConnectionConfig, type: DatabaseType): string {
  switch (type) {
    case 'mysql':
      return `mysql://${config.username || ''}${config.password ? ':' + config.password : ''}${config.username ? '@' : ''}${config.host || 'localhost'}:${config.port || 3306}${config.database ? '/' + config.database : ''}`;
    case 'mariadb':
      return `mariadb://${config.username || ''}${config.password ? ':' + config.password : ''}${config.username ? '@' : ''}${config.host || 'localhost'}:${config.port || 3306}${config.database ? '/' + config.database : ''}`;
    case 'postgresql':
      return `postgresql://${config.username || ''}${config.password ? ':' + config.password : ''}${config.username ? '@' : ''}${config.host || 'localhost'}:${config.port || 5432}${config.database ? '/' + config.database : ''}`;
    case 'sqlite':
      return `sqlite:///${config.filePath || ''}`;
    case 'duckdb':
      return `duckdb:///${config.filePath || ''}`;
    case 'mongodb': {
      let url = `mongodb://${config.username || ''}${config.password ? ':' + config.password : ''}${config.username ? '@' : ''}${config.host || 'localhost'}:${config.port || 27017}`;
      if (config.database) url += `/${config.database}`;
      const params: string[] = [];
      if (config.authDatabase) params.push(`authSource=${config.authDatabase}`);
      if (config.replicaSet) params.push(`replicaSet=${config.replicaSet}`);
      if (config.ssl) params.push('ssl=true');
      if (params.length) url += `?${params.join('&')}`;
      return url;
    }
    case 'mongodb_srv': {
      let url = `mongodb+srv://${config.username || ''}${config.password ? ':' + config.password : ''}${config.username ? '@' : ''}${config.srvAddress || ''}`;
      if (config.database) url += `/${config.database}`;
      const params: string[] = [];
      if (config.authDatabase && config.authDatabase !== 'admin') params.push(`authSource=${config.authDatabase}`);
      if (config.replicaSet) params.push(`replicaSet=${config.replicaSet}`);
      if (params.length) url += `?${params.join('&')}`;
      return url;
    }
    case 'redis':
      return `redis://${config.password ? ':' + config.password + '@' : ''}${config.host || 'localhost'}:${config.port || 6379}/${config.dbNumber || 0}`;
    default:
      return '';
  }
}

// Validate connection config
export function validateConnectionConfig(config: ConnectionConfig, type: DatabaseType): string[] {
  const errors: string[] = [];
  switch (type) {
    case 'mysql':
    case 'mariadb':
    case 'postgresql':
      if (!config.host) errors.push('Host is required');
      if (!config.port) errors.push('Port is required');
      break;
    case 'sqlite':
    case 'duckdb':
      if (!config.filePath) errors.push('File path is required');
      break;
    case 'mongodb':
      if (!config.host) errors.push('Host is required');
      break;
    case 'mongodb_srv':
      if (!config.srvAddress) errors.push('SRV address is required');
      break;
    case 'redis':
      if (!config.host) errors.push('Host is required');
      break;
  }
  return errors;
}

// Test connection via Tauri backend
export async function testConnection(
  type: DatabaseType,
  config: ConnectionConfig
): Promise<{ success: boolean; message: string }> {
  try {
    const message = await invoke<string>('test_connection', {
      dbType: type,
      config: config as Record<string, unknown>,
    });
    return { success: true, message };
  } catch (error) {
    return { success: false, message: String(error) };
  }
}

// List databases via Tauri backend
export async function listDatabases(
  type: DatabaseType,
  config: ConnectionConfig
): Promise<DatabaseInfo[]> {
  try {
    const result = await invoke<{ name: string; tables: { name: string }[] }[]>(
      'list_databases',
      {
        dbType: type,
        config: config as Record<string, unknown>,
      }
    );

    // Map to DatabaseInfo format
    const isNoSql = type === 'mongodb' || type === 'mongodb_srv' || type === 'redis';
    return result.map((db) => ({
      name: db.name,
      ...(isNoSql
        ? { collections: db.tables.map((t) => ({ name: t.name })) }
        : { tables: db.tables.map((t) => ({ name: t.name, columns: [], indexes: [], foreignKeys: [] })) }),
    }));
  } catch (error) {
    throw new Error(`Failed to list databases: ${error}`);
  }
}

// Execute SQL/query via Tauri backend
export async function executeQuery(
  type: DatabaseType,
  config: ConnectionConfig,
  query: string,
  database?: string
): Promise<QueryResult> {
  try {
    const result = await invoke<{
      columns: string[];
      rows: Record<string, unknown>[];
      row_count: number;
      affected_rows: number;
      duration: number;
      success: boolean;
      error: string | null;
    }>('execute_query', {
      dbType: type,
      config: config as Record<string, unknown>,
      query,
      database: database ?? null,
    });
    return {
      columns: result.columns,
      rows: result.rows,
      rowCount: result.row_count,
      affectedRows: result.affected_rows,
      duration: result.duration,
      success: result.success,
      error: result.error ?? undefined,
    };
  } catch (error) {
    return {
      columns: [],
      rows: [],
      rowCount: 0,
      duration: 0,
      success: false,
      error: String(error),
    };
  }
}

// Get table structure (columns, indexes, foreign keys)
export async function getTableStructure(
  type: DatabaseType,
  config: ConnectionConfig,
  database: string,
  table: string
): Promise<{
  columns: { name: string; type: string; length: number | null; default_value: string | null; nullable: boolean; primary_key: boolean; auto_increment: boolean; comment: string }[];
  indexes: { name: string; columns: string[]; unique: boolean; type: string }[];
  foreign_keys: { name: string; columns: string[]; referenced_table: string; referenced_columns: string[]; on_delete: string; on_update: string }[];
}> {
  return await invoke('get_table_structure', {
    dbType: type,
    config: config as Record<string, unknown>,
    database,
    table,
  });
}

// Get ER diagram data (tables + relations)
export async function getERData(
  type: DatabaseType,
  config: ConnectionConfig,
  database: string
): Promise<{
  tables: { name: string; columns: { name: string; type: string; pk: boolean; fk: string | null }[] }[];
  relations: { from_table: string; from_column: string; to_table: string; to_column: string }[];
}> {
  return await invoke('get_er_data', {
    dbType: type,
    config: config as Record<string, unknown>,
    database,
  });
}
