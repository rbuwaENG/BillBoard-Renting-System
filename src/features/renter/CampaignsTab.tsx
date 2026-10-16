import { X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card } from '@/components'
import { useBillboards, type BillboardWithDetails } from '@/features/billboards/useBillboards'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { formatDateRange } from './formatDateRange'
import { useCreateCampaign, useMyCampaigns } from './useCampaigns'

interface CampaignsTabProps {
  onSelectBillboard: (id: string) => void
}

const STATUS_BADGE_CLASSES: Record<string, string> = {
  booked: 'border-brand-success/40 text-brand-success',
  failed: 'border-brand-error/40 text-brand-error',
  pending: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
}

// The full create-campaign flow, surfaced here (not only in the small
// map-corner FolderPlus popover in MapOverlayControls.tsx) so it's
// discoverable from the same panel where bookings/messages already live.
export function CampaignsTab({ onSelectBillboard }: CampaignsTabProps) {
  const formatPrice = useFormatPrice()
  const { data: billboardsData } = useBillboards()
  const billboards = billboardsData ?? []
  const draftIds = useCampaignStore((s) => s.draftIds)
  const removeFromDraft = useCampaignStore((s) => s.removeFromDraft)
  const clearDraft = useCampaignStore((s) => s.clearDraft)
  const { data: campaignsData } = useMyCampaigns()
  const campaigns = campaignsData ?? []
  const createCampaign = useCreateCampaign()

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const draftBillboards = draftIds
    .map((id) => billboards.find((b) => b.id === id))
    .filter((b): b is BillboardWithDetails => Boolean(b))

  const datesInvalid = !!startDate && !!endDate && endDate < startDate
  const draftDays =
    startDate && endDate && !datesInvalid
      ? Math.max(
          1,
          Math.round(
            (new Date(endDate).getTime() - new Date(startDate).getTime()) /
              86_400_000,
          ) + 1,
        )
      : 0
  const draftTotal =
    draftBillboards.reduce((sum, b) => sum + b.pricePerDay, 0) * draftDays

  async function handleCreate() {
    if (
      !name.trim() ||
      !startDate ||
      !endDate ||
      datesInvalid ||
      draftBillboards.length === 0
    )
      return
    try {
      await createCampaign.mutateAsync({
        name: name.trim(),
        startDate,
        endDate,
        billboardIds: draftBillboards.map((b) => b.id),
      })
      setName('')
      setStartDate('')
      setEndDate('')
      clearDraft()
    } catch {
      // error surfaced via createCampaign.error below
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Draft
        </h3>
        <p className="mt-0.5 text-xs text-ink/50 dark:text-paper/50">
          Add billboards to your draft from Browse or the map, then bundle
          them into a campaign below.
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
                  className="shrink-0 text-ink/40 hover:text-brand-error dark:text-paper/40"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 space-y-2 border-t border-dashed border-ink/15 pt-4 dark:border-paper/15">
          <input
            type="text"
            placeholder="Campaign name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full border border-ink/15 bg-transparent px-2 py-1.5 text-sm focus:border-accent focus:outline-none dark:border-paper/15"
          />
          <div className="flex gap-2">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-1/2 border border-ink/15 bg-transparent px-2 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-paper/15"
            />
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 border border-ink/15 bg-transparent px-2 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-paper/15"
            />
          </div>
          {datesInvalid && (
            <p className="text-xs text-brand-error">
              End date must be on or after the start date.
            </p>
          )}
          {draftDays > 0 && draftBillboards.length > 0 && (
            <p className="text-right font-mono text-xs text-accent">
              Est. total {formatPrice(draftTotal)}
            </p>
          )}
          {createCampaign.isError && (
            <p className="text-xs text-brand-error">
              {(createCampaign.error as Error).message}
            </p>
          )}
          <Button
            className="w-full"
            disabled={
              !name.trim() ||
              !startDate ||
              !endDate ||
              datesInvalid ||
              draftBillboards.length === 0 ||
              createCampaign.isPending
            }
            onClick={handleCreate}
          >
            {createCampaign.isPending ? 'Creating campaign…' : 'Create campaign'}
          </Button>
        </div>
      </div>

      <div>
        <h3 className="font-display text-lg font-semibold tracking-tight">
          My campaigns
        </h3>

        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            No campaigns yet — add billboards to a draft from Browse, then
            create one.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {campaigns.map((campaign) => (
              <Card key={campaign.id} className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-display text-sm font-semibold tracking-tight">
                      {campaign.name}
                    </p>
                    <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                      {formatDateRange(campaign.startDate, campaign.endDate)}{' '}
                      · {campaign.items.length} billboard
                      {campaign.items.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {campaign.items.map((item) => (
                    <button
                      key={item.billboardId}
                      type="button"
                      onClick={() => onSelectBillboard(item.billboardId)}
                      title={item.failureReason ?? undefined}
                      className="flex items-center gap-1.5 border border-ink/15 px-2 py-1 font-mono text-[11px] uppercase text-ink/70 hover:border-accent hover:text-accent dark:border-paper/15 dark:text-paper/70"
                    >
                      {item.billboardTitle}
                      <Badge className={STATUS_BADGE_CLASSES[item.status]}>
                        {item.status}
                      </Badge>
                    </button>
                  ))}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
