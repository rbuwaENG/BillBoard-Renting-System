import { Badge, Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { useMyPayouts } from './useMyPayouts'

const STATUS_BADGE_CLASSES: Record<string, string> = {
  approved: 'border-accent/40 text-accent',
  paid: 'border-brand-success/40 text-brand-success',
  cancelled: 'border-brand-error/40 text-brand-error',
}

export function EarningsPanel() {
  const formatPrice = useFormatPrice()
  const { data } = useMyPayouts()
  const payouts = data ?? []

  const totalPaid = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)
  const totalPending = payouts
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Total earned
          </span>
          <p className="mt-1 font-display text-2xl font-semibold text-accent">
            {formatPrice(totalPaid)}
          </p>
        </Card>
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Pending payout
          </span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {formatPrice(totalPending)}
          </p>
        </Card>
        <Card className="p-4">
          <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
            Payouts
          </span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {payouts.length}
          </p>
        </Card>
      </div>

      <Card ticks className="p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Payout history
        </h3>
        {payouts.length === 0 ? (
          <p className="mt-4 text-sm text-ink/40 dark:text-paper/40">
            No payouts yet — an admin schedules a payout once your bookings
            are confirmed and paid.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-3 border-b border-ink/5 pb-2 text-sm last:border-0 dark:border-paper/10"
              >
                <div className="min-w-0">
                  <p className="font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                    {p.status === 'paid'
                      ? `Released ${p.releasedAt?.slice(0, 10)}`
                      : `Scheduled for ${p.scheduledReleaseDate}`}
                  </p>
                  {p.feeAmount > 0 && (
                    <p className="mt-0.5 text-xs text-ink/40 dark:text-paper/40">
                      {formatPrice(p.grossAmount)} gross − {formatPrice(p.feeAmount)} fee
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <Badge className={STATUS_BADGE_CLASSES[p.status]}>
                    {p.status}
                  </Badge>
                  <span className="font-mono font-semibold text-accent">
                    {formatPrice(p.amount)}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}
