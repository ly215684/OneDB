import type { AISettings } from '../types/settings';
import type { Connection } from '../types/connection';
import { invoke } from '@tauri-apps/api/core';

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
}

interface ToolCall {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
}

interface StreamCallbacks {
  onToken: (token: string) => void;
  onComplete: () => void;
  onError: (error: string) => void;
  onToolCall?: (status: string) => void;
  onWriteConfirm?: (info: { connection: string; database: string; query: string }) => Promise<boolean>;
}

const SYSTEM_PROMPT = `You are an expert database assistant integrated into OneDB, a database management tool. You help users with:

1. **SQL Generation**: Write accurate SQL queries based on natural language descriptions
2. **SQL Explanation**: Break down complex SQL queries and explain each part
3. **SQL Optimization**: Suggest performance improvements, index recommendations, and query rewrites
4. **Error Fixing**: Identify and fix SQL syntax errors and logical issues
5. **Database Design**: Advise on schema design, normalization, and best practices
6. **Database Exploration**: Use the provided tools to explore database structure and data

Supported databases: MySQL, PostgreSQL, SQLite, MongoDB, Redis.

Guidelines:
- Always specify which database dialect you're using when writing SQL
- When generating SQL, wrap the final query in a code block with \`\`\`sql
- When generating MongoDB queries, wrap the final query in a code block with \`\`\`json
- Keep explanations concise but informative
- If the user's request is ambiguous, ask clarifying questions
- For Redis, use Redis CLI commands
- Use the available tools to explore the database before answering questions about schema or data
- When user asks about tables or schema, use describe_table tool first

MongoDB Query Format (MUST follow this exact JSON structure):
\`\`\`json
{"collection": "collection_name", "operation": "find", "filter": {}, "limit": 100}
\`\`\`

Supported MongoDB operations:
- find: {"collection": "...", "operation": "find", "filter": {...}, "limit": 100, "skip": 0}
- insertOne: {"collection": "...", "operation": "insertOne", "document": {...}}
- insertMany: {"collection": "...", "operation": "insertMany", "documents": [{...}, {...}]}
- updateMany: {"collection": "...", "operation": "updateMany", "filter": {...}, "update": {...}}
- deleteMany: {"collection": "...", "operation": "deleteMany", "filter": {...}}
- count: {"collection": "...", "operation": "count", "filter": {...}}
- aggregate: {"collection": "...", "operation": "aggregate", "pipeline": [{...}]}

Format your SQL output like:
\`\`\`sql
SELECT ...
\`\`\`

Respond in the same language as the user's question.`;

// ─── MCP Tool Definitions ──────────────────────────────────────────

const MCP_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'list_connections',
      description: 'List all connected database connections with their types (mysql/postgresql/sqlite/mongodb/redis)',
      parameters: { type: 'object', properties: {}, required: [] },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_databases',
      description: 'List all databases for a specific connection',
      parameters: {
        type: 'object',
        properties: { connection_id: { type: 'string', description: 'The connection ID from list_connections' } },
        required: ['connection_id'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'list_tables',
      description: 'List all tables or collections in a database',
      parameters: {
        type: 'object',
        properties: {
          connection_id: { type: 'string', description: 'The connection ID' },
          database: { type: 'string', description: 'The database name' },
        },
        required: ['connection_id', 'database'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'describe_table',
      description: 'Get table structure. SQL databases: columns/indexes/foreign keys. MongoDB: inferred schema from sample documents. Redis: key type and TTL info.',
      parameters: {
        type: 'object',
        properties: {
          connection_id: { type: 'string', description: 'The connection ID' },
          database: { type: 'string', description: 'The database name' },
          table: { type: 'string', description: 'The table or collection name' },
        },
        required: ['connection_id', 'database', 'table'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'execute_query',
      description: 'Execute a database query. SQL: SELECT statements only. MongoDB: JSON format {"collection":"...","operation":"find|count|aggregate",...}. Redis: read-only commands (GET/KEYS/SCAN/TYPE etc). Write operations require user confirmation.',
      parameters: {
        type: 'object',
        properties: {
          connection_id: { type: 'string', description: 'The connection ID' },
          database: { type: 'string', description: 'The database name' },
          query: { type: 'string', description: 'The query to execute' },
        },
        required: ['connection_id', 'database', 'query'],
      },
    },
  },
];

// ─── Write Operation Detection ────────────────────────────────────

const SQL_WRITE_KEYWORDS = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'CREATE', 'RENAME', 'REPLACE', 'MERGE'];
const MONGODB_WRITE_OPS = ['insertOne', 'insertMany', 'updateMany', 'updateOne', 'deleteMany', 'deleteOne', 'dropCollection', 'dropDatabase', 'createCollection'];
const REDIS_WRITE_COMMANDS = ['SET', 'HSET', 'LPUSH', 'RPUSH', 'DEL', 'SADD', 'SREM', 'ZADD', 'ZREM', 'EXPIRE', 'RENAME', 'FLUSHDB', 'FLUSHALL', 'MSET', 'INCR', 'DECR', 'APPEND', 'SETEX', 'SETNX', 'HDEL', 'HMSET', 'LPOP', 'RPOP', 'LTRIM', 'MOVE', 'PERSIST', 'PEXPIRE', 'PTTL', 'RESTORE', 'SORT', 'UNLINK'];

function isWriteOperation(dbType: string, query: string): boolean {
  const trimmed = query.trim();

  if (dbType === 'mongodb' || dbType === 'mongodb_srv') {
    try {
      const parsed = JSON.parse(trimmed);
      const op = parsed.operation || 'find';
      return MONGODB_WRITE_OPS.includes(op);
    } catch {
      return false;
    }
  }

  if (dbType === 'redis') {
    const firstWord = trimmed.split(/\s+/)[0].toUpperCase();
    return REDIS_WRITE_COMMANDS.includes(firstWord);
  }

  // SQL databases
  const upper = trimmed.toUpperCase();
  return SQL_WRITE_KEYWORDS.some((kw) => {
    const regex = new RegExp(`^\\s*${kw}\\b`, 'i');
    return regex.test(upper);
  });
}

// ─── Tool Execution ────────────────────────────────────────────────

async function executeToolCall(
  toolName: string,
  args: Record<string, string>,
  connections: Connection[],
  onWriteConfirm?: (info: { connection: string; database: string; query: string }) => Promise<boolean>,
): Promise<string> {
  try {
    switch (toolName) {
      case 'list_connections': {
        const connected = connections
          .filter((c) => c.isConnected)
          .map((c) => ({ id: c.id, name: c.name, type: c.type }));
        return JSON.stringify(connected.length > 0 ? connected : { message: 'No active connections. Please connect to a database first.' });
      }

      case 'list_databases': {
        const conn = connections.find((c) => c.id === args.connection_id);
        if (!conn) return JSON.stringify({ error: `Connection '${args.connection_id}' not found` });
        const result = await invoke<{ name: string; tables: { name: string }[] }[]>('list_databases', {
          dbType: conn.type,
          config: conn.config as Record<string, unknown>,
        });
        return JSON.stringify(result.map((db) => ({ name: db.name, table_count: db.tables.length })));
      }

      case 'list_tables': {
        const conn = connections.find((c) => c.id === args.connection_id);
        if (!conn) return JSON.stringify({ error: `Connection '${args.connection_id}' not found` });
        // Try to get from cached databases first
        const dbInfo = conn.databases?.find((d) => d.name === args.database);
        if (dbInfo) {
          const tables = dbInfo.tables?.map((t) => t.name) || [];
          const collections = dbInfo.collections?.map((c) => c.name) || [];
          return JSON.stringify({ tables: [...tables, ...collections] });
        }
        // Fallback: query backend
        const result = await invoke<{ name: string; tables: { name: string }[] }[]>('list_databases', {
          dbType: conn.type,
          config: conn.config as Record<string, unknown>,
        });
        const db = result.find((d) => d.name === args.database);
        return JSON.stringify({ tables: db?.tables.map((t) => t.name) || [] });
      }

      case 'describe_table': {
        const conn = connections.find((c) => c.id === args.connection_id);
        if (!conn) return JSON.stringify({ error: `Connection '${args.connection_id}' not found` });

        if (conn.type === 'mongodb' || conn.type === 'mongodb_srv') {
          // Sample documents and infer schema
          const sampleQuery = JSON.stringify({ collection: args.table, operation: 'find', filter: {}, limit: 10 });
          const result = await invoke<{ columns: string[]; rows: Record<string, unknown>[]; row_count: number }>('execute_query', {
            dbType: conn.type,
            config: conn.config as Record<string, unknown>,
            query: sampleQuery,
            database: args.database,
          });
          const schema = inferMongoSchema(result.rows);
          return JSON.stringify({ type: 'mongodb', collection: args.table, document_count_sampled: result.row_count, schema });
        }

        if (conn.type === 'redis') {
          const typeResult = await invoke<{ columns: string[]; rows: Record<string, unknown>[] }>('execute_query', {
            dbType: conn.type,
            config: conn.config as Record<string, unknown>,
            query: `TYPE ${args.table}`,
            database: args.database,
          });
          const ttlResult = await invoke<{ columns: string[]; rows: Record<string, unknown>[] }>('execute_query', {
            dbType: conn.type,
            config: conn.config as Record<string, unknown>,
            query: `TTL ${args.table}`,
            database: args.database,
          });
          return JSON.stringify({ type: 'redis', key: args.table, key_type: typeResult.rows[0]?.result, ttl: ttlResult.rows[0]?.result });
        }

        // SQL databases: use get_table_structure
        const structure = await invoke<{ columns: { name: string; type: string; nullable: boolean; primary_key: boolean; auto_increment: boolean; default_value: string | null; comment: string }[]; indexes: { name: string; columns: string[]; unique: boolean }[]; foreign_keys: { name: string; columns: string[]; referenced_table: string; referenced_columns: string[]; on_delete: string; on_update: string }[] }>('get_table_structure', {
          dbType: conn.type,
          config: conn.config as Record<string, unknown>,
          database: args.database,
          table: args.table,
        });
        return JSON.stringify(structure);
      }

      case 'execute_query': {
        const conn = connections.find((c) => c.id === args.connection_id);
        if (!conn) return JSON.stringify({ error: `Connection '${args.connection_id}' not found` });

        // Check if write operation
        if (isWriteOperation(conn.type, args.query)) {
          if (!onWriteConfirm) {
            return JSON.stringify({ error: 'Write operations require user confirmation. Operation cancelled.' });
          }
          const confirmed = await onWriteConfirm({
            connection: conn.name,
            database: args.database,
            query: args.query,
          });
          if (!confirmed) {
            return JSON.stringify({ error: 'User cancelled the write operation' });
          }
        }

        const result = await invoke<{
          columns: string[];
          rows: Record<string, unknown>[];
          row_count: number;
          affected_rows: number;
          duration: number;
          success: boolean;
          error: string | null;
        }>('execute_query', {
          dbType: conn.type,
          config: conn.config as Record<string, unknown>,
          query: args.query,
          database: args.database,
        });

        // Limit result size for AI context
        const limitedRows = result.rows.slice(0, 100);
        return JSON.stringify({
          columns: result.columns,
          rows: limitedRows,
          row_count: result.row_count,
          affected_rows: result.affected_rows,
          duration: result.duration,
          truncated: result.rows.length > 100,
        });
      }

      default:
        return JSON.stringify({ error: `Unknown tool: ${toolName}` });
    }
  } catch (err) {
    return JSON.stringify({ error: err instanceof Error ? err.message : String(err) });
  }
}

// ─── MongoDB Schema Inference ──────────────────────────────────────

function inferMongoSchema(rows: Record<string, unknown>[]): Record<string, { type: string; example?: string }> {
  const schema: Record<string, { types: Set<string>; example?: string }> = {};
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!schema[key]) schema[key] = { types: new Set() };
      const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
      schema[key].types.add(type);
      if (!schema[key].example && value !== null && value !== undefined) {
        const str = String(value);
        schema[key].example = str.length > 50 ? str.slice(0, 50) + '...' : str;
      }
    }
  }
  const result: Record<string, { type: string; example?: string }> = {};
  for (const [key, val] of Object.entries(schema)) {
    result[key] = { type: Array.from(val.types).join('|'), example: val.example };
  }
  return result;
}

// ─── Chat Stream with Function Calling ─────────────────────────────

export async function chatStream(
  messages: { role: 'user' | 'assistant'; content: string }[],
  settings: AISettings,
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  connections: Connection[] = [],
): Promise<void> {
  if (!settings.apiKey) {
    callbacks.onError('API Key not configured. Please set your API key in Settings > AI.');
    return;
  }

  if (!settings.enabled) {
    callbacks.onError('AI assistant is disabled. Enable it in Settings > AI.');
    return;
  }

  const baseUrl = settings.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  const chatMessages: ChatMessage[] = [
    { role: 'system', content: SYSTEM_PROMPT },
    ...messages.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
  ];

  const timeoutController = new AbortController();
  const timeoutId = setTimeout(() => timeoutController.abort(), 120000);

  let effectiveSignal: AbortSignal;
  if (signal) {
    signal.addEventListener('abort', () => timeoutController.abort());
    effectiveSignal = timeoutController.signal;
  } else {
    effectiveSignal = timeoutController.signal;
  }

  const MAX_TOOL_ROUNDS = 10;
  let round = 0;

  try {
    while (round < MAX_TOOL_ROUNDS) {
      round++;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify({
          model: settings.model,
          messages: chatMessages,
          tools: connections.filter(c => c.isConnected).length > 0 ? MCP_TOOLS : undefined,
          stream: true,
          temperature: 0.7,
          max_tokens: 4096,
        }),
        signal: effectiveSignal,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => '');
        let errorMsg: string;
        try {
          const parsed = JSON.parse(errorBody);
          errorMsg = parsed.error?.message || parsed.message || errorBody;
        } catch {
          errorMsg = errorBody || `HTTP ${response.status}`;
        }
        callbacks.onError(`API Error (${response.status}): ${errorMsg}`);
        return;
      }

      if (!response.body) {
        callbacks.onError('Response body is empty');
        return;
      }

      // Read streaming response
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';
      let toolCalls: Map<number, { id: string; name: string; arguments: string }> = new Map();
      let hasToolCalls = false;
      let finishReason = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === 'data: [DONE]') continue;
          if (!trimmed.startsWith('data: ')) continue;

          try {
            const json = JSON.parse(trimmed.slice(6));
            const choice = json.choices?.[0];
            if (!choice) continue;

            const delta = choice.delta;
            finishReason = choice.finish_reason || finishReason;

            // Handle text content
            if (delta?.content) {
              accumulated += delta.content;
              callbacks.onToken(delta.content);
            }

            // Handle tool calls
            if (delta?.tool_calls) {
              hasToolCalls = true;
              for (const tc of delta.tool_calls) {
                const idx = tc.index;
                if (!toolCalls.has(idx)) {
                  toolCalls.set(idx, { id: tc.id || '', name: '', arguments: '' });
                }
                const existing = toolCalls.get(idx)!;
                if (tc.id) existing.id = tc.id;
                if (tc.function?.name) existing.name += tc.function.name;
                if (tc.function?.arguments) existing.arguments += tc.function.arguments;
              }
            }
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // If no tool calls, we're done
      if (!hasToolCalls) {
        callbacks.onComplete();
        clearTimeout(timeoutId);
        return;
      }

      // Add assistant message with tool calls to history
      const assistantMsg: ChatMessage = {
        role: 'assistant',
        content: accumulated || null,
        tool_calls: Array.from(toolCalls.values()).map((tc) => ({
          id: tc.id,
          type: 'function' as const,
          function: { name: tc.name, arguments: tc.arguments },
        })),
      };
      chatMessages.push(assistantMsg);

      // Execute each tool call and add results
      for (const tc of toolCalls.values()) {
        let args: Record<string, string> = {};
        try {
          args = JSON.parse(tc.arguments);
        } catch {
          args = {};
        }

        callbacks.onToolCall?.(`Calling ${tc.name}...`);

        const result = await executeToolCall(tc.name, args, connections, callbacks.onWriteConfirm);

        chatMessages.push({
          role: 'tool',
          content: result,
          tool_call_id: tc.id,
        });
      }

      callbacks.onToolCall?.('');
      // Continue loop to get AI's response after tool results
    }

    // Max rounds reached
    callbacks.onComplete();
    clearTimeout(timeoutId);
  } catch (err) {
    clearTimeout(timeoutId);
    if (signal?.aborted) return;
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('aborted')) {
      callbacks.onError('Request timed out (120s). Please try again.');
    } else {
      callbacks.onError(
        message.includes('Failed to fetch')
          ? 'Network error. Please check your API base URL and internet connection.'
          : message,
      );
    }
  }
}

/** Extract SQL/JSON code blocks from AI response */
export function extractSqlFromResponse(content: string): string | null {
  // Match ```sql ... ```, ```json ... ```, or ``` ... ```
  const codeBlockRegex = /```(?:sql|json)?\s*\n?([\s\S]*?)```/g;
  const matches: string[] = [];
  let match;
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const code = match[1].trim();
    if (code) matches.push(code);
  }
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

/** Test API key validity by sending a minimal request */
export async function testApiKey(settings: AISettings): Promise<{ success: boolean; message: string }> {
  if (!settings.apiKey) {
    return { success: false, message: 'API Key is empty' };
  }

  if (!settings.baseUrl) {
    return { success: false, message: 'Base URL is empty' };
  }

  if (!settings.model) {
    return { success: false, message: 'Model is not selected' };
  }

  const baseUrl = settings.baseUrl.replace(/\/+$/, '');
  const url = `${baseUrl}/chat/completions`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 5,
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      return { success: true, message: '' };
    }

    const errorBody = await response.text().catch(() => '');
    let errorMsg: string;
    try {
      const parsed = JSON.parse(errorBody);
      errorMsg = parsed.error?.message || parsed.message || errorBody;
    } catch {
      errorMsg = errorBody || `HTTP ${response.status}`;
    }

    if (response.status === 401 || response.status === 403) {
      return { success: false, message: errorMsg || 'Invalid API Key' };
    }
    return { success: false, message: `HTTP ${response.status}: ${errorMsg}` };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes('aborted') || message.includes('AbortError')) {
      return { success: false, message: 'Connection timed out (15s)' };
    }
    return { success: false, message: message.includes('Failed to fetch') ? 'Network error' : message };
  }
}
