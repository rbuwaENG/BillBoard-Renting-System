import { Card } from '@/components'
import { MOCK_BOOKINGS } from '@/features/renter/mockBookings'
import { useRentorBookingStore } from '@/features/rentor/rentorBookingStore'
import type { Booking, BookingStatus } from '@/types'
import { usePlatformBillboardsStore } from './platformBillboardsStore'
import { useUserStore } from './userStore'

const REVENUE_STATUSES = new Set<BookingStatus>([
  'payment_pending',
  'confirmed',
  'active',
  'completed',
])

const STATUS_LABEL: Record<BookingStatus, string> = {
  pending_owner_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  payment_pending: 'Payment pending',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

// Platform-wide figures computed across two local preview datasets — the
// Renter's booking history (src/features/renter/mockBookings.ts) and the
// Rentor's booking inbox (src/features/rentor/rentorBookingStore.ts) — since
// there's no single Firestore `bookings` collection yet (PLAN.md section 3).
// Phase 9 replaces this with a real aggregation query/Cloud Function.
export function AnalyticsPanel() {
  const platformBillboards = usePlatformBillboardsStore((s) => s.billboards)
  const users = useUserStore((s) => s.users)
  const rentorRequests = useRentorBookingStore((s) => s.requests)

  const allBookings: Booking[] = [...MOCK_BOOKINGS, ...rentorRequests]

  const totalRevenue = allBookings
    .filter((b) => REVENUE_STATUSES.has(b.status))
    .reduce((sum, b) => sum + b.priceQuoted, 0)

  const statusCounts = allBookings.reduce<Record<string, number>>((acc, b) => {
    acc[b.status] = (acc[b.status] ?? 0) + 1
    return acc
  }, {})

  const flaggedCount = platformBillboards.filter(
    (b) => b.status === 'flagged',
  ).length
  const suspendedCount = users.filter((u) => u.status === 'suspended').length

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Revenue
          </span>
          <p className="mt-1 font-display text-2xl font-semibold text-accent">
            ${totalRevenue.toLocaleString()}
          </p>
        </Card>
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Bookings
          </span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {allBookings.length}
          </p>
        </Card>
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Billboards
          </span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {platformBillboards.length}
          </p>
        </Card>
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Users
          </span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {users.length}
          </p>
        </Card>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <Card ticks className="p-5">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Booking status breakdown
          </h3>
          <ul className="mt-4 space-y-2">
            {Object.entries(statusCounts).map(([status, count]) => (
              <li
                key={status}
                className="flex items-center justify-between border-b border-ink/5 pb-2 text-sm last:border-0 dark:border-paper/10"
              >
                <span className="text-ink/70 dark:text-paper/70">
                  {STATUS_LABEL[status as BookingStatus]}
                </span>
                <span className="font-mono font-semibold">{count}</span>
              </li>
            ))}
          </ul>
        </Card>

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
    </div>
  )
}
