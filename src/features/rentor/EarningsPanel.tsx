import { useMemo } from 'react'
import { Badge, Card } from '@/components'
import { useFormatPrice } from '@/features/admin/useCurrencySetting'
import { PanelError, PanelLoading } from './PanelState'
import type { LedgerPaymentStatus, LedgerRow } from './earningsLedger'
import { useOwnerEarningsLedger } from './useMyPayouts'

const STATUS_BADGE_CLASSES: Record<string, string> = {
  approved: 'border-accent/40 text-accent',
  paid: 'border-brand-success/40 text-brand-success',
  cancelled: 'border-brand-error/40 text-brand-error',
}

const PAYMENT_LABEL: Record<LedgerPaymentStatus, string> = {
  none: 'Not paid',
  pending: 'Awaiting confirmation',
  succeeded: 'Paid',
  failed: 'Failed',
  refunded: 'Refunded',
}

const PAYMENT_CLASSES: Record<LedgerPaymentStatus, string> = {
  none: 'border-ink/15 text-ink/40 dark:border-paper/15 dark:text-paper/40',
  pending: 'border-accent/40 text-accent',
  succeeded: 'border-brand-success/40 text-brand-success',
  failed: 'border-brand-error/40 text-brand-error',
  refunded: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function payoutLabel(row: LedgerRow) {
  if (row.payout) {
    if (row.payout.status === 'paid') {
      return `Paid out ${row.payout.releasedAt?.slice(0, 10) ?? ''}`.trim()
    }
    if (row.payout.status === 'cancelled') return 'Payout cancelled'
    return `Scheduled ${row.payout.scheduledReleaseDate}`
  }
  if (row.earnedUnscheduled) return 'Earned, not yet scheduled'
  return '—'
}

const labelClass =
  'font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:text-paper/50'

export function EarningsPanel() {
  const formatPrice = useFormatPrice()
  const { data, isLoading, isError, error, refetch } = useOwnerEarningsLedger()
  const payouts = useMemo(() => data?.payouts ?? [], [data])
  const ledgerRows = useMemo(() => data?.rows ?? [], [data])
  const rowsById = useMemo(
    () => new Map(ledgerRows.map((r) => [r.bookingId, r])),
    [ledgerRows],
  )

  if (isLoading) return <PanelLoading label="Loading your earnings…" />
  if (isError) {
    return (
      <PanelError
        error={error}
        onRetry={() => refetch()}
        label="Couldn't load your earnings."
      />
    )
  }

  const totalPaid = payouts
    .filter((p) => p.status === 'paid')
    .reduce((sum, p) => sum + p.amount, 0)
  const totalPending = payouts
    .filter((p) => p.status === 'approved')
    .reduce((sum, p) => sum + p.amount, 0)
  const earnedUnscheduled = data?.earnedUnscheduledTotal ?? 0

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card className="p-4">
          <span className={labelClass}>Total paid out</span>
          <p className="mt-1 font-display text-2xl font-semibold text-accent">
            {formatPrice(totalPaid)}
          </p>
        </Card>
        <Card className="p-4">
          <span className={labelClass}>Scheduled payout</span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {formatPrice(totalPending)}
          </p>
        </Card>
        <Card className="p-4">
          <span
            className={labelClass}
            title="Paid, confirmed bookings an admin hasn't added to a payout yet (before platform fees)"
          >
            Earned, not yet scheduled
          </span>
          <p className="mt-1 font-display text-2xl font-semibold">
            {formatPrice(earnedUnscheduled)}
          </p>
        </Card>
        <Card className="p-4">
          <span className={labelClass}>Payouts</span>
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
            No payouts yet — an admin schedules a payout once your bookings are
            confirmed and paid.
          </p>
        ) : (
          <ul className="mt-4 space-y-3">
            {payouts.map((p) => (
              <li
                key={p.id}
                className="border-b border-ink/5 pb-3 text-sm last:border-0 dark:border-paper/10"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                      {p.status === 'paid'
                        ? `Released ${p.releasedAt?.slice(0, 10)}`
                        : p.status === 'cancelled'
                          ? 'Cancelled'
                          : `Scheduled for ${p.scheduledReleaseDate}`}
                    </p>
                    {p.feeAmount > 0 && (
                      <p className="mt-0.5 text-xs text-ink/40 dark:text-paper/40">
                        {formatPrice(p.grossAmount)} gross −{' '}
                        {formatPrice(p.feeAmount)} fee
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
                </div>
                {p.bookingIds.length > 0 && (
                  <ul
                    aria-label="Bookings in this payout"
                    className="mt-2 space-y-1 border-l border-dashed border-ink/15 pl-3 dark:border-paper/15"
                  >
                    {p.bookingIds.map((id) => {
                      const row = rowsById.get(id)
                      return (
                        <li
                          key={id}
                          className="flex items-center justify-between gap-3 text-xs text-ink/60 dark:text-paper/60"
                        >
                          <span className="min-w-0 truncate">
                            {row
                              ? `${row.billboardTitle} · ${formatDate(row.startDate)} – ${formatDate(row.endDate)}`
                              : `Booking ${id.slice(0, 8)}`}
                          </span>
                          {row && (
                            <span className="shrink-0 font-mono">
                              {formatPrice(row.amount)}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Booking ledger
        </h3>
        <p className="mt-1 text-xs text-ink/50 dark:text-paper/50">
          Amounts are the quoted booking price, before platform fees.
        </p>
        {ledgerRows.length === 0 ? (
          <p className="mt-4 text-sm text-ink/40 dark:text-paper/40">
            No paid or approved bookings yet.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[36rem] text-left text-sm">
              <thead>
                <tr className={labelClass}>
                  <th scope="col" className="pb-2 font-normal">
                    Booking
                  </th>
                  <th scope="col" className="pb-2 font-normal">
                    Dates
                  </th>
                  <th scope="col" className="pb-2 text-right font-normal">
                    Amount
                  </th>
                  <th scope="col" className="pb-2 pl-4 font-normal">
                    Payment
                  </th>
                  <th scope="col" className="pb-2 font-normal">
                    Payout
                  </th>
                </tr>
              </thead>
              <tbody>
                {ledgerRows.map((row) => (
                  <tr
                    key={row.bookingId}
                    className="border-t border-ink/5 dark:border-paper/10"
                  >
                    <td className="max-w-[12rem] truncate py-2 pr-3">
                      {row.billboardTitle}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap text-xs text-ink/60 dark:text-paper/60">
                      {formatDate(row.startDate)} – {formatDate(row.endDate)}
                    </td>
                    <td className="py-2 text-right font-mono whitespace-nowrap">
                      {formatPrice(row.amount)}
                    </td>
                    <td className="py-2 pl-4">
                      <Badge className={PAYMENT_CLASSES[row.paymentStatus]}>
                        {PAYMENT_LABEL[row.paymentStatus]}
                      </Badge>
                    </td>
                    <td
                      className={
                        row.earnedUnscheduled
                          ? 'py-2 text-xs text-accent'
                          : 'py-2 text-xs text-ink/60 dark:text-paper/60'
                      }
                    >
                      {payoutLabel(row)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  )
}
