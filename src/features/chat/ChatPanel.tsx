import { ArrowLeft, Send } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { useChatMessages, useSendChatMessage } from './useChat'

interface ChatPanelProps {
  threadId: string
  title: string
  onBack: () => void
}

export function ChatPanel({ threadId, title, onBack }: ChatPanelProps) {
  const { user } = useAuth()
  const { data } = useChatMessages(threadId)
  const messages = data ?? []
  const sendMessage = useSendChatMessage()
  const [draft, setDraft] = useState('')

  function handleSend() {
    const body = draft.trim()
    if (!body || !user) return
    sendMessage.mutate({ threadId, senderId: user.uid, body })
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
        Back
      </button>

      <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
        Chat with {title}
      </h3>

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
                m.senderId === user?.uid ? 'justify-end' : 'justify-start',
              )}
            >
              <div
                className={cn(
                  'max-w-[80%] border px-3 py-2 text-sm',
                  m.senderId === user?.uid
                    ? 'border-accent bg-accent text-paper'
                    : 'border-ink/15 bg-paper text-ink dark:border-paper/15 dark:bg-ink-soft dark:text-paper',
                )}
              >
                {m.body}
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
