import { useState, useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import ReactMarkdown from 'react-markdown';
import { useAIStore } from '../stores/aiStore';
import type { PendingWriteInfo } from '../stores/aiStore';
import { useTabStore } from '../stores/tabStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useConnectionStore } from '../stores/connectionStore';
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
  Loader2,
  Wrench,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { useMessage } from '../components/ui/Message';
import { clsx } from 'clsx';

// ─── Write Confirmation Dialog ────────────────────────────────

function WriteConfirmDialog({
  pending,
  onConfirm,
  onCancel,
}: {
  pending: PendingWriteInfo | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  if (!pending) return null;

  return (
    <Modal
      open={true}
      onClose={onCancel}
      title={t('ai.confirmWriteTitle')}
      width="max-w-lg"
    >
      <div className="p-4 space-y-4">
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertTriangle size={16} />
          <span>{t('ai.confirmWriteMessage', { connection: pending.connection, database: pending.database })}</span>
        </div>
        <pre className="text-xs font-mono bg-background border border-border rounded p-3 overflow-x-auto max-h-48 whitespace-pre-wrap">
          {pending.query}
        </pre>
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t('ai.cancelExecute')}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {t('ai.confirmExecute')}
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
  const toolCallStatus = useAIStore((s) => s.toolCallStatus);
  const setToolCallStatus = useAIStore((s) => s.setToolCallStatus);
  const pendingWrite = useAIStore((s) => s.pendingWrite);
  const setPendingWrite = useAIStore((s) => s.setPendingWrite);
  const confirmWrite = useAIStore((s) => s.confirmWrite);
  const cancelWrite = useAIStore((s) => s.cancelWrite);
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

    chatStream(history, aiSettings, {
      onToken: (token) => {
        accumulated += token;
        updateMessageContent(assistantId, accumulated);
        scrollToBottom();
      },
      onComplete: () => {
        setThinking(false);
        setAbortController(null);
        setToolCallStatus('');
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
      onToolCall: (status) => {
        setToolCallStatus(status);
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
  }, [input, isThinking, addMessage, updateMessageContent, setMessageSql, setThinking, setAbortController, aiSettings, scrollToBottom, message, connections, setToolCallStatus, handleWriteConfirm]);

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
                {toolCallStatus ? (
                  <>
                    <Loader2 size={10} className="animate-spin" />
                    <span className="text-2xs">{toolCallStatus}</span>
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

      {/* Write confirmation dialog */}
      <WriteConfirmDialog
        pending={pendingWrite}
        onConfirm={confirmWrite}
        onCancel={cancelWrite}
      />
    </div>
  );
}
