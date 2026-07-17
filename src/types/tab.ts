import type { DatabaseType, QueryResult } from './connection';

export type TabType = 'sql-editor' | 'table-data' | 'table-structure' | 'er-diagram' | 'mongodb-docs' | 'welcome';

export interface Tab {
  id: string;
  type: TabType;
  title: string;
  icon?: string;
  connectionId?: string;
  databaseType?: DatabaseType;
  database?: string;
  table?: string;
  schema?: string;
  isActive?: boolean;
  isDirty?: boolean;
  data?: TabData;
}

export interface TabData {
  sql?: string;
  queryResult?: QueryResult;
  columns?: string[];
  rows?: Record<string, unknown>[];
}
