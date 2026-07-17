import { create } from 'zustand';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  thinking?: string;
  timestamp: number;
  isError?: boolean;
}

interface AIState {
  messages: AIMessage[];
  isThinking: boolean;
  isVisible: boolean;
  abortController: AbortController | null;
  addMessage: (msg: Omit<AIMessage, 'id' | 'timestamp'>) => string;
  updateMessageContent: (id: string, content: string) => void;
  setMessageSql: (id: string, sql: string | null) => void;
  clearMessages: () => void;
  setThinking: (v: boolean) => void;
  setVisible: (v: boolean) => void;
  toggleVisible: () => void;
  setAbortController: (c: AbortController | null) => void;
  abort: () => void;
}

export const useAIStore = create<AIState>()((set, get) => ({
  messages: [],
  isThinking: false,
  isVisible: true,
  abortController: null,

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

  setMessageSql: (id, sql) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.id === id ? { ...m, sql: sql || undefined } : m
      ),
    }));
  },

  clearMessages: () => set({ messages: [] }),
  setThinking: (v) => set({ isThinking: v }),
  setVisible: (v) => set({ isVisible: v }),
  toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),

  setAbortController: (c) => set({ abortController: c }),

  abort: () => {
    const ctrl = get().abortController;
    if (ctrl) {
      ctrl.abort();
      set({ abortController: null, isThinking: false });
    }
  },
}));
