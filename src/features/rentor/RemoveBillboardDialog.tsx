import * as Dialog from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components'
import { errorMessage, isForeignKeyViolation } from './errors'
import {
  useDeleteBillboard,
  useSetBillboardStatus,
  type RentorBillboard,
} from './useRentorBillboards'

interface RemoveBillboardDialogProps {
  billboard: RentorBillboard | null
  onOpenChange: (open: boolean) => void
}

// Archive is the default way to take a listing down (contract 2): it hides
// the listing from renters but keeps its booking/payment history. A hard
// delete is only possible for listings that never had a booking — the
// bookings FK is ON DELETE RESTRICT, so the server answers 23503 otherwise.
// Render with `key={billboard?.id}` so per-listing error state resets.
export function RemoveBillboardDialog({
  billboard,
  onOpenChange,
}: RemoveBillboardDialogProps) {
  const setStatus = useSetBillboardStatus()
  const deleteBillboard = useDeleteBillboard()
  const [error, setError] = useState<string | null>(null)
  const [hasBookings, setHasBookings] = useState(false)

  const busy = setStatus.isPending || deleteBillboard.isPending
  const isArchived = billboard?.status === 'archived'
  const isFlagged = billboard?.status === 'flagged'
  const canArchive = !isArchived && !isFlagged

  function close(next: boolean) {
    if (!next && busy) return
    onOpenChange(next)
  }

  function archive() {
    if (!billboard || busy) return
    setError(null)
    setStatus.mutate(
      { id: billboard.id, status: 'archived' },
      {
        onSuccess: () => onOpenChange(false),
        onError: (err) =>
          setError(`Couldn't archive this listing: ${errorMessage(err)}`),
      },
    )
  }

  function remove() {
    if (!billboard || busy) return
    setError(null)
    deleteBillboard.mutate(billboard.id, {
      onSuccess: () => onOpenChange(false),
      onError: (err) => {
        if (isForeignKeyViolation(err)) {
          setHasBookings(true)
          setError(
            canArchive
              ? 'This listing has bookings — archive it instead.'
              : "This listing has bookings, so it can't be deleted.",
          )
        } else {
          setError(`Couldn't delete this listing: ${errorMessage(err)}`)
        }
      },
    })
  }

  return (
    <Dialog.Root open={!!billboard} onOpenChange={close}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[1900] bg-ink/50 backdrop-blur-[2px] dark:bg-ink/70" />
        <Dialog.Content className="fixed top-1/2 left-1/2 z-[2000] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-ink/10 bg-paper p-5 shadow-xl focus:outline-none dark:border-paper/15 dark:bg-ink-soft">
          <div className="flex items-start justify-between gap-3">
            <Dialog.Title className="font-display text-lg font-semibold tracking-tight">
              {canArchive ? 'Archive or delete listing?' : 'Delete listing?'}
            </Dialog.Title>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close"
                title="Close"
                disabled={busy}
                className="text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
              >
                <X className="size-5" />
              </button>
            </Dialog.Close>
          </div>

          <Dialog.Description className="mt-2 text-sm text-ink/70 dark:text-paper/70">
            <span className="font-semibold">{billboard?.title}</span>
            {canArchive
              ? ' — archiving hides it from renters and keeps its booking history; you can unarchive it any time. Deleting is permanent and only works for listings that have never been booked.'
              : isFlagged
                ? ' is flagged by an admin, so it can’t be archived. Deleting is permanent and only works for listings that have never been booked.'
                : ' — deleting is permanent and only works for listings that have never been booked.'}
          </Dialog.Description>

          {error && (
            <p role="alert" className="mt-3 text-xs text-brand-error">
              {error}
            </p>
          )}

          <div className="mt-5 flex flex-wrap justify-end gap-2">
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              variant={canArchive ? 'secondary' : 'danger'}
              disabled={busy || hasBookings}
              onClick={remove}
            >
              {deleteBillboard.isPending ? 'Deleting…' : 'Delete permanently'}
            </Button>
            {canArchive && (
              <Button size="sm" autoFocus disabled={busy} onClick={archive}>
                {setStatus.isPending ? 'Archiving…' : 'Archive'}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
