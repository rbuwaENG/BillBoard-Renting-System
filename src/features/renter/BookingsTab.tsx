import { Star } from 'lucide-react'
import { useState } from 'react'
import { BillboardMark, Button, Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { BookingStatusBadge, CreativeLink } from '@/features/bookings'
import type { Booking } from '@/types'
import { formatDateRange } from './formatDateRange'
import { useMyBookings, useRenterPayBooking } from './useMyBookings'
import { ReviewDialog } from './ReviewDialog'

const SPEND_COUNTED_STATUSES = new Set<Booking['status']>([
  'payment_pending',
  'confirmed',
  'active',
  'completed',
])
const ACTIVE_STATUSES = new Set<Booking['status']>([
  'approved',
  'payment_pending',
  'confirmed',
  'active',
])

interface BookingsTabProps {
  onSelectBillboard: (id: string) => void
}

export function BookingsTab({ onSelectBillboard }: BookingsTabProps) {
  const formatPrice = useFormatPrice()
  const { data } = useMyBookings()
  const myBookings = data ?? []
  const payBooking = useRenterPayBooking()
  const [payingId, setPayingId] = useState<string | null>(null)
  const [reviewingBooking, setReviewingBooking] = useState<
    { id: string; billboardTitle: string } | null
  >(null)
  const bookings = [...myBookings].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  )
  const activeCount = myBookings.filter((b) =>
    ACTIVE_STATUSES.has(b.status),
  ).length
  const totalSpend = myBookings
    .filter((b) => SPEND_COUNTED_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.priceQuoted, 0)

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Bookings
          </span>
          <p className="mt-1 font-display text-xl font-semibold">
            {myBookings.length}
          </p>
        </Card>
        <Card className="p-3">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Active
          </span>
          <p className="mt-1 font-display text-xl font-semibold">
            {activeCount}
          </p>
        </Card>
        <Card className="p-3">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Total spend
          </span>
          <p className="mt-1 font-display text-xl font-semibold text-accent">
            {formatPrice(totalSpend)}
          </p>
        </Card>
      </div>

      <div className="mt-6 space-y-2">
        {bookings.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink/40 dark:text-paper/40">
            No bookings yet — request a billboard from the list to get
            started.
          </p>
        ) : (
          bookings.map((booking) => (
            <div
              key={booking.id}
              className="border border-ink/10 p-3 dark:border-paper/15"
            >
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center self-start bg-paper-dim dark:bg-ink">
                  <BillboardMark className="size-4 text-ink/15 dark:text-paper/15" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-semibold tracking-tight">
                    {booking.billboardTitle}
                  </p>
                  <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                    {booking.billboardCity} ·{' '}
                    {formatDateRange(booking.startDate, booking.endDate)}
                  </p>
                </div>

                <div className="shrink-0">
                  <BookingStatusBadge status={booking.status} />
                </div>
              </div>

              {booking.creativeUrl && <CreativeLink path={booking.creativeUrl} />}

              <div className="mt-2.5 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-accent">
                  {formatPrice(booking.priceQuoted)}
                </span>
                <div className="flex shrink-0 items-center gap-2">
                  {booking.status === 'payment_pending' && (
                    <Button
                      size="sm"
                      disabled={payBooking.isPending && payingId === booking.id}
                      onClick={() => {
                        setPayingId(booking.id)
                        payBooking.mutate(booking.id, {
                          onSuccess: () => setPayingId(null),
                        })
                      }}
                    >
                      {payBooking.isPending && payingId === booking.id
                        ? 'Paying…'
                        : 'Pay now'}
                    </Button>
                  )}
                  {booking.status !== 'rejected' &&
                    booking.status !== 'cancelled' &&
                    (booking.review ? (
                      <span className="flex items-center gap-1 font-mono text-xs text-ink/50 dark:text-paper/50">
                        <Star className="size-3.5 fill-accent text-accent" />
                        {booking.review.rating}/5
                      </span>
                    ) : (
                      <Button
                        variant="secondary"
                        size="sm"
                        disabled={booking.status !== 'completed'}
                        title={
                          booking.status !== 'completed'
                            ? 'Available once this booking is marked completed'
                            : undefined
                        }
                        onClick={() =>
                          setReviewingBooking({
                            id: booking.id,
                            billboardTitle: booking.billboardTitle,
                          })
                        }
                      >
                        Leave a review
                      </Button>
                    ))}
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSelectBillboard(booking.billboardId)}
                  >
                    View on map
                  </Button>
                </div>
              </div>

              {booking.status === 'payment_pending' && (
                <p className="mt-1.5 text-right text-[11px] text-ink/40 italic dark:text-paper/40">
                  No live payment gateway is configured yet — "Pay now"
                  simulates a successful payment.
                </p>
              )}

              {payBooking.isError && payingId === booking.id && (
                <p className="mt-1.5 text-right text-xs text-brand-error">
                  {(payBooking.error as Error).message}
                </p>
              )}
            </div>
          ))
        )}
      </div>

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
