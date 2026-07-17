import React, { useState, useCallback, useRef, createContext, useContext, useEffect } from 'react';
import { CheckCircle2, XCircle, Info, AlertTriangle, X } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types ──────────────────────────────────────────────────

type MessageType = 'success' | 'error' | 'info' | 'warning';

interface MessageItem {
  id: number;
  type: MessageType;
  content: string;
  leaving: boolean;
}

interface MessageContextValue {
  success: (content: string, duration?: number) => void;
  error: (content: string, duration?: number) => void;
  info: (content: string, duration?: number) => void;
  warning: (content: string, duration?: number) => void;
}

const MessageContext = createContext<MessageContextValue | null>(null);

// ─── Hook ───────────────────────────────────────────────────

export function useMessage(): MessageContextValue {
  const ctx = useContext(MessageContext);
  if (!ctx) throw new Error('useMessage must be used within a MessageProvider');
  return ctx;
}

// ─── Variant config ──────────────────────────────────────────

const typeConfig: Record<MessageType, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  success: {
    icon: <CheckCircle2 size={16} />,
    color: 'text-emerald-600 dark:text-emerald-400',
    bg: 'bg-emerald-50 dark:bg-emerald-950/60',
    border: 'border-emerald-200 dark:border-emerald-800/50',
  },
  error: {
    icon: <XCircle size={16} />,
    color: 'text-red-600 dark:text-red-400',
    bg: 'bg-red-50 dark:bg-red-950/60',
    border: 'border-red-200 dark:border-red-800/50',
  },
  info: {
    icon: <Info size={16} />,
    color: 'text-blue-600 dark:text-blue-400',
    bg: 'bg-blue-50 dark:bg-blue-950/60',
    border: 'border-blue-200 dark:border-blue-800/50',
  },
  warning: {
    icon: <AlertTriangle size={16} />,
    color: 'text-amber-600 dark:text-amber-400',
    bg: 'bg-amber-50 dark:bg-amber-950/60',
    border: 'border-amber-200 dark:border-amber-800/50',
  },
};

// ─── Default durations ──────────────────────────────────────

const defaultDuration: Record<MessageType, number> = {
  success: 3000,
  error: 5000,
  info: 3000,
  warning: 4000,
};

// ─── Message Item Component ─────────────────────────────────

function MessageToast({ item, onClose }: { item: MessageItem; onClose: (id: number) => void }) {
  const cfg = typeConfig[item.type];

  return (
    <div
      className={clsx(
        'flex items-center gap-2.5 px-4 py-2.5 rounded-lg border shadow-lg shadow-black/5',
        'text-sm max-w-md min-w-[200px]',
        cfg.bg, cfg.border,
        'transition-all duration-300 ease-out',
        item.leaving
          ? 'opacity-0 -translate-y-2 scale-95'
          : 'opacity-100 translate-y-0 scale-100'
      )}
    >
      <span className={clsx('flex-shrink-0', cfg.color)}>{cfg.icon}</span>
      <span className="flex-1 text-foreground leading-snug">{item.content}</span>
      <button
        onClick={() => onClose(item.id)}
        className={clsx(
          'flex-shrink-0 w-5 h-5 rounded flex items-center justify-center',
          'text-muted-foreground/60 hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10',
          'transition-colors'
        )}
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ─── Provider ───────────────────────────────────────────────

let nextId = 0;

export function MessageProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const removeMessage = useCallback((id: number) => {
    // Start leave animation
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, leaving: true } : m)));
    // Remove after animation
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m.id !== id));
    }, 300);
    // Clear timer
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const addMessage = useCallback(
    (type: MessageType, content: string, duration?: number) => {
      const id = ++nextId;
      const dur = duration ?? defaultDuration[type];

      setMessages((prev) => {
        // Limit max visible messages
        const next = [...prev, { id, type, content, leaving: false }];
        if (next.length > 5) {
          const removed = next.shift()!;
          const oldTimer = timersRef.current.get(removed.id);
          if (oldTimer) {
            clearTimeout(oldTimer);
            timersRef.current.delete(removed.id);
          }
        }
        return next;
      });

      // Auto-dismiss
      if (dur > 0) {
        const timer = setTimeout(() => removeMessage(id), dur);
        timersRef.current.set(id, timer);
      }
    },
    [removeMessage]
  );

  // Cleanup all timers on unmount
  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);

  const success = useCallback((content: string, duration?: number) => addMessage('success', content, duration), [addMessage]);
  const error = useCallback((content: string, duration?: number) => addMessage('error', content, duration), [addMessage]);
  const info = useCallback((content: string, duration?: number) => addMessage('info', content, duration), [addMessage]);
  const warning = useCallback((content: string, duration?: number) => addMessage('warning', content, duration), [addMessage]);

  return (
    <MessageContext.Provider value={{ success, error, info, warning }}>
      {children}

      {/* Message container - top center */}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col items-center gap-2 pointer-events-none">
        {messages.map((item) => (
          <div key={item.id} className="pointer-events-auto">
            <MessageToast item={item} onClose={removeMessage} />
          </div>
        ))}
      </div>
    </MessageContext.Provider>
  );
}
