import { ArrowLeft, Paperclip, Send, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { ChatAttachmentBubble } from './ChatAttachmentBubble'
import { uploadChatAttachment } from './chatAttachmentStorage'
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
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  async function handleSend() {
    const body = draft.trim()
    if ((!body && !attachmentFile) || !user) return

    let attachmentPath: string | undefined
    if (attachmentFile) {
      setUploading(true)
      try {
        attachmentPath = await uploadChatAttachment(attachmentFile, threadId)
      } catch (err) {
        console.error('Attachment upload failed:', err)
        setUploading(false)
        return
      }
      setUploading(false)
    }

    sendMessage.mutate({ threadId, senderId: user.uid, body, attachmentPath })
    setDraft('')
    setAttachmentFile(null)
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
                  'max-w-[80%] space-y-1.5 border px-3 py-2 text-sm',
                  m.senderId === user?.uid
                    ? 'border-accent bg-accent text-paper'
                    : 'border-ink/15 bg-paper text-ink dark:border-paper/15 dark:bg-ink-soft dark:text-paper',
                )}
              >
                {m.attachmentPath && <ChatAttachmentBubble path={m.attachmentPath} />}
                {m.body && <p>{m.body}</p>}
              </div>
            </div>
          ))
        )}
      </div>

      {attachmentFile && (
        <div className="mt-3 flex items-center gap-2 border border-ink/15 bg-paper-dim px-2 py-1.5 text-xs dark:border-paper/15 dark:bg-ink">
          <Paperclip className="size-3.5 shrink-0 text-ink/50 dark:text-paper/50" />
          <span className="min-w-0 flex-1 truncate">{attachmentFile.name}</span>
          <button
            type="button"
            onClick={() => setAttachmentFile(null)}
            title="Remove attachment"
            className="shrink-0 text-ink/40 hover:text-brand-error dark:text-paper/40"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <label
          title="Attach an image, video, or file"
          className="flex shrink-0 cursor-pointer items-center justify-center border border-ink/15 px-3 text-ink/60 hover:text-ink dark:border-paper/15 dark:text-paper/60 dark:hover:text-paper"
        >
          <Paperclip className="size-4" />
          <input
            type="file"
            accept="image/*,video/*,application/pdf"
            className="hidden"
            onChange={(e) => setAttachmentFile(e.target.files?.[0] ?? null)}
          />
        </label>
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
        <Button
          onClick={handleSend}
          disabled={uploading || (!draft.trim() && !attachmentFile)}
          className="shrink-0 px-3"
        >
          {uploading ? '…' : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
