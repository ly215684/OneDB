import { create } from 'zustand';

export interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sql?: string;
  thinking?: string;
  timestamp: number;
}

interface AIState {
  messages: AIMessage[];
  isThinking: boolean;
  isVisible: boolean;
  addMessage: (msg: Omit<AIMessage, 'id' | 'timestamp'>) => void;
  clearMessages: () => void;
  setThinking: (v: boolean) => void;
  setVisible: (v: boolean) => void;
  toggleVisible: () => void;
}

export const useAIStore = create<AIState>()((set) => ({
  messages: [],
  isThinking: false,
  isVisible: true,

  addMessage: (msg) => {
    const message: AIMessage = {
      ...msg,
      id: `ai_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
    };
    set((state) => ({ messages: [...state.messages, message] }));
  },

  clearMessages: () => set({ messages: [] }),
  setThinking: (v) => set({ isThinking: v }),
  setVisible: (v) => set({ isVisible: v }),
  toggleVisible: () => set((state) => ({ isVisible: !state.isVisible })),
}));
