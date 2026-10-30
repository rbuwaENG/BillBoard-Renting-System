import { MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { BillboardMark, Button, Card } from '@/components'
import { useBillboards } from '@/features/billboards/useBillboards'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { useMyChatThreads, useStartChatThread } from '@/features/chat/useChat'
import { ListState } from './ListState'
import { useMyBookings } from './useMyBookings'

export function MessagesTab() {
  const { data: billboardsData } = useBillboards()
  const billboards = billboardsData ?? []
  const { data: myBookings } = useMyBookings()
  const {
    data: threadsData,
    isLoading: threadsLoading,
    isError: threadsError,
    error: threadsErrorValue,
    refetch: refetchThreads,
  } = useMyChatThreads()
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
        <ListState
          isLoading={threadsLoading}
          isError={threadsError}
          error={threadsErrorValue}
          isEmpty={threads.length === 0}
          loadingText="Loading conversations…"
          errorText="Couldn't load your conversations."
          emptyText="No conversations yet — open any billboard and tap “Message” to ask its owner a question, no booking needed."
          onRetry={() => refetchThreads()}
          className="mt-3"
        >
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
        </ListState>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Start a conversation
        </h3>
        <p className="mt-0.5 text-xs text-ink/50 dark:text-paper/50">
          You can message any owner from a billboard's details, before or
          after booking. Billboards you've booked are listed here for quick
          access.
        </p>
        {startableIds.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            Nothing to start here — billboards you book will show up for a
            quick message.
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
    <div className="flex shrink-0 flex-col items-end gap-1">
      <Button
        size="sm"
        disabled={startThread.isPending}
        onClick={() =>
          startThread.mutate(billboardId, {
            onSuccess: (thread) => onStarted({ id: thread.id, title: ownerName }),
          })
        }
      >
        <MessageCircle className="size-3.5" />
        {startThread.isPending ? 'Opening…' : 'Message'}
      </Button>
      {startThread.isError && (
        <span role="alert" className="text-[11px] text-brand-error">
          Couldn't open the chat.
        </span>
      )}
    </div>
  )
}
