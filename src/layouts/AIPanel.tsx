import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useAIStore } from '../stores/aiStore';
import { useTabStore } from '../stores/tabStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnectionStore } from '../stores/connectionStore';
import { getTableStructure } from '../services/connectionService';
import { chatStream, extractSqlFromResponse } from '../services/aiService';
import {
  PanelRightClose,
  Send,
  Trash2,
  Sparkles,
  Copy,
  Play,
  Bot,
  User,
  Check,
  Square,
  Settings,
  Table2,
  X,
  Loader2,
  Quote,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useMessage } from '../components/ui/Message';
import { clsx } from 'clsx';

// ─── Table Selection Dialog ────────────────────────────────

function TableSelectDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: (connId: string, db: string, table: string) => void;
}) {
  const { t } = useTranslation();
  const connections = useConnectionStore((s) => s.connections);
  const [connId, setConnId] = useState('');
  const [db, setDb] = useState('');
  const [table, setTable] = useState('');

  const conn = connections.find((c) => c.id === connId);
  const databases = conn?.databases || [];
  const dbInfo = databases.find((d) => d.name === db);
  const tables = [
    ...(dbInfo?.tables || []),
    ...(dbInfo?.collections || []).map((c) => ({ name: c.name })),
  ];
  const connectedConns = connections.filter((c) => c.isConnected);

  const handleConnChange = (id: string) => {
    setConnId(id);
    setDb('');
    setTable('');
  };
  const handleDbChange = (name: string) => {
    setDb(name);
    setTable('');
  };

  return (
    <Modal open={open} onClose={onClose} title={t('ai.selectTableContext')} width="max-w-md">
      <div className="p-4 space-y-4">
        {/* Connection */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">{t('ai.selectConnection')}</label>
          <select
            className="h-8 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors"
            value={connId}
            onChange={(e) => handleConnChange(e.target.value)}
          >
            <option value="">{t('ai.selectConnection')}</option>
            {connectedConns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>

        {/* Database */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">{t('ai.selectDatabase')}</label>
          <select
            className="h-8 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors disabled:opacity-50"
            value={db}
            onChange={(e) => handleDbChange(e.target.value)}
            disabled={!connId}
          >
            <option value="">{t('ai.selectDatabase')}</option>
            {databases.map((d) => (
              <option key={d.name} value={d.name}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* Table */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs text-muted-foreground font-medium">{t('ai.selectTable')}</label>
          <select
            className="h-8 px-3 text-sm rounded-md border border-border bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-ring transition-colors disabled:opacity-50"
            value={table}
            onChange={(e) => setTable(e.target.value)}
            disabled={!db}
          >
            <option value="">{t('ai.selectTable')}</option>
            {tables.map((tbl) => (
              <option key={tbl.name} value={tbl.name}>{tbl.name}</option>
            ))}
          </select>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onClose}>{t('common.cancel')}</Button>
          <Button
            size="sm"
            disabled={!connId || !db || !table}
            onClick={() => {
              onConfirm(connId, db, table);
              onClose();
            }}
          >
            {t('common.confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main AI Panel ──────────────────────────────────────────

export function AIPanel() {
  const { t } = useTranslation();
  const message = useMessage();
  const aiMsgs = useAIStore((s) => s.messages);
  const isThinking = useAIStore((s) => s.isThinking);
  const addMessage = useAIStore((s) => s.addMessage);
  const updateMessageContent = useAIStore((s) => s.updateMessageContent);
  const setMessageSql = useAIStore((s) => s.setMessageSql);
  const clearMessages = useAIStore((s) => s.clearMessages);
  const setVisible = useAIStore((s) => s.setVisible);
  const setThinking = useAIStore((s) => s.setThinking);
  const abort = useAIStore((s) => s.abort);
  const setAbortController = useAIStore((s) => s.setAbortController);
  const aiSettings = useSettingsStore((s) => s.ai);
  const connections = useConnectionStore((s) => s.connections);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // ─── Table selection dialog ───
  const [showTableDialog, setShowTableDialog] = useState(false);

  // ─── Schema context ───
  const [schemaContext, setSchemaContext] = useState('');
  const [schemaLabel, setSchemaLabel] = useState('');
  const [loadingSchema, setLoadingSchema] = useState(false);
  // Store last referenced connection for SQL execution
  const [lastRefConnId, setLastRefConnId] = useState<string>('');
  const [lastRefDatabase, setLastRefDatabase] = useState<string>('');

  // Build context from table structure (metadata always, DDL if available)
  const buildDDL = useCallback(async (connId: string, database: string, tableName: string) => {
    const conn = connections.find((c) => c.id === connId);
    if (!conn || conn.type === 'redis') return;

    setSchemaLabel(`${conn.name} › ${database} › ${tableName}`);
    setLoadingSchema(true);
    // Store connection info for SQL execution
    setLastRefConnId(connId);
    setLastRefDatabase(database);

    // Always set base metadata context
    let context = `-- Database Type: ${conn.type}\n-- Database: ${database}\n-- Table: ${tableName}`;

    try {
      const structure = await getTableStructure(conn.type, conn.config, database, tableName);
      console.log('[AI] Table structure:', structure);

      const cols = structure.columns.map((c) => {
        const parts = [`  ${c.name} ${c.type}`];
        if (c.primary_key) parts.push('PRIMARY KEY');
        if (c.auto_increment) parts.push('AUTO_INCREMENT');
        if (!c.nullable) parts.push('NOT NULL');
        if (c.default_value) parts.push(`DEFAULT ${c.default_value}`);
        if (c.comment) parts.push(`COMMENT '${c.comment}'`);
        return parts.join(' ');
      });
      let ddl = `CREATE TABLE ${tableName} (\n${cols.join(',\n')}\n);`;

      if (structure.indexes && structure.indexes.length > 0) {
        ddl += '\n';
        for (const idx of structure.indexes) {
          const unique = idx.unique ? 'UNIQUE ' : '';
          ddl += `\nCREATE ${unique}INDEX ${idx.name} ON ${tableName} (${idx.columns.join(', ')});`;
        }
      }

      if (structure.foreign_keys && structure.foreign_keys.length > 0) {
        ddl += '\n';
        for (const fk of structure.foreign_keys) {
          ddl += `\nALTER TABLE ${tableName} ADD CONSTRAINT ${fk.name} FOREIGN KEY (${fk.columns.join(', ')}) REFERENCES ${fk.referenced_table} (${fk.referenced_columns.join(', ')})`;
          if (fk.on_delete) ddl += ` ON DELETE ${fk.on_delete}`;
          if (fk.on_update) ddl += ` ON UPDATE ${fk.on_update}`;
          ddl += ';';
        }
      }

      context += `\n\n${ddl}`;
      console.log('[AI] Full context:', context);
      setSchemaContext(context);
      message.success(`${t('ai.schemaLoaded')}: ${tableName}`);
    } catch (err) {
      console.warn('[AI] Table structure not available, using metadata only:', err);
      // DDL not available, but metadata is still useful
      setSchemaContext(context);
      message.info(`${t('ai.schemaMetaOnly')}: ${tableName}`);
    } finally {
      setLoadingSchema(false);
    }
  }, [connections, message, t]);

  const handleTableConfirm = useCallback((connId: string, db: string, table: string) => {
    buildDDL(connId, db, table);
  }, [buildDDL]);

  const clearSchema = useCallback(() => {
    setSchemaContext('');
    setSchemaLabel('');
  }, []);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  const handleSend = useCallback((overrideContent?: string) => {
    const content = overrideContent ?? input;
    if (!content.trim() || isThinking) return;

    addMessage({ role: 'user', content });
    setInput('');
    setThinking(true);

    const assistantId = addMessage({ role: 'assistant', content: '' });
    const controller = new AbortController();
    setAbortController(controller);

    const history = useAIStore.getState().messages
      .filter((m) => !m.isError)
      .slice(0, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    // Inject schema context and clear after injection (one-time use)
    if (schemaContext) {
      // Add MongoDB hint if applicable
      const isMongo = schemaContext.includes('Database Type: mongodb');
      const mongoHint = isMongo
        ? '\nIMPORTANT: This is a MongoDB connection. You MUST generate JSON format queries wrapped in ```json code blocks. Example: ```json\n{"collection": "' + (schemaContext.match(/-- Table: (.+)/)?.[1] || 'collection_name') + '", "operation": "find", "filter": {}, "limit": 100}\n```\nDo NOT generate SQL syntax for MongoDB.'
        : '';
      const schemaBlock = `\n\n---\n[Referenced Table Context]\n\`\`\`sql\n${schemaContext}\n\`\`\`${mongoHint}\nPlease use this table information to answer my question.`;
      const lastUserIdx = (() => {
        for (let i = history.length - 1; i >= 0; i--) {
          if (history[i].role === 'user') return i;
        }
        return -1;
      })();
      if (lastUserIdx >= 0) {
        history[lastUserIdx].content = history[lastUserIdx].content + schemaBlock;
      } else {
        history.unshift({ role: 'user' as const, content: `[Referenced Table Context]\n\`\`\`sql\n${schemaContext}\n\`\`\`\nPlease use this table information.` });
      }
      // Clear after injection so next message requires re-referencing
      setSchemaContext('');
      setSchemaLabel('');
    }

    let accumulated = '';

    chatStream(history, aiSettings, {
      onToken: (token) => {
        accumulated += token;
        updateMessageContent(assistantId, accumulated);
        scrollToBottom();
      },
      onComplete: () => {
        setThinking(false);
        setAbortController(null);
        const sql = extractSqlFromResponse(accumulated);
        if (sql) setMessageSql(assistantId, sql);
      },
      onError: (error) => {
        setThinking(false);
        setAbortController(null);
        message.error(error);
        updateMessageContent(assistantId, error);
        useAIStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantId ? { ...m, isError: true } : m
          ),
        }));
      },
    }, controller.signal).catch((err) => {
      console.error('[AI] Unexpected chatStream error:', err);
      setThinking(false);
      setAbortController(null);
      const errMsg = err instanceof Error ? err.message : String(err);
      message.error(errMsg);
      updateMessageContent(assistantId, `Error: ${errMsg}`);
      useAIStore.setState((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId ? { ...m, isError: true } : m
        ),
      }));
    });
  }, [input, isThinking, addMessage, updateMessageContent, setMessageSql, setThinking, setAbortController, aiSettings, scrollToBottom, schemaContext, message]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExecuteSql = useCallback((sql: string) => {
    // Use last referenced connection, or fallback to active tab's connection
    const activeTab = useTabStore.getState().getActiveTab();
    const connId = lastRefConnId || activeTab?.connectionId || undefined;
    const dbName = lastRefDatabase || activeTab?.database || undefined;
    useTabStore.getState().addTab({
      type: 'sql-editor',
      title: 'AI Query',
      connectionId: connId,
      database: dbName,
      data: { sql },
    });
  }, [lastRefConnId, lastRefDatabase]);

  const handleInsertToEditor = useCallback((sql: string) => {
    const activeTab = useTabStore.getState().getActiveTab();
    if (activeTab && activeTab.type === 'sql-editor') {
      useTabStore.getState().updateTab(activeTab.id, { data: { ...activeTab.data, sql } });
    } else {
      // Use last referenced connection, or fallback to active tab's connection
      const connId = lastRefConnId || activeTab?.connectionId || undefined;
      const dbName = lastRefDatabase || activeTab?.database || undefined;
      useTabStore.getState().addTab({
        type: 'sql-editor',
        title: 'AI Query',
        connectionId: connId,
        database: dbName,
        data: { sql },
      });
    }
  }, [lastRefConnId, lastRefDatabase]);

  const [copiedId, setCopiedId] = useState<string | null>(null);
  const handleCopyWithFeedback = useCallback((sql: string, msgId: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(msgId);
    message.success(t('common.success'));
    setTimeout(() => setCopiedId(null), 2000);
  }, [message, t]);

  const isConfigured = aiSettings.enabled && aiSettings.apiKey;

  // ─── Resizable width ───
  const [width, setWidth] = useState(320);
  const isDragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    const startX = e.clientX;
    const startWidth = width;

    const handleMouseMove = (ev: MouseEvent) => {
      if (!isDragging.current) return;
      const delta = startX - ev.clientX;
      setWidth(Math.min(Math.max(startWidth + delta, 240), 700));
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, [width]);

  return (
    <div className="flex flex-col bg-sidebar h-full relative" style={{ width }}>
      {/* Drag handle */}
      <div
        onMouseDown={handleMouseDown}
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-primary/30 active:bg-primary/50 z-10 transition-colors"
      />
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-sidebar-border">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-primary" />
          <span className="text-xs font-semibold">{t('ai.title')}</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearMessages}>
            <Trash2 size={12} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setVisible(false)}>
            <PanelRightClose size={12} />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-3" ref={scrollRef}>
        <div className="space-y-3">
          {aiMsgs.length === 0 && (
            <div className="text-center py-8">
              <Sparkles size={24} className="mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">
                {isConfigured ? t('ai.inputPlaceholder') : t('ai.notConfigured')}
              </p>
              {isConfigured && (
                <p className="text-2xs text-muted-foreground/60 mt-2">
                  💡 {t('ai.refHint')}
                </p>
              )}
              {!isConfigured && (
                <p className="text-2xs text-muted-foreground/60 mt-2 flex items-center justify-center gap-1">
                  <Settings size={10} />
                  {t('ai.goToSettings')}
                </p>
              )}
            </div>
          )}
          {aiMsgs.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'flex gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className={clsx(
                  'h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0',
                  msg.isError ? 'bg-destructive/10' : 'bg-primary/10'
                )}>
                  <Bot size={12} className={msg.isError ? 'text-destructive' : 'text-primary'} />
                </div>
              )}
              <div
                className={clsx(
                  'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : msg.isError
                      ? 'bg-destructive/10 text-destructive border border-destructive/20'
                      : 'bg-muted text-foreground'
                )}
              >
                {msg.thinking && (
                  <div className="mb-2 text-2xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                    {msg.thinking}
                  </div>
                )}
                <div className="prose prose-xs dark:prose-invert max-w-none [&_p]:my-1 [&_pre]:my-1 [&_pre]:p-2 [&_pre]:text-2xs [&_pre]:bg-background/50 [&_pre]:rounded [&_pre]:border [&_pre]:border-border [&_pre]:overflow-x-auto [&_code]:text-2xs [&_code]:font-mono [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4 [&_li]:my-0.5 [&_h1]:text-sm [&_h1]:my-2 [&_h2]:text-xs [&_h2]:my-1.5 [&_h3]:text-xs [&_h3]:my-1 [&_table]:text-2xs [&_table]:my-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-2 [&_blockquote]:my-1 [&_a]:text-primary [&_a]:underline">
                  <ReactMarkdown>{msg.content || (msg.role === 'assistant' && isThinking ? '...' : '')}</ReactMarkdown>
                </div>
                {msg.sql && (
                  <div className="mt-2 rounded bg-background/50 border border-border p-2">
                    <pre className="text-2xs font-mono overflow-x-auto whitespace-pre-wrap">{msg.sql}</pre>
                    <div className="flex gap-1 mt-2">
                      <Button variant="ghost" size="sm" className="h-5 text-2xs gap-1" onClick={() => handleCopyWithFeedback(msg.sql!, msg.id)}>
                        {copiedId === msg.id ? <Check size={10} /> : <Copy size={10} />}
                        {copiedId === msg.id ? t('common.success') : t('editor.copySql')}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-5 text-2xs gap-1" onClick={() => handleExecuteSql(msg.sql!)}>
                        <Play size={10} />
                        {t('ai.execute')}
                      </Button>
                      <Button variant="ghost" size="sm" className="h-5 text-2xs gap-1" onClick={() => handleInsertToEditor(msg.sql!)}>
                        {t('ai.insertToEditor')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
              {msg.role === 'user' && (
                <div className="h-6 w-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0">
                  <User size={12} className="text-primary-foreground" />
                </div>
              )}
            </div>
          ))}
          {isThinking && (
            <div className="flex gap-2 items-end">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot size={12} className="text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                <span className="flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="sm" className="h-6 text-2xs" onClick={() => handleSend(t('ai.generateSql') + ': ')} disabled={isThinking || !isConfigured}>
            {t('ai.generateSql')}
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-2xs" onClick={() => handleSend(t('ai.explainSql') + ': ')} disabled={isThinking || !isConfigured}>
            {t('ai.explainSql')}
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-2xs" onClick={() => handleSend(t('ai.optimizeSql') + ': ')} disabled={isThinking || !isConfigured}>
            {t('ai.optimizeSql')}
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-2xs" onClick={() => handleSend(t('ai.fixError') + ': ')} disabled={isThinking || !isConfigured}>
            {t('ai.fixError')}
          </Button>
        </div>
      </div>

      {/* Input area */}
      <div className="p-3 border-t border-sidebar-border">
        {/* Schema badge */}
        {(schemaLabel || loadingSchema) && (
          <div className="mb-2 flex items-center gap-1.5">
            {loadingSchema ? (
              <div className="flex items-center gap-1.5 text-2xs text-muted-foreground">
                <Loader2 size={10} className="animate-spin" />
                {t('ai.loadingSchema')}
              </div>
            ) : (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-2xs font-medium">
                <Table2 size={10} />
                <span className="truncate max-w-48">{schemaLabel}</span>
                <button onClick={clearSchema} className="ml-0.5 hover:text-destructive transition-colors">
                  <X size={10} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* Toolbar: reference button */}
        <div className="flex items-center gap-1 mb-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-6 text-2xs gap-1"
            onClick={() => setShowTableDialog(true)}
            disabled={!isConfigured}
          >
            <Quote size={12} />
            {t('ai.refTable')}
          </Button>
        </div>

        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isConfigured ? t('ai.inputPlaceholder') : t('ai.notConfigured')}
            rows={2}
            disabled={!isConfigured}
            className="flex-1 px-3 py-2 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
          />
          {isThinking ? (
            <Button onClick={abort} variant="destructive" size="icon" className="h-8 w-8 flex-shrink-0">
              <Square size={12} />
            </Button>
          ) : (
            <Button onClick={() => handleSend()} disabled={!input.trim() || !isConfigured} size="icon" className="h-8 w-8 flex-shrink-0">
              <Send size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Table selection dialog */}
      <TableSelectDialog
        open={showTableDialog}
        onClose={() => setShowTableDialog(false)}
        onConfirm={handleTableConfirm}
      />
    </div>
  );
}
