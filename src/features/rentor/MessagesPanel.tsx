import { useState } from 'react'
import { BillboardMark, Card } from '@/components'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { useOwnerChatThreads } from '@/features/chat/useChat'

export function MessagesPanel() {
  const { data } = useOwnerChatThreads()
  const threads = data ?? []
  const [activeThread, setActiveThread] = useState<
    { id: string; title: string } | null
  >(null)

  if (activeThread) {
    return (
      <ChatPanel
        threadId={activeThread.id}
        title={activeThread.title}
        onBack={() => setActiveThread(null)}
      />
    )
  }

  if (threads.length === 0) {
    return (
      <p className="py-10 text-center text-sm text-ink/40 dark:text-paper/40">
        No messages yet — renters can message you from a billboard's details.
      </p>
    )
  }

  return (
    <div className="space-y-2">
      {threads.map((thread) => (
        <Card
          key={thread.id}
          className="flex w-full cursor-pointer items-center gap-3 p-3 text-left hover:border-accent"
          onClick={() =>
            setActiveThread({ id: thread.id, title: thread.counterpartName })
          }
        >
          <div className="flex size-9 shrink-0 items-center justify-center bg-paper-dim dark:bg-ink">
            <BillboardMark className="size-4 text-ink/15 dark:text-paper/15" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">
              {thread.counterpartName}
            </p>
            <p className="truncate text-xs text-ink/50 dark:text-paper/50">
              {thread.billboardTitle}
            </p>
            {thread.lastMessage && (
              <p className="mt-0.5 truncate text-xs text-ink/40 dark:text-paper/40">
                {thread.lastMessage.body}
              </p>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
