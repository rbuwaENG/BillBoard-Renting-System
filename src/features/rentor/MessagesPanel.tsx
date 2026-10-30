import { useMemo, useState } from 'react'
import { BillboardMark } from '@/components'
import { ChatPanel } from '@/features/chat/ChatPanel'
import { useOwnerChatThreads } from '@/features/chat/useChat'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { PanelError, PanelLoading } from './PanelState'

function lastActivity(thread: {
  createdAt: string
  lastMessage: { createdAt: string } | null
}) {
  return thread.lastMessage?.createdAt ?? thread.createdAt
}

export function MessagesPanel() {
  const { user } = useAuth()
  const { data, isLoading, isError, error, refetch } = useOwnerChatThreads()
  // Most recent conversation first.
  const threads = useMemo(
    () =>
      [...(data ?? [])].sort((a, b) =>
        lastActivity(b).localeCompare(lastActivity(a)),
      ),
    [data],
  )
  const [activeThread, setActiveThread] = useState<{
    id: string
    title: string
  } | null>(null)

  if (activeThread) {
    return (
      <ChatPanel
        threadId={activeThread.id}
        title={activeThread.title}
        onBack={() => setActiveThread(null)}
      />
    )
  }

  if (isLoading) return <PanelLoading label="Loading conversations…" />
  if (isError) {
    return (
      <PanelError
        error={error}
        onRetry={() => refetch()}
        label="Couldn't load your conversations."
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
    <ul className="space-y-2">
      {threads.map((thread) => {
        // No read receipts in the schema yet, so the closest honest signal is
        // "the renter spoke last" — i.e. the thread is waiting on you.
        const awaitingReply =
          !!thread.lastMessage && thread.lastMessage.senderId !== user?.uid
        return (
          <li key={thread.id}>
            <button
              type="button"
              onClick={() =>
                setActiveThread({
                  id: thread.id,
                  title: thread.counterpartName,
                })
              }
              className={cn(
                'relative flex w-full items-center gap-3 border bg-paper p-3 text-left transition-colors hover:border-accent focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none dark:bg-ink-soft',
                awaitingReply
                  ? 'border-accent/40'
                  : 'border-ink/12 dark:border-paper/15',
              )}
            >
              <div className="flex size-9 shrink-0 items-center justify-center bg-paper-dim dark:bg-ink">
                <BillboardMark className="size-4 text-ink/15 dark:text-paper/15" />
              </div>
              <div className="min-w-0 flex-1">
                <p
                  className={cn(
                    'truncate text-sm',
                    awaitingReply ? 'font-bold' : 'font-semibold',
                  )}
                >
                  {thread.counterpartName}
                </p>
                <p className="truncate text-xs text-ink/50 dark:text-paper/50">
                  {thread.billboardTitle}
                </p>
                {thread.lastMessage && (
                  <p
                    className={cn(
                      'mt-0.5 truncate text-xs',
                      awaitingReply
                        ? 'text-ink/70 dark:text-paper/70'
                        : 'text-ink/40 dark:text-paper/40',
                    )}
                  >
                    {thread.lastMessage.senderId === user?.uid && 'You: '}
                    {thread.lastMessage.body || 'Sent an attachment'}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-mono text-[10px] tracking-wide text-ink/40 uppercase dark:text-paper/40">
                  {new Date(lastActivity(thread)).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
                </span>
                {awaitingReply && (
                  <>
                    <span
                      aria-hidden="true"
                      title="Awaiting your reply"
                      className="size-2 rounded-full bg-accent"
                    />
                    <span className="sr-only">Awaiting your reply</span>
                  </>
                )}
              </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
