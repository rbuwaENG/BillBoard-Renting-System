import { useId, useState } from 'react'
import { Button } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { estimateCartTotal } from '@/features/billboards/pricing'
import { useCartPricingTiers } from '@/features/billboards/useCartPricing'
import type { BillboardWithDetails } from '@/features/billboards/useBillboards'
import {
  bookingDays,
  hasDateErrors,
  todayISO,
  validateDateRange,
} from '@/features/bookings/dateRange'
import { useCreateCampaign } from '@/features/renter/useCampaigns'
import { cn } from '@/lib/utils'
import { useCampaignStore } from './campaignStore'

// Server cap from create_campaign (contract 3).
export const MAX_CAMPAIGN_BILLBOARDS = 20

interface CampaignDraftFormProps {
  draftBillboards: BillboardWithDetails[]
  compact?: boolean
  onCreated?: () => void
}

// Name + date range + estimate + submit for the cart, shared by the map's
// cart popover and the "Campaigns" tab of My activity. The estimate prices
// every billboard with its own tiers for the chosen duration — the same
// precedence request_booking applies — so it matches what gets quoted.
export function CampaignDraftForm({
  draftBillboards,
  compact = false,
  onCreated,
}: CampaignDraftFormProps) {
  const formatPrice = useFormatPrice()
  const today = todayISO()
  const fieldId = useId()
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const clearDraft = useCampaignStore((s) => s.clearDraft)
  const createCampaign = useCreateCampaign()
  const { data: tiersByBillboard, isLoading: tiersLoading } =
    useCartPricingTiers(draftBillboards.map((b) => b.id))

  const dateErrors = validateDateRange(startDate, endDate, today)
  const datesInvalid = hasDateErrors(dateErrors)
  const days = datesInvalid ? 0 : bookingDays(startDate, endDate)
  const total = estimateCartTotal(draftBillboards, days, tiersByBillboard ?? {})
  const tooMany = draftBillboards.length > MAX_CAMPAIGN_BILLBOARDS

  const canSubmit =
    !!name.trim() &&
    !!startDate &&
    !!endDate &&
    !datesInvalid &&
    !tooMany &&
    draftBillboards.length > 0 &&
    !createCampaign.isPending

  async function handleCreate() {
    if (!canSubmit) return
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
      onCreated?.()
    } catch {
      // error surfaced via createCampaign.error below
    }
  }

  const inputClass = cn(
    'w-full border border-ink/15 bg-transparent px-2 py-1.5 focus:border-accent focus:outline-none dark:border-paper/15',
    compact ? 'text-xs' : 'text-sm',
  )
  const labelClass =
    'mb-1 block font-mono text-[10px] tracking-widest text-ink/50 uppercase dark:text-paper/50'

  return (
    <div className="space-y-2">
      <label className="block">
        <span className={labelClass}>Campaign name</span>
        <input
          type="text"
          placeholder="e.g. Summer launch"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </label>
      <div className="flex gap-2">
        <label className="block w-1/2">
          <span className={labelClass}>Start date</span>
          <input
            type="date"
            value={startDate}
            min={today}
            aria-invalid={!!dateErrors.start}
            aria-describedby={dateErrors.start ? `${fieldId}-start` : undefined}
            onChange={(e) => setStartDate(e.target.value)}
            className={inputClass}
          />
        </label>
        <label className="block w-1/2">
          <span className={labelClass}>End date</span>
          <input
            type="date"
            value={endDate}
            min={startDate && startDate > today ? startDate : today}
            aria-invalid={!!dateErrors.end}
            aria-describedby={dateErrors.end ? `${fieldId}-end` : undefined}
            onChange={(e) => setEndDate(e.target.value)}
            className={inputClass}
          />
        </label>
      </div>
      {dateErrors.start && (
        <p id={`${fieldId}-start`} className="text-xs text-brand-error">
          {dateErrors.start}
        </p>
      )}
      {dateErrors.end && (
        <p id={`${fieldId}-end`} className="text-xs text-brand-error">
          {dateErrors.end}
        </p>
      )}
      {tooMany && (
        <p className="text-xs text-brand-error">
          A campaign can include up to {MAX_CAMPAIGN_BILLBOARDS} billboards —
          remove {draftBillboards.length - MAX_CAMPAIGN_BILLBOARDS} to continue.
        </p>
      )}
      {days > 0 && draftBillboards.length > 0 && (
        <p className="text-right font-mono text-xs text-accent">
          {tiersLoading ? (
            'Calculating total…'
          ) : (
            <>
              Est. total {formatPrice(total)}
              <span className="text-ink/40 dark:text-paper/40">
                {' '}
                · {days} day{days !== 1 ? 's' : ''}
              </span>
            </>
          )}
        </p>
      )}
      {createCampaign.isError && (
        <p role="alert" className="text-xs text-brand-error">
          {(createCampaign.error as Error).message}
        </p>
      )}
      <Button
        size={compact ? 'sm' : 'md'}
        className="w-full"
        disabled={!canSubmit}
        onClick={handleCreate}
      >
        {createCampaign.isPending ? 'Creating campaign…' : 'Create campaign'}
      </Button>
    </div>
  )
}
