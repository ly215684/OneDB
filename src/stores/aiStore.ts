import { create } from 'zustand';

export interface ToolCallRecord {
  id: string;
  name: string;
  args: Record<string, string>;
  status: 'calling' | 'done' | 'error';
}

export type MessageSegment =
  | { type: 'text'; content: string }
  | { type: 'tool-call'; record: ToolCallRecord };

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  segments?: MessageSegment[];
  sql?: string;
  thinking?: string;
  toolCalls?: ToolCallRecord[];
  timestamp: number;
  isError?: boolean;
}

export interface PendingWriteInfo {
  connection: string;
  database: string;
  query: string;
  resolve: (confirmed: boolean) => void;
}

interface AIState {
  messages: AIMessage[];
  isThinking: boolean;
  isVisible: boolean;
  showThinking: boolean;
  abortController: AbortController | null;
  toolCallStatus: string;
  pendingWrite: PendingWriteInfo | null;
  addMessage: (msg: Omit<AIMessage, 'id' | 'timestamp'>) => string;
  updateMessageContent: (id: string, content: string) => void;
  updateMessageSegments: (id: string, segments: MessageSegment[]) => void;
  setMessageSql: (id: string, sql: string | null) => void;
  addToolCall: (msgId: string, record: ToolCallRecord) => void;
  updateToolCallStatus: (msgId: string, toolCallId: string, status: ToolCallRecord['status']) => void;
  clearMessages: () => void;
  setThinking: (v: boolean) => void;
  setVisible: (v: boolean) => void;
  toggleVisible: () => void;
  setShowThinking: (v: boolean) => void;
  setAbortController: (c: AbortController | null) => void;
  abort: () => void;
  setToolCallStatus: (status: string) => void;
  setPendingWrite: (info: PendingWriteInfo | null) => void;
  confirmWrite: () => void;
  cancelWrite: () => void;
}

export const useAIStore = create<AIState>()((set, get) => ({
  messages: [],
  isThinking: false,
  isVisible: true,
  showThinking: true,
  abortController: null,
  toolCallStatus: '',
  pendingWrite: null,

  addMessage: (msg) => {
    const id = `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const message: AIMessage = { ...msg, id, timestamp: Date.now() };
    set((state) => ({ messages: [...state.messages, message] }));
    return id;
  },

  updateMessageContent: (id, content) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, content } : m
      ),
    }));
  },

  updateMessageSegments: (id, segments) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, segments } : m
      ),
    }));
  },

  setMessageSql: (id, sql) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, sql: sql || undefined } : m
      ),
    }));
  },

  addToolCall: (msgId, record) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === msgId
          ? { ...m, toolCalls: [...(m.toolCalls || []), record] }
          : m
      ),
    }));
  },

  updateToolCallStatus: (msgId, toolCallId, status) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === msgId
          ? {
              ...m,
              toolCalls: (m.toolCalls || []).map((tc) =>
                tc.id === toolCallId ? { ...tc, status } : tc
              ),
            }
          : m
      ),
    }));
  },

  clearMessages: () => set({ messages: [] }),
  setThinking: (v) => set({ isThinking: v }),
  setVisible: (v) => set({ isVisible: v }),
  toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),
  setShowThinking: (v) => set({ showThinking: v }),

  setAbortController: (c) => set({ abortController: c }),

  abort: () => {
    const ctrl = get().abortController;
    if (ctrl) {
      ctrl.abort();
      set({ abortController: null, isThinking: false, toolCallStatus: '' });
    }
  },

  setToolCallStatus: (status) => set({ toolCallStatus: status }),

  setPendingWrite: (info) => set({ pendingWrite: info }),

  confirmWrite: () => {
    const pending = get().pendingWrite;
    if (pending) {
      pending.resolve(true);
      set({ pendingWrite: null });
    }
  },

  cancelWrite: () => {
    const pending = get().pendingWrite;
    if (pending) {
      pending.resolve(false);
      set({ pendingWrite: null });
    }
  },
}));
