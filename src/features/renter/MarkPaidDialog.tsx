import { useState } from 'react'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { ConfirmDialog } from '@/features/bookings/ConfirmDialog'
import { formatDateRange } from './formatDateRange'
import { useSubmitPayment } from './useMyBookings'

interface MarkPaidDialogProps {
  booking: {
    id: string
    billboardTitle: string
    startDate: string
    endDate: string
    priceQuoted: number
  } | null
  resubmit?: boolean
  onOpenChange: (open: boolean) => void
}

// "I've paid" → the renter reports a bank transfer (optional reference) via
// renter_submit_payment; an admin then confirms or rejects it.
export function MarkPaidDialog({
  booking,
  resubmit = false,
  onOpenChange,
}: MarkPaidDialogProps) {
  const formatPrice = useFormatPrice()
  const submitPayment = useSubmitPayment()
  const [reference, setReference] = useState('')

  function close(open: boolean) {
    if (!open) {
      setReference('')
      submitPayment.reset()
    }
    onOpenChange(open)
  }

  return (
    <ConfirmDialog
      open={booking !== null}
      onOpenChange={close}
      title={resubmit ? 'Resubmit payment' : 'Confirm your payment'}
      confirmLabel="Submit payment"
      pendingLabel="Submitting…"
      pending={submitPayment.isPending}
      error={
        submitPayment.isError ? (submitPayment.error as Error).message : null
      }
      onConfirm={() => {
        if (!booking) return
        submitPayment.mutate(
          { bookingId: booking.id, reference },
          { onSuccess: () => close(false) },
        )
      }}
    >
      {booking && (
        <>
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 border border-ink/10 p-3 font-mono text-xs dark:border-paper/15">
            <dt className="text-ink/50 uppercase dark:text-paper/50">
              Billboard
            </dt>
            <dd className="truncate text-ink dark:text-paper">
              {booking.billboardTitle}
            </dd>
            <dt className="text-ink/50 uppercase dark:text-paper/50">Dates</dt>
            <dd className="text-ink dark:text-paper">
              {formatDateRange(booking.startDate, booking.endDate)}
            </dd>
            <dt className="text-ink/50 uppercase dark:text-paper/50">Amount</dt>
            <dd className="font-semibold text-accent">
              {formatPrice(booking.priceQuoted)}
            </dd>
          </dl>
          <p>
            Only confirm once you've transferred the full amount. An admin will
            check the transfer and confirm your booking.
          </p>
          <label className="block">
            <span className="mb-1 block font-mono text-[11px] text-ink/50 uppercase dark:text-paper/50">
              Bank transfer reference (optional)
            </span>
            <input
              type="text"
              value={reference}
              maxLength={200}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TRX-20261030-001"
              className="w-full border-b border-ink/20 bg-transparent py-1.5 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
            />
          </label>
        </>
      )}
    </ConfirmDialog>
  )
}
