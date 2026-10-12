import { Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { BookingStatusBadge } from '@/features/bookings'
import type { BookingStatus } from '@/types'
import { useOwnerBookings } from './useRentorBookings'

const EARNED_STATUSES = new Set<BookingStatus>(['confirmed', 'active', 'completed'])
const PENDING_STATUSES = new Set<BookingStatus>(['payment_pending'])

function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', short)} – ${e.toLocaleDateString('en-US', { ...short, year: 'numeric' })}`
}

export function EarningsPanel() {
  const formatPrice = useFormatPrice()
  const { data } = useOwnerBookings()
  const requests = data ?? []

  const earned = requests
    .filter((r) => EARNED_STATUSES.has(r.status))
    .reduce((sum, r) => sum + r.priceQuoted, 0)
  const pending = requests
    .filter((r) => PENDING_STATUSES.has(r.status))
    .reduce((sum, r) => sum + r.priceQuoted, 0)
  const payoutRows = [...requests]
    .filter((r) => EARNED_STATUSES.has(r.status) || PENDING_STATUSES.has(r.status))
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Total earned
          </span>
          <p className="mt-1 font-display text-2xl font-semibold text-accent">
            {formatPrice(earned)}
          </p>
        </Card>
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Pending payout
          </span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {formatPrice(pending)}
          </p>
        </Card>
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Paid bookings
          </span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {payoutRows.length}
          </p>
        </Card>
      </div>

      <Card ticks className="p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Payout history
        </h3>
        {payoutRows.length === 0 ? (
          <p className="mt-4 text-sm text-ink/40 dark:text-paper/40">
            No paid or in-progress bookings yet.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {payoutRows.map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-3 border-b border-ink/5 pb-2 text-sm last:border-0 dark:border-paper/10"
              >
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.billboardTitle}</p>
                  <p className="font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                    {r.renterName} · {formatDateRange(r.startDate, r.endDate)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <BookingStatusBadge status={r.status} />
                  <span className="font-mono font-semibold text-accent">
                    {formatPrice(r.priceQuoted)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
