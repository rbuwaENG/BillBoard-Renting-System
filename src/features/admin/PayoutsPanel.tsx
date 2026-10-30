import { useId, useMemo, useState } from 'react'
import { Badge, Button, Card } from '@/components'
import {
  ConfirmDialog,
  CsvExportButton,
  EmptyState,
  ErrorText,
  FieldLabel,
  QueryState,
  SearchBox,
} from './AdminUi'
import {
  ADMIN_INPUT_CLASSES,
  matchesSearch,
  plural,
  todayIsoDate,
} from './adminUtils'
import { toCsv } from './csv'
import { useCurrencySetting, useFormatPrice } from './useCurrencySetting'
import {
  useAdminPayouts,
  useCancelPayout,
  useCreatePayout,
  usePayableBookings,
  useReleasePayout,
  type AdminPayout,
  type PayableOwnerGroup,
} from './useAdminPayouts'

const STATUS_BADGE_CLASSES: Record<string, string> = {
  approved: 'border-accent/40 text-accent',
  paid: 'border-brand-success/40 text-brand-success',
  cancelled: 'border-brand-error/40 text-brand-error',
}

function CreatePayoutCard({ group }: { group: PayableOwnerGroup }) {
  const formatPrice = useFormatPrice()
  const { data: settings } = useCurrencySetting()
  const feePercent = settings?.platformFeePercent ?? 0
  const createPayout = useCreatePayout()
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(
    new Set(group.bookings.map((b) => b.id)),
  )
  const today = todayIsoDate()
  const [releaseDate, setReleaseDate] = useState(today)
  const dateId = useId()

  const selectedGross = group.bookings
    .filter((b) => selected.has(b.id))
    .reduce((sum, b) => sum + b.priceQuoted, 0)
  const selectedFee = Math.round(selectedGross * feePercent) / 100
  const selectedTotal = selectedGross - selectedFee
  // ISO dates compare correctly as strings.
  const dateInPast = releaseDate !== '' && releaseDate < today
  const canSubmit =
    selected.size > 0 &&
    releaseDate !== '' &&
    !dateInPast &&
    !createPayout.isPending

  function toggle(id: string) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function submit() {
    if (!canSubmit) return
    try {
      await createPayout.mutateAsync({
        ownerId: group.ownerId,
        bookingIds: Array.from(selected),
        scheduledReleaseDate: releaseDate,
      })
      setOpen(false)
    } catch {
      // surfaced below via createPayout.error
    }
  }

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display text-sm font-semibold tracking-tight">
            {group.ownerName}
          </p>
          <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
            {plural(group.bookings.length, 'payable booking')}
          </p>
        </div>
        <span className="font-mono text-sm font-semibold text-accent">
          {formatPrice(group.total)}
        </span>
      </div>

      {open ? (
        <div className="mt-3 space-y-2 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15">
          <fieldset>
            <legend className="sr-only">Bookings to include</legend>
            <ul className="space-y-1">
              {group.bookings.map((b) => (
                <li key={b.id}>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={selected.has(b.id)}
                      onChange={() => toggle(b.id)}
                    />
                    <span className="flex-1 truncate">{b.billboardTitle}</span>
                    <span className="font-mono text-xs text-ink/50 dark:text-paper/50">
                      {formatPrice(b.priceQuoted)}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </fieldset>
          {feePercent > 0 && (
            <p className="text-xs text-ink/50 dark:text-paper/50">
              {formatPrice(selectedGross)} gross − {formatPrice(selectedFee)}{' '}
              fee ({feePercent}%) = {formatPrice(selectedTotal)} net
            </p>
          )}
          <div className="flex flex-wrap items-end gap-2 pt-1">
            <label htmlFor={dateId} className="block">
              <FieldLabel>Release date</FieldLabel>
              <input
                id={dateId}
                type="date"
                min={today}
                value={releaseDate}
                onChange={(e) => setReleaseDate(e.target.value)}
                className={ADMIN_INPUT_CLASSES}
              />
            </label>
            <span className="font-mono text-xs text-accent">
              {formatPrice(selectedTotal)}
            </span>
            <Button size="sm" onClick={submit} disabled={!canSubmit}>
              {createPayout.isPending ? 'Scheduling…' : 'Approve + schedule'}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
          </div>
          {dateInPast && (
            <p role="alert" className="text-xs text-brand-error">
              The release date can't be in the past.
            </p>
          )}
          <ErrorText error={createPayout.error} />
        </div>
      ) : (
        <Button size="sm" className="mt-3" onClick={() => setOpen(true)}>
          Create payout
        </Button>
      )}
    </Card>
  )
}

type PayoutAction = { kind: 'release' | 'cancel'; payout: AdminPayout }

function buildPayoutsCsv(rows: AdminPayout[]) {
  return toCsv(rows, [
    { header: 'Payout ID', value: (p) => p.id },
    { header: 'Owner', value: (p) => p.ownerName },
    { header: 'Gross', value: (p) => p.grossAmount },
    { header: 'Fee', value: (p) => p.feeAmount },
    { header: 'Net', value: (p) => p.amount },
    { header: 'Currency', value: (p) => p.currency },
    { header: 'Status', value: (p) => p.status },
    { header: 'Scheduled release', value: (p) => p.scheduledReleaseDate },
    { header: 'Released at', value: (p) => p.releasedAt },
    { header: 'Created at', value: (p) => p.createdAt },
  ])
}

export function PayoutsPanel() {
  const formatPrice = useFormatPrice()
  const payableQuery = usePayableBookings()
  const payable = payableQuery.data ?? []
  const payoutsQuery = useAdminPayouts()
  const releasePayout = useReleasePayout()
  const cancelPayout = useCancelPayout()
  const [action, setAction] = useState<PayoutAction | null>(null)
  const [search, setSearch] = useState('')

  const payouts = useMemo(
    () =>
      (payoutsQuery.data ?? []).filter((p) =>
        matchesSearch(search, p.ownerName, p.status, p.scheduledReleaseDate),
      ),
    [payoutsQuery.data, search],
  )

  return (
    <div className="space-y-8">
      <section aria-label="Payable balances">
        <h3 className="font-display text-lg font-semibold tracking-tight">
          Payable balances
        </h3>
        <p className="mt-1 text-xs text-ink/50 dark:text-paper/50">
          Only bookings with an admin-confirmed payment are payable.
        </p>
        <QueryState
          isLoading={payableQuery.isLoading}
          error={payableQuery.error}
          onRetry={() => payableQuery.refetch()}
          label="Loading payable bookings…"
        />
        {!payableQuery.isLoading &&
          !payableQuery.error &&
          (payable.length === 0 ? (
            <EmptyState>No payable bookings right now.</EmptyState>
          ) : (
            <div className="mt-3 space-y-3">
              {payable.map((group) => (
                <CreatePayoutCard key={group.ownerId} group={group} />
              ))}
            </div>
          ))}
      </section>

      <section aria-label="Payout history">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-lg font-semibold tracking-tight">
            Payout history
          </h3>
          <div className="flex flex-wrap items-center gap-2">
            <SearchBox
              value={search}
              onChange={setSearch}
              label="Search payouts"
              placeholder="Search owner or status…"
            />
            <CsvExportButton
              name="payouts"
              disabled={payouts.length === 0}
              build={() => buildPayoutsCsv(payouts)}
            />
          </div>
        </div>
        <QueryState
          isLoading={payoutsQuery.isLoading}
          error={payoutsQuery.error}
          onRetry={() => payoutsQuery.refetch()}
          label="Loading payouts…"
        />
        {!payoutsQuery.isLoading &&
          !payoutsQuery.error &&
          (payouts.length === 0 ? (
            <EmptyState>
              {search.trim()
                ? 'No payouts match your search.'
                : 'No payouts yet.'}
            </EmptyState>
          ) : (
            <div className="mt-3 space-y-2">
              {payouts.map((p) => (
                <Card
                  key={p.id}
                  className="flex flex-wrap items-center justify-between gap-3 p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">
                      {p.ownerName}
                    </p>
                    <p className="font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                      Release {p.scheduledReleaseDate}
                    </p>
                    {p.feeAmount > 0 && (
                      <p className="mt-0.5 text-xs text-ink/40 dark:text-paper/40">
                        {formatPrice(p.grossAmount)} gross −{' '}
                        {formatPrice(p.feeAmount)} fee
                      </p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <span className="font-mono text-sm font-semibold text-accent">
                      {formatPrice(p.amount)}
                    </span>
                    <Badge className={STATUS_BADGE_CLASSES[p.status]}>
                      {p.status}
                    </Badge>
                    {p.status === 'approved' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() =>
                            setAction({ kind: 'release', payout: p })
                          }
                        >
                          Release now
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() =>
                            setAction({ kind: 'cancel', payout: p })
                          }
                        >
                          Cancel payout
                        </Button>
                      </>
                    )}
                  </div>
                </Card>
              ))}
            </div>
          ))}
      </section>

      <ConfirmDialog
        open={action !== null}
        onOpenChange={(open) => !open && setAction(null)}
        title={
          action?.kind === 'cancel' ? 'Cancel payout' : 'Release payout now'
        }
        description={
          action
            ? action.kind === 'cancel'
              ? `Cancel the ${formatPrice(action.payout.amount)} payout to ${action.payout.ownerName}? Its bookings become payable again.`
              : `Mark the ${formatPrice(action.payout.amount)} payout to ${action.payout.ownerName} as paid now instead of on ${action.payout.scheduledReleaseDate}? Make sure the money has been sent — this can't be undone.`
            : undefined
        }
        confirmLabel={
          action?.kind === 'cancel' ? 'Cancel payout' : 'Release now'
        }
        cancelLabel={action?.kind === 'cancel' ? 'Keep payout' : 'Cancel'}
        variant={action?.kind === 'cancel' ? 'danger' : 'primary'}
        onConfirm={() => {
          if (!action) return
          return action.kind === 'cancel'
            ? cancelPayout.mutateAsync(action.payout.id)
            : releasePayout.mutateAsync(action.payout.id)
        }}
      />
    </div>
  )
}
