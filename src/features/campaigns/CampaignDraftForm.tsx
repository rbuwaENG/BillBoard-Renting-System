import { useState } from 'react'
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
import { AvailabilityCalendar } from '@/features/bookings/AvailabilityCalendar'
import {
  OVERLAP_MESSAGE,
  rangeOverlapsBooked,
} from '@/features/bookings/availability'
import { useCombinedBookedRanges } from '@/features/bookings/useBookedRanges'
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
  const [name, setName] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const clearDraft = useCampaignStore((s) => s.clearDraft)
  const createCampaign = useCreateCampaign()
  const { data: tiersByBillboard, isLoading: tiersLoading } =
    useCartPricingTiers(draftBillboards.map((b) => b.id))

  // A campaign books every board for the same dates, so a day booked on any
  // of them is unavailable for the whole cart.
  const booked = useCombinedBookedRanges(draftBillboards.map((b) => b.id))

  const dateErrors = validateDateRange(startDate, endDate, today)
  const overlapsBooking = rangeOverlapsBooked(startDate, endDate, booked.ranges)
  const datesInvalid = hasDateErrors(dateErrors) || overlapsBooking
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
      <div>
        <span className={labelClass}>Dates</span>
        <AvailabilityCalendar
          compact={compact}
          label="Campaign dates"
          today={today}
          value={{ startDate, endDate }}
          onChange={(next) => {
            setStartDate(next.startDate)
            setEndDate(next.endDate)
          }}
          bookedRanges={booked.ranges}
          bookedLegend={
            draftBillboards.length > 1 ? 'Booked (any in cart)' : 'Booked'
          }
          notice={
            booked.isLoading ? (
              <span className="text-ink/50 dark:text-paper/50">
                Loading availability…
              </span>
            ) : booked.isError ? (
              <span className="text-ink/60 dark:text-paper/60">
                Availability couldn't be loaded for every billboard — dates are
                checked when the campaign is created.
              </span>
            ) : null
          }
        />
      </div>
      {(dateErrors.start || dateErrors.end || overlapsBooking) && (
        <div role="alert" className="space-y-1 text-xs text-brand-error">
          {dateErrors.start && <p>{dateErrors.start}</p>}
          {dateErrors.end && <p>{dateErrors.end}</p>}
          {overlapsBooking && <p>{OVERLAP_MESSAGE}</p>}
        </div>
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
      {createCampaign.isError && !overlapsBooking && (
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
