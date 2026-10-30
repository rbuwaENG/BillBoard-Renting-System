import { ChatPanel } from './ChatPanel'
import { useChatThread } from './useChat'

interface RenterChatPanelProps {
  billboardId: string
  ownerName: string
  onBack: () => void
}

// Resolves (or lazily creates) the renter's thread for a billboard, then
// hands off to the thread-agnostic ChatPanel.
export function RenterChatPanel({
  billboardId,
  ownerName,
  onBack,
}: RenterChatPanelProps) {
  const { data: thread, isLoading } = useChatThread(billboardId)

  if (isLoading || !thread) {
    return (
      <div className="flex h-full min-h-[22rem] items-center justify-center">
        <p className="text-sm text-ink/40 dark:text-paper/40">
          {isLoading
            ? 'Opening conversation…'
            : 'Could not open this conversation.'}
        </p>
      </div>
    )
  }

  return <ChatPanel threadId={thread.id} title={ownerName} onBack={onBack} />
}
