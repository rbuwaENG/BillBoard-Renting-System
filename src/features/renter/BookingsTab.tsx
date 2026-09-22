import { BillboardMark, Button, Card } from '@/components'
import { MOCK_BILLBOARDS } from '@/features/billboards/mockBillboards'
import { BookingStatusBadge } from '@/features/bookings'
import type { Booking } from '@/types'
import { formatDateRange } from './formatDateRange'
import { MOCK_BOOKINGS } from './mockBookings'

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
  const bookings = [...MOCK_BOOKINGS].sort((a, b) =>
    b.startDate.localeCompare(a.startDate),
  )
  const activeCount = MOCK_BOOKINGS.filter((b) =>
    ACTIVE_STATUSES.has(b.status),
  ).length
  const totalSpend = MOCK_BOOKINGS.filter((b) =>
    SPEND_COUNTED_STATUSES.has(b.status),
  ).reduce((sum, b) => sum + b.priceQuoted, 0)

  return (
    <div>
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Bookings
          </span>
          <p className="mt-1 font-display text-xl font-semibold">
            {MOCK_BOOKINGS.length}
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
            ${totalSpend.toLocaleString()}
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
          bookings.map((booking) => {
            const billboard = MOCK_BILLBOARDS.find(
              (b) => b.id === booking.billboardId,
            )
            if (!billboard) return null
            return (
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
                      {billboard.title}
                    </p>
                    <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                      {billboard.location.city} ·{' '}
                      {formatDateRange(booking.startDate, booking.endDate)}
                    </p>
                  </div>

                  <div className="shrink-0">
                    <BookingStatusBadge status={booking.status} />
                  </div>
                </div>

                <div className="mt-2.5 flex items-center justify-between gap-2">
                  <span className="font-mono text-sm font-semibold text-accent">
                    ${booking.priceQuoted.toLocaleString()}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => onSelectBillboard(billboard.id)}
                    className="shrink-0"
                  >
                    View on map
                  </Button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
