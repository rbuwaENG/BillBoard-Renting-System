import * as Dialog from '@radix-ui/react-dialog'
import { Star, X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components'
import { cn } from '@/lib/utils'
import { useSubmitReview } from './useReviews'

interface ReviewDialogProps {
  bookingId: string
  billboardTitle: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReviewDialog({
  bookingId,
  billboardTitle,
  open,
  onOpenChange,
}: ReviewDialogProps) {
  const [rating, setRating] = useState(5)
  const [comment, setComment] = useState('')
  const submitReview = useSubmitReview()

  async function handleSubmit() {
    try {
      await submitReview.mutateAsync({ bookingId, rating, comment: comment.trim() || undefined })
      setComment('')
      setRating(5)
      onOpenChange(false)
    } catch {
      // error surfaced via submitReview.error below
    }
  }

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1900] bg-ink/50 backdrop-blur-[2px] dark:bg-ink/70" />
        <Dialog.Content
          className="fixed top-1/2 left-1/2 z-[2000] w-full max-w-sm -translate-x-1/2 -translate-y-1/2 border border-ink/10 bg-paper p-5 shadow-xl focus:outline-none dark:border-paper/15 dark:bg-ink-soft"
          aria-describedby={undefined}
        >
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-lg font-semibold tracking-tight">
              Review {billboardTitle}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                title="Close"
                className="shrink-0 text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="mt-4 flex items-center gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(n)}
                title={`${n} star${n > 1 ? 's' : ''}`}
              >
                <Star
                  className={cn(
                    'size-6',
                    n <= rating
                      ? 'fill-accent text-accent'
                      : 'text-ink/20 dark:text-paper/20',
                  )}
                />
              </button>
            ))}
          </div>

          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Share how the booking went (optional)"
            rows={3}
            className="mt-4 w-full resize-none border border-ink/15 bg-transparent px-2 py-1.5 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/15 dark:placeholder:text-paper/30"
          />

          {submitReview.isError && (
            <p className="mt-2 text-xs text-brand-error">
              {(submitReview.error as Error).message}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={submitReview.isPending}
            className="mt-4 w-full"
          >
            {submitReview.isPending ? 'Submitting…' : 'Submit review'}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
