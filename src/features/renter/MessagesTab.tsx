import { MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { BillboardMark, Button, Card } from '@/components'
import { useBillboards } from '@/features/billboards/useBillboards'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { useMyChatThreads, useStartChatThread } from '@/features/chat/useChat'
import { useMyBookings } from './useMyBookings'

export function MessagesTab() {
  const { data: billboardsData } = useBillboards()
  const billboards = billboardsData ?? []
  const { data: myBookings } = useMyBookings()
  const { data: threadsData } = useMyChatThreads()
  const threads = threadsData ?? []
  const [activeThread, setActiveThread] = useState<
    { id: string; title: string } | null
  >(null)

  const threadBillboardIds = new Set(threads.map((t) => t.billboardId))
  const bookedIds = Array.from(
    new Set((myBookings ?? []).map((b) => b.billboardId)),
  )
  const startableIds = bookedIds.filter((id) => !threadBillboardIds.has(id))

  if (activeThread) {
    return (
      <ChatPanel
        threadId={activeThread.id}
        title={activeThread.title}
        onBack={() => setActiveThread(null)}
      />
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Conversations
        </h3>
        {threads.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            No conversations yet — message an owner from a billboard's
            details, or start one below.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {threads.map((thread) => (
              <button
                key={thread.id}
                type="button"
                onClick={() =>
                  setActiveThread({ id: thread.id, title: thread.counterpartName })
                }
                className="flex w-full items-center gap-3 border border-ink/10 p-3 text-left hover:border-accent dark:border-paper/15"
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
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Start a conversation
        </h3>
        {startableIds.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            Book a billboard to unlock a direct line to its owner.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {startableIds.map((id) => {
              const billboard = billboards.find((b) => b.id === id)
              if (!billboard) return null
              return (
                <Card
                  key={id}
                  className="flex items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {billboard.title}
                    </p>
                    <p className="truncate text-xs text-ink/50 dark:text-paper/50">
                      {billboard.ownerName}
                    </p>
                  </div>
                  <StartChatButton
                    billboardId={id}
                    ownerName={billboard.ownerName}
                    onStarted={setActiveThread}
                  />
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function StartChatButton({
  billboardId,
  ownerName,
  onStarted,
}: {
  billboardId: string
  ownerName: string
  onStarted: (thread: { id: string; title: string }) => void
}) {
  const startThread = useStartChatThread()
  return (
    <Button
      size="sm"
      disabled={startThread.isPending}
      onClick={async () => {
        const thread = await startThread.mutateAsync(billboardId)
        onStarted({ id: thread.id, title: ownerName })
      }}
    >
      <MessageCircle className="size-3.5" />
      Message
    </Button>
  )
}
