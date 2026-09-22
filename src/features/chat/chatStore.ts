import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface ChatMessage {
  id: string
  sender: 'renter' | 'owner'
  text: string
  createdAt: string
}

interface ChatState {
  messagesByBillboard: Record<string, ChatMessage[]>
  sendMessage: (billboardId: string, text: string) => void
}

const OWNER_AUTO_REPLIES = [
  "Thanks for reaching out — yes, it's available for those dates.",
  'Sure, happy to share more photos of the site if that helps.',
  'I can work with your budget — let me know your preferred dates.',
  "Good timing, I'll hold this slot while we finalize details.",
]

// A local, per-browser conversation thread per billboard — no backend yet.
// Phase 6 ("Rentor booking inbox", PLAN.md section 7) replaces this with a
// real Firestore-backed thread the Rentor can see and reply to; the
// simulated auto-reply here just keeps the preview feeling alive.
export const useChatStore = create<ChatState>()(
  persist(
    (set) => ({
      messagesByBillboard: {},
      sendMessage: (billboardId, text) => {
        const renterMessage: ChatMessage = {
          id: crypto.randomUUID(),
          sender: 'renter',
          text,
          createdAt: new Date().toISOString(),
        }
        set((s) => ({
          messagesByBillboard: {
            ...s.messagesByBillboard,
            [billboardId]: [
              ...(s.messagesByBillboard[billboardId] ?? []),
              renterMessage,
            ],
          },
        }))

        const reply =
          OWNER_AUTO_REPLIES[
            Math.floor(Math.random() * OWNER_AUTO_REPLIES.length)
          ]
        setTimeout(() => {
          const ownerMessage: ChatMessage = {
            id: crypto.randomUUID(),
            sender: 'owner',
            text: reply,
            createdAt: new Date().toISOString(),
          }
          set((s) => ({
            messagesByBillboard: {
              ...s.messagesByBillboard,
              [billboardId]: [
                ...(s.messagesByBillboard[billboardId] ?? []),
                ownerMessage,
              ],
            },
          }))
        }, 1200)
      },
    }),
    { name: 'billboard-chat-preview' },
  ),
)
