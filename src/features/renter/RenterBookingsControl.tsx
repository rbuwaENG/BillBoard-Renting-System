import { ClipboardList, X } from 'lucide-react'
import { useMemo } from 'react'
import { Tabs, type TabItem } from '@/components'
import { MapIconButton } from '@/features/billboards/MapIconButton'
import {
  useMapPopoverStore,
  type ActivityTabKey,
} from '@/features/billboards/mapPopoverStore'
import { useListedDraft } from '@/features/campaigns/useListedDraft'
import { useMyChatThreads } from '@/features/chat/useChat'
import { BookingsTab } from './BookingsTab'
import { CampaignsTab } from './CampaignsTab'
import { MessagesTab } from './MessagesTab'
import { PaymentHistoryTab } from './PaymentHistoryTab'
import { useMyBookings } from './useMyBookings'

interface RenterBookingsControlProps {
  onSelectBillboard: (id: string) => void
  onSelectBooking?: (billboardId: string, bookingId: string) => void
}

// Renter-side equivalent of CampaignControl in MapOverlayControls: a box
// anchored to the top-right of the map (not a separate routed page) so the
// map stays visible underneath on desktop. Closed by default; on phones it
// spans the viewport width (minus a small gutter) instead of overflowing.
export function RenterBookingsControl({
  onSelectBillboard,
  onSelectBooking,
}: RenterBookingsControlProps) {
  const open = useMapPopoverStore((s) => s.active === 'activity')
  const togglePopover = useMapPopoverStore((s) => s.toggle)
  const closePopover = useMapPopoverStore((s) => s.close)
  const tab = useMapPopoverStore((s) => s.activityTab)
  const setTab = useMapPopoverStore((s) => s.setActivityTab)
  const { data: myBookings } = useMyBookings()
  const { count: draftCount } = useListedDraft()
  const { data: threadsData } = useMyChatThreads()
  const threadCount = threadsData?.length ?? 0
  const bookingCount = (myBookings ?? []).length

  const tabs = useMemo<TabItem[]>(
    () => [
      { key: 'bookings', label: 'Bookings' },
      { key: 'payments', label: 'Payments' },
      {
        key: 'campaigns',
        label: draftCount > 0 ? `Campaigns (${draftCount})` : 'Campaigns',
      },
      {
        key: 'messages',
        label: threadCount > 0 ? `Messages (${threadCount})` : 'Messages',
      },
    ],
    [draftCount, threadCount],
  )

  return (
    <div className="pointer-events-auto">
      <MapIconButton
        title={
          bookingCount > 0
            ? `My activity (${bookingCount} bookings)`
            : 'My activity'
        }
        aria-expanded={open}
        active={open}
        onClick={() => togglePopover('activity')}
        className="relative"
      >
        <ClipboardList className="size-4" />
        {bookingCount > 0 && (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper"
          >
            {bookingCount}
          </span>
        )}
      </MapIconButton>

      {open && (
        <div
          role="dialog"
          aria-label="My activity"
          className="fixed inset-x-2 top-20 z-[600] flex max-h-[calc(100svh-6rem)] flex-col border border-ink/10 bg-paper shadow-2xl sm:inset-x-auto sm:right-16 sm:w-[34rem] sm:max-w-[calc(100vw-5rem)] sm:max-h-[80svh] dark:border-paper/15 dark:bg-ink-soft"
        >
          <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-3 py-3 sm:px-5 sm:py-4 dark:border-paper/15">
            <h2 className="font-display text-lg font-semibold tracking-tight sm:text-xl">
              My activity
            </h2>
            <button
              type="button"
              onClick={closePopover}
              title="Close"
              aria-label="Close My activity"
              className="text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="px-3 pt-2 sm:px-5 sm:pt-3">
            <Tabs
              items={tabs}
              active={tab}
              onChange={(key) => setTab(key as ActivityTabKey)}
            />
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-4 sm:px-5">
            {tab === 'bookings' && (
              <BookingsTab
                onSelectBillboard={onSelectBillboard}
                onSelectBooking={onSelectBooking}
              />
            )}
            {tab === 'payments' && <PaymentHistoryTab />}
            {tab === 'campaigns' && (
              <CampaignsTab onSelectBillboard={onSelectBillboard} />
            )}
            {tab === 'messages' && <MessagesTab />}
          </div>
        </div>
      )}
    </div>
  )
}
