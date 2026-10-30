import type { ReactNode } from 'react'
import { Card } from '@/components'
import { cn } from '@/lib/utils'
import { QueryState } from './AdminUi'
import { useAdminBillboards } from './useAdminBillboards'
import { useAllBookings } from './useAdminBookings'
import { useSucceededPaymentsTotal } from './useAdminPayments'
import { useFormatPrice } from './useCurrencySetting'
import { useAllUsers } from './useUsers'

// Bookings an owner has accepted (paid or not) — their quoted value is the
// "gross booking value", which is NOT revenue until a payment succeeds.
const GROSS_BOOKING_STATUSES = new Set<string>([
  'payment_pending',
  'confirmed',
  'active',
  'completed',
])

// Keyed by plain string so newer statuses ('expired') are labelled even
// before/after the shared `BookingStatus` type gains them.
const BOOKING_STATUS_LABEL: Record<string, string> = {
  pending_owner_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  payment_pending: 'Payment pending',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

const BILLBOARD_STATUS_LABEL: Record<string, string> = {
  active: 'Active',
  inactive: 'Inactive',
  flagged: 'Flagged',
  archived: 'Archived',
}

function humanize(status: string) {
  return status.replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase())
}

function countBy<T>(rows: T[], key: (row: T) => string) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const k = key(row)
    acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {})
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: ReactNode
  hint?: string
  accent?: boolean
}) {
  return (
    <Card className="p-4">
      <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
        {label}
      </span>
      <p
        className={cn(
          'mt-1 font-display text-2xl font-semibold',
          accent && 'text-accent',
        )}
      >
        {value}
      </p>
      {hint && (
        <p className="mt-1 text-[11px] text-ink/40 dark:text-paper/40">
          {hint}
        </p>
      )}
    </Card>
  )
}

function Breakdown({
  title,
  counts,
  labels,
}: {
  title: string
  counts: Record<string, number>
  labels: Record<string, string>
}) {
  const entries = Object.entries(counts).sort((a, b) => b[1] - a[1])
  return (
    <Card ticks className="p-5">
      <h3 className="font-display text-lg font-semibold tracking-tight">
        {title}
      </h3>
      {entries.length === 0 ? (
        <p className="mt-4 text-sm text-ink/40 dark:text-paper/40">
          Nothing yet.
        </p>
      ) : (
        <ul className="mt-4 space-y-2">
          {entries.map(([status, count]) => (
            <li
              key={status}
              className="flex items-center justify-between border-b border-ink/5 pb-2 text-sm last:border-0 dark:border-paper/10"
            >
              <span className="text-ink/70 dark:text-paper/70">
                {labels[status] ?? humanize(status)}
              </span>
              <span className="font-mono font-semibold">{count}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}

export function AnalyticsPanel() {
  const formatPrice = useFormatPrice()
  const billboardsQuery = useAdminBillboards()
  const usersQuery = useAllUsers()
  const bookingsQuery = useAllBookings()
  const revenueQuery = useSucceededPaymentsTotal()

  const queries = [billboardsQuery, usersQuery, bookingsQuery, revenueQuery]
  const isLoading = queries.some((q) => q.isLoading)
  const error = queries.find((q) => q.error)?.error ?? null

  if (isLoading || error) {
    return (
      <QueryState
        isLoading={isLoading}
        error={error}
        onRetry={() => queries.forEach((q) => q.error && q.refetch())}
        label="Loading analytics…"
      />
    )
  }

  const platformBillboards = billboardsQuery.data ?? []
  const users = usersQuery.data ?? []
  const allBookings = bookingsQuery.data ?? []
  const revenue = revenueQuery.data ?? { total: 0, count: 0 }

  const grossBookingValue = allBookings
    .filter((b) => GROSS_BOOKING_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.priceQuoted, 0)

  const bookingCounts = countBy(allBookings, (b) => b.status as string)
  const billboardCounts = countBy(platformBillboards, (b) => b.status as string)
  const flaggedCount = billboardCounts.flagged ?? 0
  const suspendedCount = users.filter((u) => u.status === 'suspended').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <StatCard
          label="Revenue"
          value={formatPrice(revenue.total)}
          hint={`Sum of ${revenue.count} confirmed (succeeded) payment${revenue.count === 1 ? '' : 's'}`}
          accent
        />
        <StatCard
          label="Gross booking value"
          value={formatPrice(grossBookingValue)}
          hint="Quoted value of approved bookings, paid or not"
        />
        <StatCard label="Bookings" value={allBookings.length} />
        <StatCard label="Billboards" value={platformBillboards.length} />
        <StatCard label="Users" value={users.length} />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Breakdown
          title="Booking status breakdown"
          counts={bookingCounts}
          labels={BOOKING_STATUS_LABEL}
        />
        <Breakdown
          title="Billboard status breakdown"
          counts={billboardCounts}
          labels={BILLBOARD_STATUS_LABEL}
        />

        <Card ticks className="p-5">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Moderation snapshot
          </h3>
          <ul className="mt-4 space-y-2 text-sm">
            <li className="flex items-center justify-between border-b border-ink/5 pb-2 dark:border-paper/10">
              <span className="text-ink/70 dark:text-paper/70">
                Flagged billboards
              </span>
              <span className="font-mono font-semibold text-brand-error">
                {flaggedCount}
              </span>
            </li>
            <li className="flex items-center justify-between">
              <span className="text-ink/70 dark:text-paper/70">
                Suspended users
              </span>
              <span className="font-mono font-semibold text-brand-error">
                {suspendedCount}
              </span>
            </li>
          </ul>
        </Card>
      </div>
      <p className="text-[11px] text-ink/40 dark:text-paper/40">
        Figures are computed in the browser from full table reads; server-side
        aggregation is planned for larger datasets.
      </p>
    </div>
  )
}
