import { Check, Plus, Star } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { BillboardMark } from '@/components'
import { useCampaignStore } from '@/features/campaigns/campaignStore'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { useAuth } from '@/hooks/useAuth'
import { cn } from '@/lib/utils'
import { getDisplayPrice } from './pricing'
import type { BillboardWithDetails } from './useBillboards'

// Deterministic placeholder "photo" panel — no stock images, so nothing
// depends on an external host. Category text plus a faded brand glyph reads
// as "no photo yet" rather than a broken image.
function PlaceholderPhoto({
  category,
  billboardId,
}: {
  category: string
  billboardId: string
}) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const inDraft = useCampaignStore((s) => s.draftIds.includes(billboardId))
  const toggleDraft = useCampaignStore((s) => s.toggleDraft)

  return (
    <div className="relative flex h-24 items-center justify-center overflow-hidden bg-paper-dim dark:bg-ink">
      <BillboardMark className="size-10 text-ink/10 dark:text-paper/10" />
      <span className="absolute top-2 left-2 bg-ink px-1.5 py-0.5 font-mono text-[10px] tracking-widest text-paper uppercase dark:bg-paper dark:text-ink">
        {category}
      </span>
      <button
        type="button"
        title={inDraft ? 'Remove from campaign' : 'Add to campaign'}
        onClick={(e) => {
          e.stopPropagation()
          if (!user) {
            navigate('/login')
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
        {inDraft ? (
          <Check className="size-3.5" />
        ) : (
          <Plus className="size-3.5" />
        )}
      </button>
    </div>
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
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
      className={cn(
        'w-full cursor-pointer border bg-paper text-left transition-colors dark:bg-ink-soft',
        selected
          ? 'border-accent'
          : 'border-ink/12 hover:border-ink/30 dark:border-paper/15 dark:hover:border-paper/30',
      )}
    >
      <PlaceholderPhoto category={billboard.category} billboardId={billboard.id} />
      <div className="p-3">
        <h3 className="truncate font-display text-sm font-semibold tracking-tight">
          {billboard.title}
        </h3>
        <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
          {billboard.location.city} · {billboard.size}
          {distanceKm !== undefined && <> · {Math.round(distanceKm)} km away</>}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <span className="flex items-baseline gap-1.5 font-mono text-sm font-semibold text-accent">
            {strikethroughFrom !== null && (
              <span className="text-xs font-normal text-ink/40 line-through dark:text-paper/40">
                {formatPrice(strikethroughFrom)}
              </span>
            )}
            {formatPrice(price)}
            <span className="text-ink/40 dark:text-paper/40">/day</span>
          </span>
          <span className="flex items-center gap-1 font-mono text-xs text-ink/60 dark:text-paper/60">
            <Star className="size-3 fill-accent text-accent" />
            {billboard.rating.avg.toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  )
}
