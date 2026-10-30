import { Check, Plus } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BillboardMark } from '@/components'
import { loginPath } from '@/features/auth/redirect'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { getDisplayPrice } from './pricing'
import { RatingSummary } from './RatingSummary'
import { TRAFFIC_LABELS } from './trafficLevel'
import type { BillboardWithDetails } from './useBillboards'

// Add/remove-from-cart toggle. Rendered as a sibling of the card's main
// button (absolutely positioned over the photo), never inside it, so there
// are no nested interactive elements. Renters and logged-out visitors only.
function CartToggle({
  billboardId,
  title,
}: {
  billboardId: string
  title: string
}) {
  const { user, role } = useAuth()
  const navigate = useNavigate()
  const inDraft = useCampaignStore((s) => s.draftIds.includes(billboardId))
  const toggleDraft = useCampaignStore((s) => s.toggleDraft)

  if (user && role !== 'renter') return null

  const label = inDraft
    ? `Remove ${title} from campaign`
    : `Add ${title} to campaign`
  return (
    <button
      type="button"
      title={inDraft ? 'Remove from campaign' : 'Add to campaign'}
      aria-label={label}
      aria-pressed={inDraft}
      onClick={() => {
        if (!user) {
          navigate(loginPath(`/?billboard=${billboardId}`))
          return
        }
        toggleDraft(billboardId)
      }}
      className={cn(
        'absolute top-2 right-2 flex size-6 items-center justify-center border transition-colors',
        inDraft
          ? 'border-accent bg-accent text-paper'
          : 'border-paper/50 bg-ink/70 text-paper hover:bg-ink',
      )}
    >
      {inDraft ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}
    </button>
  )
}

interface BillboardCardProps {
  billboard: BillboardWithDetails
  selected?: boolean
  onClick?: () => void
  distanceKm?: number
}

export function BillboardCard({
  billboard,
  selected,
  onClick,
  distanceKm,
}: BillboardCardProps) {
  const formatPrice = useFormatPrice()
  const { price, strikethroughFrom } = getDisplayPrice(billboard)
  return (
    <div
      className={cn(
        'relative w-full border bg-paper transition-colors dark:bg-ink-soft',
        selected
          ? 'border-accent'
          : 'border-ink/12 hover:border-ink/30 dark:border-paper/15 dark:hover:border-paper/30',
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={selected ? 'true' : undefined}
        className="block w-full cursor-pointer text-left focus-visible:ring-2 focus-visible:ring-accent/60 focus-visible:outline-none"
      >
        {/* Deterministic placeholder "photo" panel — no stock images, so
            nothing depends on an external host. */}
        <div className="relative flex h-24 items-center justify-center overflow-hidden bg-paper-dim dark:bg-ink">
          <BillboardMark className="size-10 text-ink/10 dark:text-paper/10" />
          <span className="absolute top-2 left-2 bg-ink px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-paper uppercase dark:bg-paper dark:text-ink">
            {billboard.category}
          </span>
        </div>
        <div className="p-3">
          <h3 className="truncate font-display text-sm font-semibold tracking-tight">
            {billboard.title}
          </h3>
          <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
            {billboard.location.city} · {billboard.size}
            {distanceKm !== undefined && (
              <> · {Math.round(distanceKm)} km away</>
            )}
            {billboard.trafficLevel && (
              <> · {TRAFFIC_LABELS[billboard.trafficLevel]}</>
            )}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <span className="flex items-baseline gap-1.5 font-mono text-sm font-semibold text-accent">
              {strikethroughFrom !== null && (
                <span className="text-xs font-normal text-ink/40 line-through dark:text-paper/40">
                  <span className="sr-only">was </span>
                  {formatPrice(strikethroughFrom)}
                </span>
              )}
              {formatPrice(price)}
              <span className="text-ink/40 dark:text-paper/40">/day</span>
            </span>
            <RatingSummary rating={billboard.rating} showCount={false} />
          </div>
        </div>
      </button>
      <CartToggle billboardId={billboard.id} title={billboard.title} />
    </div>
  )
}
