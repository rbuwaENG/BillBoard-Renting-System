import { Star } from 'lucide-react'
import { useState } from 'react'
import { BillboardMark, Button, Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import {
  BookingStatusBadge,
  CreativeLink,
  EXPIRED_PAYMENT_COPY,
  EXPIRED_REQUEST_COPY,
  getBookingPrimaryCta,
  isInProgress,
  useBookingEvents,
  type AnyBookingStatus,
} from '@/features/bookings'
import { PAYMENT_STATE_MESSAGE } from '@/features/payments/paymentState'
import { formatDateRange } from './formatDateRange'
import { ListState } from './ListState'
import { MarkPaidDialog } from './MarkPaidDialog'
import { ReviewDialog } from './ReviewDialog'
import { useMyBookings, type MyBooking } from './useMyBookings'
import { useMyPayments } from './useMyPayments'

interface BookingsTabProps {
  onSelectBillboard: (id: string) => void
  // Opens the billboard dialog on this booking's workspace; falls back to
  // onSelectBillboard when not provided.
  onSelectBooking?: (billboardId: string, bookingId: string) => void
}

export function BookingsTab({
  onSelectBillboard,
  onSelectBooking,
}: BookingsTabProps) {
  const formatPrice = useFormatPrice()
  const { data, isLoading, isError, error, refetch } = useMyBookings()
  const {
    data: payments,
    isLoading: paymentsLoading,
    isError: paymentsError,
  } = useMyPayments()
  const myBookings = data ?? []
  const [paying, setPaying] = useState<MyBooking | null>(null)
  const [reviewingBooking, setReviewingBooking] = useState<{
    id: string
    billboardTitle: string
  } | null>(null)
  const bookings = [...myBookings].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  )
  const activeCount = myBookings.filter((b) => isInProgress(b.status)).length
  // Money actually paid — confirmed (succeeded) payments only, not quotes.
  const totalSpend = (payments ?? [])
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)

  function openBooking(booking: MyBooking) {
    if (onSelectBooking) onSelectBooking(booking.billboardId, booking.id)
    else onSelectBillboard(booking.billboardId)
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <Card className="p-2.5 sm:p-3">
          <span className="font-mono text-[10px] tracking-widest text-ink/50 uppercase sm:text-[11px] dark:text-paper/50">
            Bookings
          </span>
          <p className="mt-1 font-display text-lg font-semibold sm:text-xl">
            {isLoading ? '—' : myBookings.length}
          </p>
        </Card>
        <Card className="p-2.5 sm:p-3">
          <span className="font-mono text-[10px] tracking-widest text-ink/50 uppercase sm:text-[11px] dark:text-paper/50">
            In progress
          </span>
          <p className="mt-1 font-display text-lg font-semibold sm:text-xl">
            {isLoading ? '—' : activeCount}
          </p>
        </Card>
        <Card className="p-2.5 sm:p-3">
          <span className="font-mono text-[10px] tracking-widest text-ink/50 uppercase sm:text-[11px] dark:text-paper/50">
            Total paid
          </span>
          <p className="mt-1 truncate font-display text-lg font-semibold text-accent sm:text-xl">
            {paymentsLoading || paymentsError ? '—' : formatPrice(totalSpend)}
          </p>
        </Card>
      </div>

      <div className="mt-6 space-y-2">
        <ListState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={bookings.length === 0}
          loadingText="Loading your bookings…"
          errorText="Couldn't load your bookings."
          emptyText="No bookings yet — request a billboard from the list to get started."
          onRetry={() => refetch()}
        >
          {bookings.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              onPay={() => setPaying(booking)}
              onReview={() =>
                setReviewingBooking({
                  id: booking.id,
                  billboardTitle: booking.billboardTitle,
                })
              }
              onOpen={() => openBooking(booking)}
            />
          ))}
        </ListState>
      </div>

      <MarkPaidDialog
        booking={paying}
        resubmit={paying?.paymentState === 'rejected'}
        onOpenChange={(open) => {
          if (!open) setPaying(null)
        }}
      />

      {reviewingBooking && (
        <ReviewDialog
          bookingId={reviewingBooking.id}
          billboardTitle={reviewingBooking.billboardTitle}
          open={reviewingBooking !== null}
          onOpenChange={(open) => {
            if (!open) setReviewingBooking(null)
          }}
        />
      )}
    </div>
  )
}

function BookingRow({
  booking,
  onPay,
  onReview,
  onOpen,
}: {
  booking: MyBooking
  onPay: () => void
  onReview: () => void
  onOpen: () => void
}) {
  const formatPrice = useFormatPrice()
  const status = booking.status as AnyBookingStatus
  // Events are only needed to know whether the owner asked for documents
  // (which gates payment), so only fetch them while payment is due.
  const { data: events } = useBookingEvents(
    status === 'payment_pending' || status === 'pending_owner_review'
      ? booking.id
      : null,
  )
  const cta = getBookingPrimaryCta(booking, events ?? [], {
    paymentState: booking.paymentState,
    hasReview: !!booking.review,
  })

  const paymentMessage =
    status === 'payment_pending' &&
    booking.paymentState !== 'none' &&
    booking.paymentState !== 'paid'
      ? PAYMENT_STATE_MESSAGE[booking.paymentState]
      : null

  return (
    <div className="border border-ink/10 p-3 dark:border-paper/15">
      <div className="flex items-start gap-3">
        <div className="flex size-10 shrink-0 items-center justify-center self-start bg-paper-dim dark:bg-ink">
          <BillboardMark className="size-4 text-ink/15 dark:text-paper/15" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-sm font-semibold tracking-tight">
            {booking.billboardTitle}
          </p>
          <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
            {booking.billboardCity ? `${booking.billboardCity} · ` : ''}
            {formatDateRange(booking.startDate, booking.endDate)}
          </p>
        </div>

        <div className="shrink-0">
          <BookingStatusBadge status={status} />
        </div>
      </div>

      {booking.creativeUrl && <CreativeLink path={booking.creativeUrl} />}

      <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm font-semibold text-accent">
          {formatPrice(booking.priceQuoted)}
        </span>
        <div className="flex flex-wrap items-center justify-end gap-2">
          {cta?.key === 'upload-documents' && (
            <Button size="sm" onClick={onOpen}>
              Upload documents
            </Button>
          )}
          {cta?.key === 'complete-payment' && (
            <Button size="sm" onClick={onPay}>
              {cta.label}
            </Button>
          )}
          {cta?.key === 'leave-review' && (
            <Button variant="secondary" size="sm" onClick={onReview}>
              Leave a review
            </Button>
          )}
          {booking.review && (
            <span className="flex items-center gap-1 font-mono text-xs text-ink/50 dark:text-paper/50">
              <Star
                className="size-3.5 fill-accent text-accent"
                aria-hidden="true"
              />
              {booking.review.rating}/5
              <span className="sr-only"> stars — your review</span>
            </span>
          )}
          {booking.billboardListed ? (
            <Button variant="secondary" size="sm" onClick={onOpen}>
              View on map
            </Button>
          ) : (
            <span className="font-mono text-[11px] tracking-wide text-ink/40 uppercase dark:text-paper/40">
              No longer listed
            </span>
          )}
        </div>
      </div>

      {cta?.key === 'upload-documents' && status === 'payment_pending' && (
        <p className="mt-1.5 text-right text-[11px] text-ink/50 dark:text-paper/50">
          The owner asked for documents — upload them before paying.
        </p>
      )}
      {paymentMessage && (
        <p
          role="status"
          className={
            booking.paymentState === 'rejected'
              ? 'mt-1.5 text-right text-xs text-brand-error'
              : 'mt-1.5 text-right text-xs text-accent'
          }
        >
          {paymentMessage}
        </p>
      )}
      {status === 'expired' && (
        <p className="mt-1.5 text-right text-[11px] text-ink/50 dark:text-paper/50">
          {booking.decisionAt ? EXPIRED_PAYMENT_COPY : EXPIRED_REQUEST_COPY}
        </p>
      )}
    </div>
  )
}
