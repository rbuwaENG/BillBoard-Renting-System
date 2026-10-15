import { useMemo, useState } from 'react'
import { Tabs, type TabItem } from '@/components'
import { useAdvanceBookingLifecycle } from '@/hooks/useAdvanceBookingLifecycle'
import { BookingInboxPanel } from './BookingInboxPanel'
import { EarningsPanel } from './EarningsPanel'
import { MessagesPanel } from './MessagesPanel'
import { MyBillboardsPanel } from './MyBillboardsPanel'
import { useOwnerBookings } from './useRentorBookings'

export function RentorDashboardPage() {
  useAdvanceBookingLifecycle()
  const [tab, setTab] = useState('billboards')
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
        Rentor dashboard
      </h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Manage your billboards and review booking requests from here.
      </p>

      <div className="mt-6">
        <Tabs items={tabs} active={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {tab === 'billboards' && <MyBillboardsPanel />}
        {tab === 'bookings' && <BookingInboxPanel />}
        {tab === 'messages' && <MessagesPanel />}
        {tab === 'earnings' && <EarningsPanel />}
      </div>
    </div>
  )
}
