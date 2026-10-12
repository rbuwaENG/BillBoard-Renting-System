import { Flag } from 'lucide-react'
import { Badge, BillboardMark, Button, Card } from '@/components'
import { useSetBillboardStatus } from '@/features/rentor/useRentorBillboards'
import { cn } from '@/lib/utils'
import { useAdminBillboards } from './useAdminBillboards'
import { useFormatPrice } from './useCurrencySetting'

const STATUS_CLASSES: Record<string, string> = {
  active: 'border-brand-success/40 text-brand-success',
  inactive: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
  flagged: 'border-brand-error/40 text-brand-error',
}

export function ModerationPanel() {
  const formatPrice = useFormatPrice()
  const { data } = useAdminBillboards()
  const billboards = data ?? []
  const setStatus = useSetBillboardStatus()

  return (
    <div className="space-y-3">
      {billboards.map((b) => (
        <Card key={b.id} className="flex items-center gap-4 p-4">
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
            </p>
          </div>

          <div className="flex shrink-0 gap-2">
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
        </Card>
      ))}
    </div>
  )
}
