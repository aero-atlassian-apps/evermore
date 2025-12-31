import { create } from 'zustand';

export interface Message {
    id: string;
    speaker: 'agent' | 'user';
    text: string;
    timestamp: Date;
    audioTimestamp?: number;
}

export interface ConversationState {
  isActive: boolean;
  sessionId?: string;
  messages: Message[];
  duration: number;
  isAgentSpeaking: boolean;
}

interface ConversationStore extends ConversationState {
  // Actions
  startSession: (sessionId: string) => void;
  endSession: () => void;
  addMessage: (message: Message) => void;
  setAgentSpeaking: (speaking: boolean) => void;
  updateDuration: (duration: number) => void;
  reset: () => void;
}

export const useConversationStore = create<ConversationStore>((set) => ({
  // Initial state
  isActive: false,
  sessionId: undefined,
  messages: [],
  duration: 0,
  isAgentSpeaking: false,

  // Actions
  startSession: (sessionId) => set({
    isActive: true,
    sessionId,
    messages: [],
    duration: 0
  }),

  endSession: () => set({
    isActive: false
  }),

  addMessage: (message) => set((state) => ({
    messages: [...state.messages, message]
  })),

  setAgentSpeaking: (speaking) => set({
    isAgentSpeaking: speaking
  }),

  updateDuration: (duration) => set({ duration }),

  reset: () => set({
    isActive: false,
    sessionId: undefined,
    messages: [],
    duration: 0,
    isAgentSpeaking: false
  })
}));
