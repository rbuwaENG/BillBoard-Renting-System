import * as Dialog from '@radix-ui/react-dialog'
import { Star, X } from 'lucide-react'
import { useRef, useState, type KeyboardEvent } from 'react'
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
  // No default — the renter has to pick a rating deliberately.
  const [rating, setRating] = useState(0)
  const starRefs = useRef<(HTMLButtonElement | null)[]>([])
  const [comment, setComment] = useState('')
  const submitReview = useSubmitReview()

  // Radio-group arrow-key behaviour: move + select.
  function handleStarKey(e: KeyboardEvent<HTMLButtonElement>, n: number) {
    let next: number | null = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') next = Math.min(5, n + 1)
    if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') next = Math.max(1, n - 1)
    if (next === null) return
    e.preventDefault()
    setRating(next)
    starRefs.current[next - 1]?.focus()
  }

  async function handleSubmit() {
    if (rating < 1) return
    try {
      await submitReview.mutateAsync({ bookingId, rating, comment: comment.trim() || undefined })
      setComment('')
      setRating(0)
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
                aria-label="Close"
                className="shrink-0 text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div
            role="radiogroup"
            aria-label="Rating"
            className="mt-4 flex items-center gap-1"
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                ref={(el) => {
                  starRefs.current[n - 1] = el
                }}
                type="button"
                role="radio"
                aria-checked={rating === n}
                aria-label={`${n} star${n > 1 ? 's' : ''}`}
                tabIndex={rating === n || (rating === 0 && n === 1) ? 0 : -1}
                onClick={() => setRating(n)}
                onKeyDown={(e) => handleStarKey(e, n)}
                title={`${n} star${n > 1 ? 's' : ''}`}
                className="focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
              >
                <Star
                  aria-hidden="true"
                  className={cn(
                    'size-6',
                    n <= rating
                      ? 'fill-accent text-accent'
                      : 'text-ink/20 dark:text-paper/20',
                  )}
                />
              </button>
            ))}
            <span className="ml-2 font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
              {rating > 0 ? `${rating}/5` : 'Choose a rating'}
            </span>
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
            disabled={submitReview.isPending || rating < 1}
            className="mt-4 w-full"
          >
            {submitReview.isPending ? 'Submitting…' : 'Submit review'}
          </Button>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
