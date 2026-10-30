import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs, type TabItem } from '@/components'
import { useAdvanceBookingLifecycle } from '@/hooks/useAdvanceBookingLifecycle'
import { BookingInboxPanel } from './BookingInboxPanel'
import { EarningsPanel } from './EarningsPanel'
import { MessagesPanel } from './MessagesPanel'
import { MyBillboardsPanel } from './MyBillboardsPanel'
import { useOwnerBookings } from './useRentorBookings'

const TAB_KEYS = new Set(['billboards', 'bookings', 'messages', 'earnings'])

// The active tab lives in the URL (`?tab=`), and notification links
// (`/rentor?booking=<id>`) open the Bookings tab focused on that booking —
// also when the dashboard is already open, since only the params change.
export function RentorDashboardPage() {
  useAdvanceBookingLifecycle()
  const [searchParams, setSearchParams] = useSearchParams()
  const focusBookingId = searchParams.get('booking')
  const tabParam = searchParams.get('tab')
  const tab =
    tabParam && TAB_KEYS.has(tabParam)
      ? tabParam
      : focusBookingId
        ? 'bookings'
        : 'billboards'

  function setTab(key: string) {
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev)
        next.set('tab', key)
        // Leaving the focused booking behind once the owner moves on.
        if (key !== 'bookings') next.delete('booking')
        return next
      },
      { replace: true },
    )
  }
  const { data } = useOwnerBookings()
  const pendingCount = (data ?? []).filter(
    (r) => r.status === 'pending_owner_review',
  ).length

  const tabs = useMemo<TabItem[]>(
    () => [
      { key: 'billboards', label: 'My billboards' },
      {
        key: 'bookings',
        label: pendingCount > 0 ? `Bookings (${pendingCount})` : 'Bookings',
      },
      { key: 'messages', label: 'Messages' },
      { key: 'earnings', label: 'Earnings' },
    ],
    [pendingCount],
  )

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        Owner dashboard
      </h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Manage your billboards and review booking requests from here.
      </p>

      <div className="mt-6">
        <Tabs items={tabs} active={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {tab === 'billboards' && <MyBillboardsPanel />}
        {tab === 'bookings' && (
          <BookingInboxPanel focusBookingId={focusBookingId} />
        )}
        {tab === 'messages' && <MessagesPanel />}
        {tab === 'earnings' && <EarningsPanel />}
      </div>
    </div>
  )
}
