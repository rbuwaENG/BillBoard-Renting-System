import { Trash2, X } from 'lucide-react'
import { useState } from 'react'
import { Badge, Button, Card } from '@/components'
import {
  MOCK_BILLBOARDS,
  type MockBillboard,
} from '@/features/billboards/mockBillboards'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { formatDateRange } from './formatDateRange'

interface CampaignsTabProps {
  onSelectBillboard: (id: string) => void
}

// The full create-campaign flow, surfaced here (not only in the small
// map-corner FolderPlus popover in MapOverlayControls.tsx) so it's
// discoverable from the same panel where bookings/messages already live.
export function CampaignsTab({ onSelectBillboard }: CampaignsTabProps) {
  const draftIds = useCampaignStore((s) => s.draftIds)
  const removeFromDraft = useCampaignStore((s) => s.removeFromDraft)
  const createCampaign = useCampaignStore((s) => s.createCampaign)
  const campaigns = useCampaignStore((s) => s.campaigns)
  const deleteCampaign = useCampaignStore((s) => s.deleteCampaign)

  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')

  const draftBillboards = draftIds
    .map((id) => MOCK_BILLBOARDS.find((b) => b.id === id))
    .filter((b): b is MockBillboard => Boolean(b))

  const draftDays =
    startDate && endDate
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

  function handleCreate() {
    if (!name.trim() || !startDate || !endDate || draftBillboards.length === 0)
      return
    createCampaign({ name: name.trim(), startDate, endDate })
    setName('')
    setStartDate('')
    setEndDate('')
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
              onChange={(e) => setEndDate(e.target.value)}
              className="w-1/2 border border-ink/15 bg-transparent px-2 py-1.5 text-xs focus:border-accent focus:outline-none dark:border-paper/15"
            />
          </div>
          {draftDays > 0 && draftBillboards.length > 0 && (
            <p className="text-right font-mono text-xs text-accent">
              Est. total ${draftTotal.toLocaleString()}
            </p>
          )}
          <Button
            className="w-full"
            disabled={
              !name.trim() ||
              !startDate ||
              !endDate ||
              draftBillboards.length === 0
            }
            onClick={handleCreate}
          >
            Create campaign
          </Button>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            My campaigns
          </h3>
          <Badge variant="accent">Preview data</Badge>
        </div>

        {campaigns.length === 0 ? (
          <p className="mt-3 text-sm text-ink/40 dark:text-paper/40">
            No campaigns yet — add billboards to a draft from Browse, then
            create one.
          </p>
        ) : (
          <div className="mt-3 space-y-3">
            {campaigns.map((campaign) => {
              const campaignBillboards = campaign.billboardIds
                .map((id) => MOCK_BILLBOARDS.find((b) => b.id === id))
                .filter((b): b is MockBillboard => Boolean(b))
              const days = Math.max(
                1,
                Math.round(
                  (new Date(campaign.endDate).getTime() -
                    new Date(campaign.startDate).getTime()) /
                    86_400_000,
                ) + 1,
              )
              const total =
                campaignBillboards.reduce((sum, b) => sum + b.pricePerDay, 0) *
                days

              return (
                <Card key={campaign.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-sm font-semibold tracking-tight">
                        {campaign.name}
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                        {formatDateRange(campaign.startDate, campaign.endDate)}{' '}
                        · {campaignBillboards.length} billboard
                        {campaignBillboards.length !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-3">
                      <span className="font-mono text-sm font-semibold text-accent">
                        ${total.toLocaleString()}
                      </span>
                      <button
                        type="button"
                        onClick={() => deleteCampaign(campaign.id)}
                        title="Delete campaign"
                        className="text-ink/40 hover:text-brand-error dark:text-paper/40"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {campaignBillboards.map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        onClick={() => onSelectBillboard(b.id)}
                        className="border border-ink/15 px-2 py-1 font-mono text-[11px] uppercase text-ink/70 hover:border-accent hover:text-accent dark:border-paper/15 dark:text-paper/70"
                      >
                        {b.title}
                      </button>
                    ))}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
