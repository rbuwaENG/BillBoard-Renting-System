import { MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { BillboardMark, Button, Card } from '@/components'
import { useBillboards } from '@/features/billboards/useBillboards'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { useChatStore } from '@/features/chat/chatStore'
import { useMyBookings } from './useMyBookings'

// A renter-wide inbox over the same per-billboard chat store the billboard
// detail dialog writes to (src/features/chat/chatStore.ts) — previously the
// only way to reach a conversation was reopening that billboard's dialog.
export function MessagesTab() {
  const { data: billboardsData } = useBillboards()
  const billboards = billboardsData ?? []
  const { data: myBookings } = useMyBookings()
  const messagesByBillboard = useChatStore((s) => s.messagesByBillboard)
  const [activeBillboardId, setActiveBillboardId] = useState<string | null>(
    null,
  )

  const threadIds = Object.keys(messagesByBillboard).filter(
    (id) => messagesByBillboard[id].length > 0,
  )
  const bookedIds = Array.from(
    new Set((myBookings ?? []).map((b) => b.billboardId)),
  )
  const startableIds = bookedIds.filter((id) => !threadIds.includes(id))

  const activeBillboard = activeBillboardId
    ? billboards.find((b) => b.id === activeBillboardId)
    : null

  if (activeBillboard) {
    return (
      <ChatPanel
        billboardId={activeBillboard.id}
        ownerName={activeBillboard.ownerName}
        onBack={() => setActiveBillboardId(null)}
      />
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Conversations
        </h3>
        {threadIds.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            No conversations yet — message an owner from a billboard's
            details, or start one below.
          </p>
        ) : (
          <div className="mt-3 space-y-2">
            {threadIds.map((id) => {
              const billboard = billboards.find((b) => b.id === id)
              if (!billboard) return null
              const thread = messagesByBillboard[id]
              const last = thread[thread.length - 1]
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveBillboardId(id)}
                  className="flex w-full items-center gap-3 border border-ink/10 p-3 text-left hover:border-accent dark:border-paper/15"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center bg-paper-dim dark:bg-ink">
                    <BillboardMark className="size-4 text-ink/15 dark:text-paper/15" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold">
                      {billboard.ownerName}
                    </p>
                    <p className="truncate text-xs text-ink/50 dark:text-paper/50">
                      {billboard.title}
                    </p>
                    {last && (
                      <p className="mt-0.5 truncate text-xs text-ink/40 dark:text-paper/40">
                        {last.sender === 'renter' ? 'You: ' : ''}
                        {last.text}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
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
                  <Button size="sm" onClick={() => setActiveBillboardId(id)}>
                    <MessageCircle className="size-3.5" />
                    Message
                  </Button>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
