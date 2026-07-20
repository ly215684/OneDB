import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useAIStore } from '../stores/aiStore';
import type { PendingWriteInfo, ToolCallRecord, MessageSegment } from '../stores/aiStore';
import { useTabStore } from '../stores/tabStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnectionStore } from '../stores/connectionStore';
import { chatStream, extractSqlFromResponse } from '../services/aiService';
import { modelSupportsTools } from '../types/settings';
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
  Loader2,
  Wrench,
  AlertTriangle,
  ChevronDown,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useMessage } from '../components/ui/Message';
import { clsx } from 'clsx';

// ─── Write Confirmation Card (inline) ────────────────────────────

function WriteConfirmCard({
  pending,
  onConfirm,
  onCancel,
  onSendToEditor,
}: {
  pending: PendingWriteInfo;
  onConfirm: () => void;
  onCancel: () => void;
  onSendToEditor: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex gap-2 justify-start">
      <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
        <Bot size={12} className="text-primary" />
      </div>
      <div className="max-w-[85%] rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5 mb-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle size={12} className="flex-shrink-0" />
          <span className="text-2xs font-medium">
            {t('ai.confirmWriteMessage', { connection: pending.connection, database: pending.database })}
          </span>
        </div>
        <pre className="text-2xs font-mono bg-background/60 border border-amber-500/20 rounded p-2 overflow-x-auto max-h-36 whitespace-pre-wrap text-foreground">
          {pending.query}
        </pre>
        <div className="flex justify-end gap-1.5 mt-2">
          <Button variant="outline" size="sm" className="h-5 text-2xs gap-1" onClick={onSendToEditor}>
            <Send size={10} />
            {t('ai.sendToEditor')}
          </Button>
          <Button variant="outline" size="sm" className="h-5 text-2xs" onClick={onCancel}>
            {t('ai.cancelExecute')}
          </Button>
          <Button variant="destructive" size="sm" className="h-5 text-2xs gap-1" onClick={onConfirm}>
            <Play size={10} />
            {t('ai.confirmExecute')}
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── Tool Call Item ────────────────────────────────────────────

const TOOL_NAME_KEYS: Record<string, string> = {
  list_connections: 'ai.tool.listConnections',
  list_databases: 'ai.tool.listDatabases',
  list_tables: 'ai.tool.listTables',
  describe_table: 'ai.tool.describeTable',
  execute_query: 'ai.tool.executeQuery',
};

function ToolCallItem({ record }: { record: ToolCallRecord }) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const argEntries = Object.entries(record.args).filter(([, v]) => v !== '');

  return (
    <div className="rounded border border-primary/20 bg-primary/5 overflow-hidden">
      <button
        className="flex items-center gap-1.5 w-full px-2 py-1 text-left hover:bg-primary/10 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        <Wrench size={10} className="text-primary/70 flex-shrink-0" />
        <span className="text-2xs font-medium text-primary/80 truncate">
          {t(TOOL_NAME_KEYS[record.name] || record.name)}
        </span>
        <span className="ml-auto flex items-center gap-1 flex-shrink-0">
          {record.status === 'calling' ? (
            <Loader2 size={10} className="animate-spin text-primary/60" />
          ) : record.status === 'error' ? (
            <AlertTriangle size={10} className="text-destructive" />
          ) : (
            <Check size={10} className="text-green-500" />
          )}
          {argEntries.length > 0 && (
            <ChevronDown
              size={10}
              className={clsx('text-muted-foreground/50 transition-transform', expanded && 'rotate-180')}
            />
          )}
        </span>
      </button>
      {expanded && argEntries.length > 0 && (
        <div className="px-2 pb-1.5 pt-0.5 space-y-0.5 border-t border-primary/10">
          {argEntries.map(([k, v]) => (
            <div key={k} className="flex gap-1 text-2xs">
              <span className="text-muted-foreground/60 flex-shrink-0">{k}:</span>
              <span className="text-foreground/60 truncate font-mono">{v}</span>
            </div>
          ))}
        </div>
      )}
    </div>
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
  const updateMessageSegments = useAIStore((s) => s.updateMessageSegments);
  const setMessageSql = useAIStore((s) => s.setMessageSql);
  const clearMessages = useAIStore((s) => s.clearMessages);
  const setVisible = useAIStore((s) => s.setVisible);
  const setThinking = useAIStore((s) => s.setThinking);
  const abort = useAIStore((s) => s.abort);
  const setAbortController = useAIStore((s) => s.setAbortController);
  const toolCallStatus = useAIStore((s) => s.toolCallStatus);
  const setToolCallStatus = useAIStore((s) => s.setToolCallStatus);
  const pendingWrite = useAIStore((s) => s.pendingWrite);
  const setPendingWrite = useAIStore((s) => s.setPendingWrite);
  const confirmWrite = useAIStore((s) => s.confirmWrite);
  const cancelWrite = useAIStore((s) => s.cancelWrite);
  const showThinking = useAIStore((s) => s.showThinking);
  const setShowThinking = useAIStore((s) => s.setShowThinking);
  const aiSettings = useSettingsStore((s) => s.ai);
  const connections = useConnectionStore((s) => s.connections);
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const el = scrollRef.current;
      if (el) el.scrollTop = el.scrollHeight;
    });
  }, []);

  // Write confirmation handler - returns a promise that resolves when user confirms/cancels
  const handleWriteConfirm = useCallback((info: { connection: string; database: string; query: string }): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setPendingWrite({ ...info, resolve });
    });
  }, [setPendingWrite]);

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

    let accumulated = '';
    let segments: MessageSegment[] = [];
    let needNewTextSegment = true;

    chatStream(history, aiSettings, {
      onToken: (token) => {
        accumulated += token;
        // Append to segments
        if (needNewTextSegment || segments.length === 0) {
          segments = [...segments, { type: 'text', content: token }];
          needNewTextSegment = false;
        } else {
          const last = segments[segments.length - 1];
          if (last.type === 'text') {
            segments = [...segments.slice(0, -1), { type: 'text', content: last.content + token }];
          } else {
            segments = [...segments, { type: 'text', content: token }];
          }
        }
        updateMessageContent(assistantId, accumulated);
        updateMessageSegments(assistantId, segments);
        scrollToBottom();
      },
      onComplete: () => {
        setThinking(false);
        setAbortController(null);
        setToolCallStatus('');
        updateMessageSegments(assistantId, segments);
        const sql = extractSqlFromResponse(accumulated);
        if (sql) setMessageSql(assistantId, sql);
      },
      onError: (error) => {
        setThinking(false);
        setAbortController(null);
        setToolCallStatus('');
        message.error(error);
        updateMessageContent(assistantId, error);
        useAIStore.setState((state) => ({
          messages: state.messages.map((m) =>
            m.id === assistantId ? { ...m, isError: true } : m
          ),
        }));
      },
      onToolCall: (info) => {
        if (!info.name) {
          // Empty name means tool round finished, next text starts new segment
          setToolCallStatus('');
          needNewTextSegment = true;
          return;
        }
        if (info.status === 'calling') {
          setToolCallStatus(info.name);
          needNewTextSegment = true;
          const record: ToolCallRecord = { id: info.id, name: info.name, args: info.args, status: 'calling' };
          segments = [...segments, { type: 'tool-call', record }];
          updateMessageSegments(assistantId, segments);
          scrollToBottom();
        } else {
          setToolCallStatus('');
          segments = segments.map((s) =>
            s.type === 'tool-call' && s.record.id === info.id
              ? { ...s, record: { ...s.record, status: 'done' as const } }
              : s
          );
          updateMessageSegments(assistantId, segments);
        }
      },
      onWriteConfirm: handleWriteConfirm,
    }, controller.signal, connections).catch((err) => {
      console.error('[AI] Unexpected chatStream error:', err);
      setThinking(false);
      setAbortController(null);
      setToolCallStatus('');
      const errMsg = err instanceof Error ? err.message : String(err);
      message.error(errMsg);
      updateMessageContent(assistantId, `Error: ${errMsg}`);
      useAIStore.setState((state) => ({
        messages: state.messages.map((m) =>
          m.id === assistantId ? { ...m, isError: true } : m
        ),
      }));
    });
  }, [input, isThinking, addMessage, updateMessageContent, updateMessageSegments, setMessageSql, setThinking, setAbortController, aiSettings, scrollToBottom, message, connections, setToolCallStatus, handleWriteConfirm]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExecuteSql = useCallback((sql: string) => {
    const activeTab = useTabStore.getState().getActiveTab();
    const connId = activeTab?.connectionId || undefined;
    const dbName = activeTab?.database || undefined;
    useTabStore.getState().addTab({
      type: 'sql-editor',
      title: 'AI Query',
      connectionId: connId,
      database: dbName,
      data: { sql },
    });
  }, []);

  const handleInsertToEditor = useCallback((sql: string) => {
    const activeTab = useTabStore.getState().getActiveTab();
    if (activeTab && activeTab.type === 'sql-editor') {
      useTabStore.getState().updateTab(activeTab.id, { data: { ...activeTab.data, sql } });
    } else {
      const connId = activeTab?.connectionId || undefined;
      const dbName = activeTab?.database || undefined;
      useTabStore.getState().addTab({
        type: 'sql-editor',
        title: 'AI Query',
        connectionId: connId,
        database: dbName,
        data: { sql },
      });
    }
  }, []);

  // Send pending write query to editor then cancel
  const handleSendWriteToEditor = useCallback(() => {
    const pending = useAIStore.getState().pendingWrite;
    if (pending) {
      handleInsertToEditor(pending.query);
      cancelWrite();
    }
  }, [handleInsertToEditor, cancelWrite]);

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
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => setShowThinking(!showThinking)}
            title={showThinking ? t('ai.hideThinking') : t('ai.showThinking')}
          >
            {showThinking ? <Eye size={12} /> : <EyeOff size={12} />}
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={clearMessages}>
            <Trash2 size={12} />
          </Button>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setVisible(false)}>
            <PanelRightClose size={12} />
          </Button>
        </div>
      </div>

      {/* Model tools warning */}
      {!modelSupportsTools(aiSettings.model) && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400">
          <AlertTriangle size={12} className="flex-shrink-0" />
          <span className="text-2xs">{t('ai.modelNoToolsWarning')}</span>
        </div>
      )}

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
                <p className="text-2xs text-muted-foreground/60 mt-2 flex items-center justify-center gap-1">
                  <Wrench size={10} />
                  {t('ai.mcpHint')}
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
                {/* Render segments in order if available */}
                {msg.segments && msg.segments.length > 0 ? (
                  <div className="space-y-1.5">
                    {msg.segments.map((seg, idx) => {
                      if (seg.type === 'tool-call') {
                        if (!showThinking) return null;
                        return <ToolCallItem key={`tc-${seg.record.id}-${idx}`} record={seg.record} />;
                      }
                      // text segment
                      return (
                        <div key={`txt-${idx}`} className="prose prose-xs dark:prose-invert max-w-none [&_p]:my-1 [&_pre]:my-1 [&_pre]:p-2 [&_pre]:text-2xs [&_pre]:bg-background/50 [&_pre]:rounded [&_pre]:border [&_pre]:border-border [&_pre]:overflow-x-auto [&_code]:text-2xs [&_code]:font-mono [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4 [&_li]:my-0.5 [&_h1]:text-sm [&_h1]:my-2 [&_h2]:text-xs [&_h2]:my-1.5 [&_h3]:text-xs [&_h3]:my-1 [&_table]:text-2xs [&_table]:my-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-2 [&_blockquote]:my-1 [&_a]:text-primary [&_a]:underline">
                          <ReactMarkdown>{seg.content}</ReactMarkdown>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="prose prose-xs dark:prose-invert max-w-none [&_p]:my-1 [&_pre]:my-1 [&_pre]:p-2 [&_pre]:text-2xs [&_pre]:bg-background/50 [&_pre]:rounded [&_pre]:border [&_pre]:border-border [&_pre]:overflow-x-auto [&_code]:text-2xs [&_code]:font-mono [&_ul]:my-1 [&_ul]:pl-4 [&_ol]:my-1 [&_ol]:pl-4 [&_li]:my-0.5 [&_h1]:text-sm [&_h1]:my-2 [&_h2]:text-xs [&_h2]:my-1.5 [&_h3]:text-xs [&_h3]:my-1 [&_table]:text-2xs [&_table]:my-1 [&_th]:border [&_th]:border-border [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-border [&_td]:px-2 [&_td]:py-1 [&_blockquote]:border-l-2 [&_blockquote]:border-primary/30 [&_blockquote]:pl-2 [&_blockquote]:my-1 [&_a]:text-primary [&_a]:underline">
                    <ReactMarkdown>{msg.content || (msg.role === 'assistant' && isThinking ? '...' : '')}</ReactMarkdown>
                  </div>
                )}
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
          {pendingWrite && (
            <WriteConfirmCard
              pending={pendingWrite}
              onConfirm={confirmWrite}
              onCancel={cancelWrite}
              onSendToEditor={handleSendWriteToEditor}
            />
          )}
          {isThinking && !pendingWrite && (
            <div className="flex gap-2 items-end">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot size={12} className="text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground flex items-center gap-1.5">
                {toolCallStatus ? (
                  <>
                    <Wrench size={10} className="text-primary/70" />
                    <Loader2 size={10} className="animate-spin" />
                    <span className="text-2xs">{t(TOOL_NAME_KEYS[toolCallStatus] || toolCallStatus)}</span>
                  </>
                ) : (
                  <span className="flex gap-0.5">
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 rounded-full bg-current animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                )}
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

    </div>
  );
}
