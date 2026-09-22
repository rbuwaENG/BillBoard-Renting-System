import { ArrowLeft, Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components'
import { cn } from '@/lib/utils'
import { useChatStore, type ChatMessage } from './chatStore'

interface ChatPanelProps {
  billboardId: string
  ownerName: string
  onBack: () => void
}

// Stable reference for "no thread yet" — `?? []` would create a new array
// every selector call, and since Zustand's useSyncExternalStore compares
// snapshots by reference, that read as "changed" on every render and caused
// an infinite render loop (crashed with "Maximum update depth exceeded")
// the first time a billboard had no existing messages.
const EMPTY_MESSAGES: ChatMessage[] = []

export function ChatPanel({ billboardId, ownerName, onBack }: ChatPanelProps) {
  const messages = useChatStore(
    (s) => s.messagesByBillboard[billboardId] ?? EMPTY_MESSAGES,
  )
  const sendMessage = useChatStore((s) => s.sendMessage)
  const [draft, setDraft] = useState('')

  function handleSend() {
    const text = draft.trim()
    if (!text) return
    sendMessage(billboardId, text)
    setDraft('')
  }

  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-ink/50 uppercase hover:text-ink dark:text-paper/50 dark:hover:text-paper"
      >
        <ArrowLeft className="size-3.5" />
        Back to details
      </button>

      <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
        Chat with {ownerName}
      </h3>
      <p className="text-xs text-ink/50 dark:text-paper/50">
        Preview — simulated replies. Real messaging lands in Phase 6.
      </p>

      <div className="mt-4 flex-1 space-y-3 overflow-y-auto border-y border-dashed border-ink/15 py-4 dark:border-paper/15">
        {messages.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink/40 dark:text-paper/40">
            Say hello — ask about availability, pricing, or creative specs.
          </p>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex',
                m.sender === 'renter' ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] border px-3 py-2 text-sm',
                  m.sender === 'renter'
                    ? 'border-accent bg-accent text-paper'
                    : 'border-ink/15 bg-paper text-ink dark:border-paper/15 dark:bg-ink-soft dark:text-paper',
                )}
              >
                {m.text}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-3 flex gap-2">
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSend()
          }}
          placeholder="Type a message…"
          className="w-full border border-ink/15 bg-transparent px-3 py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/15 dark:placeholder:text-paper/30"
        />
        <Button onClick={handleSend} className="shrink-0 px-3">
          <Send className="size-4" />
        </Button>
      </div>
    </div>
  )
}
