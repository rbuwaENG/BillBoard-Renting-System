import { ArrowLeft, Paperclip, Send, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Button } from '@/components'
import { useAuth } from '@/hooks/useAuth'
import {
  fileTypeError,
  MEDIA_ACCEPT,
  MEDIA_MIME_TYPES,
  MEDIA_TYPES_LABEL,
} from '@/lib/fileKind'
import { cn } from '@/lib/utils'
import { ChatAttachmentBubble } from './ChatAttachmentBubble'
import { uploadChatAttachment } from './chatAttachmentStorage'
import { useChatMessages, useSendChatMessage } from './useChat'

interface ChatPanelProps {
  threadId: string
  title: string
  onBack: () => void
}

function describeError(err: unknown) {
  if (err && typeof err === 'object' && 'message' in err) {
    const message = (err as { message: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return 'Please try again.'
}

export function ChatPanel({ threadId, title, onBack }: ChatPanelProps) {
  const { user } = useAuth()
  const { data, isLoading, isError, refetch } = useChatMessages(threadId)
  const messages = data ?? []
  const sendMessage = useSendChatMessage()
  const [draft, setDraft] = useState('')
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null)
  const [fileInputKey, setFileInputKey] = useState(0)
  const [uploading, setUploading] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  // Synchronous guard: state updates don't land between two fast Enter
  // presses, so a ref is what actually prevents a double send.
  const inFlight = useRef(false)

  const sending = uploading || sendMessage.isPending
  const canSend = !sending && (!!draft.trim() || !!attachmentFile)

  async function handleSend() {
    const body = draft.trim()
    if ((!body && !attachmentFile) || !user || inFlight.current) return
    inFlight.current = true
    setSendError(null)

    try {
      let attachmentPath: string | undefined
      if (attachmentFile) {
        setUploading(true)
        try {
          attachmentPath = await uploadChatAttachment(attachmentFile, threadId)
        } catch (err) {
          setSendError(`Attachment upload failed: ${describeError(err)}`)
          return
        } finally {
          setUploading(false)
        }
      }

      try {
        await sendMessage.mutateAsync({
          threadId,
          senderId: user.uid,
          body,
          attachmentPath,
        })
      } catch (err) {
        // Keep the draft and attachment so the user can retry.
        setSendError(`Message not sent: ${describeError(err)}`)
        return
      }

      setDraft('')
      setAttachmentFile(null)
      setFileInputKey((k) => k + 1)
    } finally {
      inFlight.current = false
    }
  }

  return (
    <div className="flex h-full min-h-[22rem] flex-col">
      <button
        type="button"
        onClick={onBack}
        className="flex items-center gap-1.5 self-start font-mono text-[11px] tracking-widest text-ink/50 uppercase hover:text-ink focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none dark:text-paper/50 dark:hover:text-paper"
      >
        <ArrowLeft className="size-3.5" />
        Back
      </button>

      <h3 className="mt-3 font-display text-lg font-semibold tracking-tight">
        Chat with {title}
      </h3>

      <div
        aria-live="polite"
        className="mt-4 flex-1 space-y-3 overflow-y-auto border-y border-dashed border-ink/15 py-4 dark:border-paper/15"
      >
        {isLoading ? (
          <p
            role="status"
            className="py-6 text-center text-sm text-ink/40 dark:text-paper/40"
          >
            Loading messages…
          </p>
        ) : isError ? (
          <div role="alert" className="py-6 text-center">
            <p className="text-sm text-brand-error">Couldn't load messages.</p>
            <Button
              size="sm"
              variant="secondary"
              className="mt-2"
              onClick={() => refetch()}
            >
              Try again
            </Button>
          </div>
        ) : messages.length === 0 ? (
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
                {m.attachmentPath && (
                  <ChatAttachmentBubble path={m.attachmentPath} />
                )}
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
            onClick={() => {
              setAttachmentFile(null)
              setFileInputKey((k) => k + 1)
            }}
            disabled={sending}
            title="Remove attachment"
            aria-label="Remove attachment"
            className="shrink-0 text-ink/40 hover:text-brand-error dark:text-paper/40"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {sendError && (
        <p role="alert" className="mt-3 text-xs text-brand-error">
          {sendError}
        </p>
      )}

      <div className="mt-3 flex gap-2">
        <label
          title="Attach an image, video, or file"
          className="flex shrink-0 cursor-pointer items-center justify-center border border-ink/15 px-3 text-ink/60 focus-within:ring-2 focus-within:ring-accent/60 hover:text-ink dark:border-paper/15 dark:text-paper/60 dark:hover:text-paper"
        >
          <Paperclip className="size-4" />
          <input
            key={fileInputKey}
            type="file"
            accept={MEDIA_ACCEPT}
            aria-label="Attach an image, video, or file"
            className="sr-only"
            disabled={sending}
            onChange={(e) => {
              const file = e.target.files?.[0] ?? null
              const typeProblem = file
                ? fileTypeError(file, MEDIA_MIME_TYPES, MEDIA_TYPES_LABEL)
                : null
              if (typeProblem) {
                setAttachmentFile(null)
                setSendError(typeProblem)
                setFileInputKey((k) => k + 1)
                return
              }
              setAttachmentFile(file)
              setSendError(null)
            }}
          />
        </label>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
              e.preventDefault()
              if (canSend) void handleSend()
            }
          }}
          aria-label="Message"
          placeholder="Type a message…"
          className="w-full border border-ink/15 bg-transparent px-3 py-2 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/15 dark:placeholder:text-paper/30"
        />
        <Button
          onClick={() => void handleSend()}
          disabled={!canSend}
          aria-label={sending ? 'Sending message' : 'Send message'}
          title="Send"
          className="shrink-0 px-3"
        >
          {sending ? '…' : <Send className="size-4" />}
        </Button>
      </div>
    </div>
  )
}
