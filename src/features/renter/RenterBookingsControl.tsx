import { ClipboardList, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Tabs, type TabItem } from '@/components'
import { MapIconButton } from '@/features/billboards/MapIconButton'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { useMyChatThreads } from '@/features/chat/useChat'
import { BookingsTab } from './BookingsTab'
import { CampaignsTab } from './CampaignsTab'
import { MessagesTab } from './MessagesTab'
import { useMyBookings } from './useMyBookings'

interface RenterBookingsControlProps {
  onSelectBillboard: (id: string) => void
}

// Renter-side equivalent of CampaignControl in MapOverlayControls: a fixed
// box anchored to the top-right of the map (not a separate routed page and
// not a full-height drawer) so the map stays visible underneath. Tabbed so
// campaign creation and the chat inbox live in the same obvious place as
// bookings, instead of only in the small map-corner FolderPlus popover or
// inside a billboard's detail dialog.
export function RenterBookingsControl({
  onSelectBillboard,
}: RenterBookingsControlProps) {
  const [open, setOpen] = useState(true)
  const [tab, setTab] = useState('bookings')
  const { data: myBookings } = useMyBookings()
  const draftCount = useCampaignStore((s) => s.draftIds.length)
  const { data: threadsData } = useMyChatThreads()
  const threadCount = threadsData?.length ?? 0

  const tabs = useMemo<TabItem[]>(
    () => [
      { key: 'bookings', label: 'Bookings' },
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
        title="My activity"
        active={open}
        onClick={() => setOpen((o) => !o)}
        className="relative"
      >
        <ClipboardList className="size-4" />
        {(myBookings ?? []).length > 0 && (
          <span className="absolute -top-1.5 -right-1.5 flex size-4 items-center justify-center rounded-full bg-accent font-mono text-[9px] text-paper">
            {(myBookings ?? []).length}
          </span>
        )}
      </MapIconButton>

      {open && (
        <div className="fixed top-20 right-16 z-[600] flex max-h-[80svh] w-[34rem] max-w-[calc(100vw-2rem)] flex-col border border-ink/10 bg-paper shadow-2xl dark:border-paper/15 dark:bg-ink-soft">
          <div className="flex items-center justify-between gap-3 border-b border-ink/10 px-5 py-4 dark:border-paper/15">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-semibold tracking-tight">
                My activity
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              title="Close"
              className="text-ink/40 hover:text-ink dark:text-paper/40 dark:hover:text-paper"
            >
              <X className="size-5" />
            </button>
          </div>

          <div className="px-5 pt-3">
            <Tabs items={tabs} active={tab} onChange={setTab} />
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4">
            {tab === 'bookings' && (
              <BookingsTab onSelectBillboard={onSelectBillboard} />
            )}
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
