import { Flag, Star, Tag } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Badge, BillboardMark, Button, Card } from '@/components'
import { useSetBillboardStatus } from '@/features/rentor/useRentorBillboards'
import { cn } from '@/lib/utils'
import { useAdminBillboards, useSetAdminPriceOverride } from './useAdminBillboards'
import { useFormatPrice } from './useCurrencySetting'

const STATUS_CLASSES: Record<string, string> = {
  active: 'border-brand-success/40 text-brand-success',
  inactive: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
  flagged: 'border-brand-error/40 text-brand-error',
}

const FILTERS = ['all', 'flagged', 'active', 'inactive'] as const
type Filter = (typeof FILTERS)[number]

export function ModerationPanel() {
  const formatPrice = useFormatPrice()
  const { data } = useAdminBillboards()
  const allBillboards = useMemo(() => data ?? [], [data])
  const setStatus = useSetBillboardStatus()
  const setPriceOverride = useSetAdminPriceOverride()
  const [filter, setFilter] = useState<Filter>('all')
  const [overridingId, setOverridingId] = useState<string | null>(null)
  const [overrideValue, setOverrideValue] = useState('')

  const flaggedCount = allBillboards.filter((b) => b.status === 'flagged').length

  const billboards = useMemo(() => {
    const filtered =
      filter === 'all'
        ? allBillboards
        : allBillboards.filter((b) => b.status === filter)
    return [...filtered].sort((a, b) =>
      a.status === b.status ? 0 : a.status === 'flagged' ? -1 : 1,
    )
  }, [allBillboards, filter])

  function startOverride(id: string, current: number | null) {
    setOverridingId(id)
    setOverrideValue(current !== null ? String(current) : '')
  }

  function submitOverride(id: string) {
    const price = overrideValue.trim() ? Number(overrideValue) : null
    setPriceOverride.mutate({ id, price })
    setOverridingId(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-1.5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={cn(
              'border px-2.5 py-1 font-mono text-[11px] tracking-widest uppercase transition-colors',
              filter === f
                ? 'border-accent bg-accent/10 text-accent'
                : 'border-ink/15 text-ink/60 hover:border-ink/30 dark:border-paper/15 dark:text-paper/60 dark:hover:border-paper/30',
            )}
          >
            {f === 'flagged' ? `Flagged (${flaggedCount})` : f}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {billboards.map((b) => (
          <Card key={b.id} className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex size-11 shrink-0 items-center justify-center bg-paper-dim dark:bg-ink">
                <BillboardMark className="size-4 text-ink/15 dark:text-paper/15" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <p className="truncate font-display text-sm font-semibold tracking-tight">
                    {b.title}
                  </p>
                  <Badge className={cn(STATUS_CLASSES[b.status])}>
                    {b.status}
                  </Badge>
                </div>
                <p className="mt-0.5 truncate font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                  {b.ownerName} · {b.location.city} · {formatPrice(b.pricePerDay)}/day
                  {b.adminPriceOverridePerDay !== null && (
                    <span className="text-accent">
                      {' '}
                      → {formatPrice(b.adminPriceOverridePerDay)}/day (admin)
                    </span>
                  )}
                </p>
                <p className="mt-0.5 flex items-center gap-1 font-mono text-[11px] text-ink/50 dark:text-paper/50">
                  <Star className="size-3 fill-current" />
                  {b.rating.count > 0
                    ? `${b.rating.avg.toFixed(1)} (${b.rating.count} review${b.rating.count !== 1 ? 's' : ''})`
                    : 'No reviews yet'}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => startOverride(b.id, b.adminPriceOverridePerDay)}
                >
                  <Tag className="size-3.5" />
                  Override price
                </Button>
                {b.status !== 'flagged' && (
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => setStatus.mutate({ id: b.id, status: 'flagged' })}
                  >
                    <Flag className="size-3.5" />
                    Flag
                  </Button>
                )}
                {b.status !== 'inactive' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setStatus.mutate({ id: b.id, status: 'inactive' })}
                  >
                    Unpublish
                  </Button>
                )}
                {b.status !== 'active' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => setStatus.mutate({ id: b.id, status: 'active' })}
                  >
                    Restore
                  </Button>
                )}
              </div>
            </div>

            {overridingId === b.id && (
              <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
                <input
                  type="number"
                  min="0"
                  value={overrideValue}
                  onChange={(e) => setOverrideValue(e.target.value)}
                  placeholder={`Override price (regular: ${b.pricePerDay})`}
                  className="w-56 border-b border-ink/20 bg-transparent py-1.5 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
                />
                <Button
                  size="sm"
                  disabled={setPriceOverride.isPending}
                  onClick={() => submitOverride(b.id)}
                >
                  Save
                </Button>
                {b.adminPriceOverridePerDay !== null && (
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={setPriceOverride.isPending}
                    onClick={() =>
                      setPriceOverride.mutate(
                        { id: b.id, price: null },
                        { onSuccess: () => setOverridingId(null) },
                      )
                    }
                  >
                    Clear override
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={() => setOverridingId(null)}>
                  Cancel
                </Button>
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  )
}
