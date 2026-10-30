import { X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Card } from '@/components'
import { isInProgress } from '@/features/bookings'
import { useRequestBooking } from '@/features/bookings/useRequestBooking'
import { CampaignDraftForm } from '@/features/campaigns/CampaignDraftForm'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { useListedDraft } from '@/features/campaigns/useListedDraft'
import { todayISO } from '@/features/bookings/dateRange'
import { formatDateRange } from './formatDateRange'
import { ListState } from './ListState'
import {
  useMyCampaigns,
  type Campaign,
  type CampaignItem,
} from './useCampaigns'
import { useMyBookings } from './useMyBookings'

interface CampaignsTabProps {
  onSelectBillboard: (id: string) => void
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  booked: 'border-brand-success/40 text-brand-success',
  failed: 'border-brand-error/40 text-brand-error',
  pending: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
}

const STATUS_LABEL: Record<string, string> = {
  booked: 'Requested',
  failed: 'Not booked',
  pending: 'Pending',
}

// The full create-campaign flow, surfaced here (not only in the small
// map-corner cart popover in MapOverlayControls.tsx) so it's discoverable
// from the same panel where bookings/messages already live.
export function CampaignsTab({ onSelectBillboard }: CampaignsTabProps) {
  const removeFromDraft = useCampaignStore((s) => s.removeFromDraft)
  const { draftBillboards, staleIds } = useListedDraft()
  const {
    data: campaignsData,
    isLoading,
    isError,
    error,
    refetch,
  } = useMyCampaigns()
  const campaigns = campaignsData ?? []

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Draft
        </h3>
        <p className="mt-0.5 text-xs text-ink/50 dark:text-paper/50">
          Add billboards to your draft from Browse or the map, then bundle them
          into a campaign below.
        </p>

        {draftBillboards.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            Your draft is empty.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {draftBillboards.map((b) => (
              <li
                key={b.id}
                className="flex items-center justify-between gap-2 border border-ink/10 px-3 py-2 text-sm dark:border-paper/15"
              >
                <button
                  type="button"
                  onClick={() => onSelectBillboard(b.id)}
                  className="truncate text-left hover:text-accent"
                >
                  {b.title}
                </button>
                <button
                  type="button"
                  onClick={() => removeFromDraft(b.id)}
                  title="Remove"
                  aria-label={`Remove ${b.title} from draft`}
                  className="shrink-0 text-ink/40 hover:text-brand-error dark:text-paper/40"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        {staleIds.length > 0 && (
          <p className="mt-2 flex items-center justify-between gap-2 text-xs text-ink/50 dark:text-paper/50">
            <span>
              {staleIds.length === 1
                ? '1 billboard in your draft is no longer listed.'
                : `${staleIds.length} billboards in your draft are no longer listed.`}
            </span>
            <button
              type="button"
              onClick={() => staleIds.forEach(removeFromDraft)}
              className="shrink-0 font-mono text-[11px] text-accent uppercase hover:underline"
            >
              Remove
            </button>
          </p>
        )}

        <div className="mt-4 border-t border-dashed border-ink/15 pt-4 dark:border-paper/15">
          <CampaignDraftForm draftBillboards={draftBillboards} />
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          My campaigns
        </h3>

        <ListState
          isLoading={isLoading}
          isError={isError}
          error={error}
          isEmpty={campaigns.length === 0}
          loadingText="Loading campaigns…"
          errorText="Couldn't load your campaigns."
          emptyText="No campaigns yet — add billboards to a draft from Browse, then create one."
          onRetry={() => refetch()}
          className="mt-3"
        >
          <div className="mt-3 space-y-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onSelectBillboard={onSelectBillboard}
              />
            ))}
          </div>
        </ListState>
      </div>
    </div>
  )
}

function CampaignCard({
  campaign,
  onSelectBillboard,
}: {
  campaign: Campaign
  onSelectBillboard: (id: string) => void
}) {
  const failedCount = campaign.items.filter((i) => i.status === 'failed').length
  return (
    <Card className="p-4">
      <div>
        <p className="font-display text-sm font-semibold tracking-tight">
          {campaign.name}
        </p>
        <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
          {formatDateRange(campaign.startDate, campaign.endDate)} ·{' '}
          {campaign.items.length} billboard
          {campaign.items.length !== 1 ? 's' : ''}
          {failedCount > 0 && ` · ${failedCount} not booked`}
        </p>
      </div>
      <ul className="mt-3 space-y-1.5">
        {campaign.items.map((item) => (
          <CampaignItemRow
            key={item.billboardId}
            item={item}
            campaign={campaign}
            onSelectBillboard={onSelectBillboard}
          />
        ))}
      </ul>
    </Card>
  )
}

// Failed items show their reason inline. "Book separately" retries with
// request_booking for the campaign's dates — the campaign item itself can't
// be updated from the client, so the new request appears under Bookings.
function CampaignItemRow({
  item,
  campaign,
  onSelectBillboard,
}: {
  item: CampaignItem
  campaign: Campaign
  onSelectBillboard: (id: string) => void
}) {
  const requestBooking = useRequestBooking()
  const { data: myBookings } = useMyBookings()
  const [retried, setRetried] = useState(false)
  const alreadyRequested =
    retried ||
    (myBookings ?? []).some(
      (b) =>
        b.billboardId === item.billboardId &&
        b.startDate === campaign.startDate &&
        b.endDate === campaign.endDate &&
        isInProgress(b.status),
    )
  const canRetry = item.status === 'failed' && campaign.startDate >= todayISO()

  return (
    <li className="border border-ink/10 px-2.5 py-2 dark:border-paper/15">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onSelectBillboard(item.billboardId)}
          className="min-w-0 truncate text-left font-mono text-[11px] text-ink/70 uppercase hover:text-accent dark:text-paper/70"
        >
          {item.billboardTitle}
        </button>
        <Badge className={STATUS_BADGE_CLASSES[item.status]}>
          {STATUS_LABEL[item.status] ?? item.status}
        </Badge>
      </div>
      {item.status === 'failed' && (
        <div className="mt-1.5 flex flex-wrap items-start justify-between gap-2">
          <p className="min-w-0 flex-1 text-xs text-brand-error">
            {item.failureReason ?? 'This billboard could not be booked.'}
          </p>
          {canRetry &&
            (alreadyRequested ? (
              <span className="shrink-0 font-mono text-[11px] text-brand-success uppercase">
                Requested separately
              </span>
            ) : (
              <button
                type="button"
                disabled={requestBooking.isPending}
                onClick={() =>
                  requestBooking.mutate(
                    {
                      billboardId: item.billboardId,
                      startDate: campaign.startDate,
                      endDate: campaign.endDate,
                    },
                    { onSuccess: () => setRetried(true) },
                  )
                }
                className="shrink-0 font-mono text-[11px] text-accent uppercase hover:underline disabled:opacity-50"
              >
                {requestBooking.isPending ? 'Requesting…' : 'Book separately'}
              </button>
            ))}
        </div>
      )}
      {requestBooking.isError && (
        <p role="alert" className="mt-1 text-xs text-brand-error">
          Retry failed: {(requestBooking.error as Error).message}
        </p>
      )}
    </li>
  )
}
