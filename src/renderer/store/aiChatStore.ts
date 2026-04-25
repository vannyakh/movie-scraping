import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { electronPersistStorage } from '@/lib/electron-persist-storage'

export type MessageStatus = 'success' | 'error' | 'pending'

export interface ChatMessage {
  id:        string
  role:      'user' | 'assistant'
  content:   string
  timestamp: number
  status?:   MessageStatus
}

interface AIChatStore {
  /** Conversations keyed by projectId (or "global") */
  conversations: Record<string, ChatMessage[]>
  addMessage:    (key: string, msg: Omit<ChatMessage, 'id'>) => string
  updateMessage: (key: string, id: string, patch: Partial<ChatMessage>) => void
  clearChat:     (key: string) => void
}

export const useAIChatStore = create<AIChatStore>()(
  persist(
    (set) => ({
      conversations: {},

      addMessage: (key, msg) => {
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
        set((s) => ({
          conversations: {
            ...s.conversations,
            [key]: [...(s.conversations[key] ?? []), { ...msg, id }],
          },
        }))
        return id
      },

      updateMessage: (key, id, patch) =>
        set((s) => ({
          conversations: {
            ...s.conversations,
            [key]: (s.conversations[key] ?? []).map((m) =>
              m.id === id ? { ...m, ...patch } : m,
            ),
          },
        })),

      clearChat: (key) =>
        set((s) => ({
          conversations: { ...s.conversations, [key]: [] },
        })),
    }),
    { name: 'dataflow-ai-chat', storage: electronPersistStorage },
  ),
)
