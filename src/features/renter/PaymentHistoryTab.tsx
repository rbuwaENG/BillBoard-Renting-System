import { Badge, Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { useMyPayments } from './useMyPayments'

const STATUS_CLASSES: Record<string, string> = {
  succeeded: 'border-brand-success/40 text-brand-success',
  pending: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
  failed: 'border-brand-error/40 text-brand-error',
  refunded: 'border-accent/40 text-accent',
}

export function PaymentHistoryTab() {
  const formatPrice = useFormatPrice()
  const { data } = useMyPayments()
  const payments = data ?? []

  const totalPaid = payments
    .filter((p) => p.status === 'succeeded')
    .reduce((sum, p) => sum + p.amount, 0)

  return (
    <div className="space-y-4">
      <Card className="p-3">
        <span className="font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50">
          Total paid
        </span>
        <p className="mt-1 font-display text-xl font-semibold text-accent">
          {formatPrice(totalPaid)}
        </p>
      </Card>

      {payments.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink/40 dark:text-paper/40">
          No payments yet — they'll show up here once a booking is confirmed.
        </p>
      ) : (
        <div className="space-y-2">
          {payments.map((p) => (
            <div
              key={p.id}
              className="border border-ink/10 p-3 dark:border-paper/15"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-sm font-semibold tracking-tight">
                    {p.billboardTitle}
                  </p>
                  <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                    {new Date(p.confirmedAt ?? p.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
                <Badge className={STATUS_CLASSES[p.status]}>{p.status}</Badge>
              </div>
              <div className="mt-2 flex items-center justify-between gap-2">
                <span className="font-mono text-sm font-semibold text-accent">
                  {formatPrice(p.amount)}
                </span>
                {p.reference && (
                  <span className="truncate text-xs text-ink/40 dark:text-paper/40">
                    {p.reference}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
