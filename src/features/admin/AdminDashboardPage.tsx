import { useState } from 'react'
import { Tabs, type TabItem } from '@/components'
import { useAdvanceBookingLifecycle } from '@/hooks/useAdvanceBookingLifecycle'
import { AnalyticsPanel } from './AnalyticsPanel'
import { AuditLogPanel } from './AuditLogPanel'
import { BookingsPanel } from './BookingsPanel'
import { ModerationPanel } from './ModerationPanel'
import { PaymentsPanel } from './PaymentsPanel'
import { PayoutsPanel } from './PayoutsPanel'
import { SettingsPanel } from './SettingsPanel'
import { TaxonomyPanel } from './TaxonomyPanel'
import { UsersPanel } from './UsersPanel'

const TABS: TabItem[] = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'users', label: 'Users' },
  { key: 'moderation', label: 'Moderation' },
  { key: 'bookings', label: 'Bookings' },
  { key: 'payments', label: 'Payments' },
  { key: 'payouts', label: 'Payouts' },
  { key: 'taxonomy', label: 'Taxonomy' },
  { key: 'audit', label: 'Audit log' },
  { key: 'settings', label: 'Settings' },
]

export function AdminDashboardPage() {
  useAdvanceBookingLifecycle()
  const [tab, setTab] = useState('analytics')

  return (
    <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
      <h1 className="font-display text-2xl font-semibold tracking-tight sm:text-3xl">
        Admin dashboard
      </h1>
      <p className="mt-1 text-sm text-ink/60 dark:text-paper/60">
        Oversee the platform, manage taxonomy, and moderate listings.
      </p>

      <div className="mt-6">
        <Tabs items={TABS} active={tab} onChange={setTab} />
      </div>

      <div className="mt-6">
        {tab === 'analytics' && <AnalyticsPanel />}
        {tab === 'users' && <UsersPanel />}
        {tab === 'moderation' && <ModerationPanel />}
        {tab === 'bookings' && <BookingsPanel />}
        {tab === 'payments' && <PaymentsPanel />}
        {tab === 'payouts' && <PayoutsPanel />}
        {tab === 'taxonomy' && <TaxonomyPanel />}
        {tab === 'audit' && <AuditLogPanel />}
        {tab === 'settings' && <SettingsPanel />}
      </div>
    </div>
  )
}
