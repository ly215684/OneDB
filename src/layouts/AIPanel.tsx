import { useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { useAIStore } from '../stores/aiStore';
import { useTabStore } from '../stores/tabStore';
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
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { ScrollArea } from '../components/ui/ScrollArea';
import { clsx } from 'clsx';

export function AIPanel() {
  const { t } = useTranslation();
  const messages = useAIStore((s) => s.messages);
  const isThinking = useAIStore((s) => s.isThinking);
  const addMessage = useAIStore((s) => s.addMessage);
  const clearMessages = useAIStore((s) => s.clearMessages);
  const setVisible = useAIStore((s) => s.setVisible);
  const [input, setInput] = useState('');

  const handleSend = useCallback((overrideContent?: string) => {
    const content = overrideContent ?? input;
    if (!content.trim() || isThinking) return;

    addMessage({ role: 'user', content });
    setInput('');

    // Mock AI response
    setTimeout(() => {
      const responses: Record<string, { content: string; sql: string; thinking: string }> = {
        generate: {
          content: 'Here is the generated SQL based on your description:',
          sql: 'SELECT * FROM users WHERE status = \'active\' ORDER BY created_at DESC;',
          thinking: 'Analyzing the request... The user wants to query active users.',
        },
        explain: {
          content: 'This query selects all columns from the users table where status is active, ordered by creation date descending. The WHERE clause filters for active users only.',
          sql: 'SELECT * FROM users WHERE status = \'active\' ORDER BY created_at DESC;',
          thinking: 'Parsing the SQL... Breaking down each clause and its purpose.',
        },
        optimize: {
          content: 'Here is an optimized version of your SQL. Added an index suggestion and replaced SELECT * with specific columns:',
          sql: 'SELECT id, name, email, status, created_at FROM users WHERE status = \'active\' ORDER BY created_at DESC;',
          thinking: 'Analyzing query plan... Identifying potential improvements.',
        },
        fix: {
          content: 'I found the issue: missing quote escaping and incorrect table alias. Here is the corrected SQL:',
          sql: 'SELECT u.id, u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id WHERE o.status = \'pending\';',
          thinking: 'Scanning for syntax errors... Found issues with string literals.',
        },
      };
      const key = overrideContent
        ? content.toLowerCase().includes('explain') ? 'explain'
          : content.toLowerCase().includes('optim') ? 'optimize'
          : content.toLowerCase().includes('fix') ? 'fix'
          : 'generate'
        : 'generate';
      const resp = responses[key] || responses.generate;
      addMessage({ role: 'assistant', ...resp });
    }, 1000);
  }, [input, isThinking, addMessage]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleExecuteSql = useCallback((sql: string) => {
    const addTab = useTabStore.getState().addTab;
    addTab({ type: 'sql-editor', title: 'AI Query', data: { sql } });
  }, []);

  const handleInsertToEditor = useCallback((sql: string) => {
    const activeTab = useTabStore.getState().getActiveTab();
    if (activeTab && activeTab.type === 'sql-editor') {
      useTabStore.getState().updateTab(activeTab.id, { data: { ...activeTab.data, sql } });
    } else {
      const addTab = useTabStore.getState().addTab;
      addTab({ type: 'sql-editor', title: 'AI Query', data: { sql } });
    }
  }, []);

  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyWithFeedback = useCallback((sql: string, msgId: string) => {
    navigator.clipboard.writeText(sql);
    setCopiedId(msgId);
    setTimeout(() => setCopiedId(null), 2000);
  }, []);

  return (
    <div className="w-80 flex flex-col bg-sidebar border-l border-sidebar-border h-full">
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
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-3">
          {messages.length === 0 && (
            <div className="text-center py-8">
              <Sparkles size={24} className="mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">{t('ai.inputPlaceholder')}</p>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={clsx(
                'flex gap-2',
                msg.role === 'user' ? 'justify-end' : 'justify-start'
              )}
            >
              {msg.role === 'assistant' && (
                <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Bot size={12} className="text-primary" />
                </div>
              )}
              <div
                className={clsx(
                  'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-foreground'
                )}
              >
                {/* Thinking process */}
                {msg.thinking && (
                  <div className="mb-2 text-2xs text-muted-foreground italic border-l-2 border-primary/30 pl-2">
                    {msg.thinking}
                  </div>
                )}

                {/* Message content */}
                <p>{msg.content}</p>

                {/* SQL Card */}
                {msg.sql && (
                  <div className="mt-2 rounded bg-background/50 border border-border p-2">
                    <pre className="text-2xs font-mono overflow-x-auto whitespace-pre-wrap">
                      {msg.sql}
                    </pre>
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
            <div className="flex gap-2">
              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot size={12} className="text-primary" />
              </div>
              <div className="bg-muted rounded-lg px-3 py-2 text-xs text-muted-foreground">
                {t('ai.thinking')}
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Quick Actions */}
      <div className="px-3 py-2 border-t border-sidebar-border">
        <div className="flex gap-1 flex-wrap">
          <Button variant="outline" size="sm" className="h-6 text-2xs" onClick={() => handleSend('Generate SQL: ')}>
            {t('ai.generateSql')}
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-2xs" onClick={() => handleSend('Explain this SQL: ')}>
            {t('ai.explainSql')}
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-2xs" onClick={() => handleSend('Optimize this SQL: ')}>
            {t('ai.optimizeSql')}
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-2xs" onClick={() => handleSend('Fix error in SQL: ')}>
            {t('ai.fixError')}
          </Button>
        </div>
      </div>

      {/* Input */}
      <div className="p-3 border-t border-sidebar-border">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t('ai.inputPlaceholder')}
            rows={2}
            className="flex-1 px-3 py-2 text-xs rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-ring"
          />
          <Button
            onClick={() => handleSend()}
            disabled={!input.trim() || isThinking}
            size="icon"
            className="h-8 w-8 flex-shrink-0"
          >
            <Send size={14} />
          </Button>
        </div>
      </div>
    </div>
  );
}
