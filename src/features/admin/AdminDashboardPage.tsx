import { useState } from 'react'
import { Tabs, type TabItem } from '@/components'
import { AnalyticsPanel } from './AnalyticsPanel'
import { ModerationPanel } from './ModerationPanel'
import { TaxonomyPanel } from './TaxonomyPanel'
import { UsersPanel } from './UsersPanel'

const TABS: TabItem[] = [
  { key: 'analytics', label: 'Analytics' },
  { key: 'users', label: 'Users' },
  { key: 'moderation', label: 'Moderation' },
  { key: 'taxonomy', label: 'Taxonomy' },
]

export function AdminDashboardPage() {
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
        {tab === 'taxonomy' && <TaxonomyPanel />}
      </div>
    </div>
  )
}
