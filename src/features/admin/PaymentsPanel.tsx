import { AlertTriangle } from 'lucide-react'
import { useId, useMemo, useState } from 'react'
import { Badge, Button, Card } from '@/components'
import { cn } from '@/lib/utils'
import {
  ConfirmDialog,
  CsvExportButton,
  EmptyState,
  ErrorText,
  FieldLabel,
  LoadMore,
  QueryState,
  SearchBox,
} from './AdminUi'
import { ADMIN_INPUT_CLASSES, formatAge, matchesSearch } from './adminUtils'
import { toCsv } from './csv'
import {
  useAdminPaymentHistory,
  useAwaitingPaymentBookings,
  useConfirmPayment,
  usePendingSubmissions,
  useRejectPayment,
  type AdminPayment,
  type AwaitingPaymentBooking,
} from './useAdminPayments'
import { useFormatPrice } from './useCurrencySetting'

const PAYMENT_STATUS_CLASSES: Record<string, string> = {
  pending: 'border-accent/40 text-accent',
  succeeded: 'border-brand-success/40 text-brand-success',
  failed: 'border-brand-error/40 text-brand-error',
  refunded: 'border-ink/20 text-ink/60 dark:border-paper/20 dark:text-paper/60',
}

function SectionHeading({ title, count }: { title: string; count?: number }) {
  return (
    <h3 className="font-display text-lg font-semibold tracking-tight">
      {title}
      {count !== undefined && (
        <span className="ml-2 font-mono text-xs text-ink/40 dark:text-paper/40">
          {count}
        </span>
      )}
    </h3>
  )
}

function BookingMeta({
  renterName,
  startDate,
  endDate,
  ageLabel,
}: {
  renterName: string
  startDate: string
  endDate: string
  ageLabel: string
}) {
  return (
    <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
      {renterName} · {startDate} → {endDate} · {ageLabel}
    </p>
  )
}

// Confirm form: amount prefilled with the quote (the server rejects any
// other amount with 'Amount does not match quoted price'), reference required.
function ConfirmPaymentForm({
  bookingId,
  priceQuoted,
  startDate,
  endDate,
  ageLabel,
  defaultReference,
  onDone,
}: {
  bookingId: string
  priceQuoted: number
  startDate: string
  endDate: string
  ageLabel: string
  defaultReference?: string
  onDone: () => void
}) {
  const formatPrice = useFormatPrice()
  const confirmPayment = useConfirmPayment()
  const [amount, setAmount] = useState(String(priceQuoted))
  const [reference, setReference] = useState(defaultReference ?? '')
  const amountId = useId()
  const referenceId = useId()

  const amountNumber = Number(amount)
  const amountValid =
    amount.trim() !== '' && Number.isFinite(amountNumber) && amountNumber > 0
  const differs = amountValid && Math.abs(amountNumber - priceQuoted) > 0.000001
  const canSubmit =
    amountValid && reference.trim() !== '' && !confirmPayment.isPending

  async function submit() {
    if (!canSubmit) return
    try {
      await confirmPayment.mutateAsync({
        bookingId,
        amount: amountNumber,
        reference: reference.trim(),
      })
      onDone()
    } catch {
      // surfaced below via confirmPayment.error
    }
  }

  return (
    <form
      className="mt-3 space-y-2 border-t border-dashed border-ink/15 pt-3 dark:border-paper/15"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      <p className="text-xs text-ink/60 dark:text-paper/60">
        Booking {startDate} → {endDate} · quoted {formatPrice(priceQuoted)} ·{' '}
        {ageLabel}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <label htmlFor={amountId} className="block w-32">
          <FieldLabel>Amount received</FieldLabel>
          <input
            id={amountId}
            type="number"
            min="0"
            step="0.01"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={ADMIN_INPUT_CLASSES}
          />
        </label>
        <label htmlFor={referenceId} className="block w-56">
          <FieldLabel>Payment reference *</FieldLabel>
          <input
            id={referenceId}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            required
            placeholder="Bank / transfer reference"
            className={ADMIN_INPUT_CLASSES}
          />
        </label>
        <Button type="submit" size="sm" disabled={!canSubmit}>
          {confirmPayment.isPending ? 'Confirming…' : 'Confirm received'}
        </Button>
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </div>
      {differs && (
        <p
          role="alert"
          className="flex items-center gap-1.5 text-xs text-brand-error"
        >
          <AlertTriangle aria-hidden="true" className="size-3.5" />
          Amount differs from the quoted price ({formatPrice(priceQuoted)}) —
          the server will reject a mismatched amount.
        </p>
      )}
      <ErrorText error={confirmPayment.error} />
    </form>
  )
}

function PendingSubmissionCard({
  payment,
  onReject,
}: {
  payment: AdminPayment
  onReject: (payment: AdminPayment) => void
}) {
  const formatPrice = useFormatPrice()
  const [confirming, setConfirming] = useState(false)
  const ageLabel = `submitted ${formatAge(payment.createdAt)}`

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-tight">
            {payment.billboardTitle}
          </p>
          <BookingMeta
            renterName={payment.renterName}
            startDate={payment.startDate}
            endDate={payment.endDate}
            ageLabel={ageLabel}
          />
          {payment.reference && (
            <p className="mt-0.5 text-xs text-ink/60 dark:text-paper/60">
              Renter reference:{' '}
              <span className="font-mono">{payment.reference}</span>
            </p>
          )}
        </div>
        <span className="font-mono text-sm font-semibold text-accent">
          {formatPrice(payment.priceQuoted)}
        </span>
      </div>

      {confirming ? (
        <ConfirmPaymentForm
          bookingId={payment.bookingId}
          priceQuoted={payment.priceQuoted}
          startDate={payment.startDate}
          endDate={payment.endDate}
          ageLabel={ageLabel}
          defaultReference={payment.reference}
          onDone={() => setConfirming(false)}
        />
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setConfirming(true)}>
            Confirm payment received
          </Button>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => onReject(payment)}
          >
            Reject
          </Button>
        </div>
      )}
    </Card>
  )
}

function RejectPaymentDialog({
  payment,
  onClose,
}: {
  payment: AdminPayment | null
  onClose: () => void
}) {
  const rejectPayment = useRejectPayment()
  const [reason, setReason] = useState('')
  const reasonId = useId()

  return (
    <ConfirmDialog
      open={payment !== null}
      onOpenChange={(open) => {
        if (!open) {
          setReason('')
          onClose()
        }
      }}
      title="Reject payment submission"
      description={
        payment
          ? `${payment.renterName}'s submission for ${payment.billboardTitle} is marked failed and the renter is notified with your reason. The booking stays awaiting payment.`
          : undefined
      }
      confirmLabel="Reject payment"
      variant="danger"
      confirmDisabled={!reason.trim()}
      onConfirm={async () => {
        if (!payment) return
        await rejectPayment.mutateAsync({ paymentId: payment.id, reason })
        setReason('')
      }}
    >
      <label htmlFor={reasonId} className="block">
        <FieldLabel>Reason (sent to the renter) *</FieldLabel>
        <textarea
          id={reasonId}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          required
          placeholder="e.g. No transfer with this reference was received"
          className="w-full resize-none border border-ink/15 bg-transparent px-2 py-1.5 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/15 dark:placeholder:text-paper/30"
        />
      </label>
    </ConfirmDialog>
  )
}

function AwaitingBookingCard({ booking }: { booking: AwaitingPaymentBooking }) {
  const formatPrice = useFormatPrice()
  const [confirming, setConfirming] = useState(false)
  const ageLabel = `approved ${formatAge(booking.approvedAt)}`

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-semibold tracking-tight">
            {booking.billboardTitle}
          </p>
          <BookingMeta
            renterName={booking.renterName}
            startDate={booking.startDate}
            endDate={booking.endDate}
            ageLabel={ageLabel}
          />
        </div>
        <span className="font-mono text-sm font-semibold text-accent">
          {formatPrice(booking.priceQuoted)}
        </span>
      </div>
      {confirming ? (
        <ConfirmPaymentForm
          bookingId={booking.id}
          priceQuoted={booking.priceQuoted}
          startDate={booking.startDate}
          endDate={booking.endDate}
          ageLabel={ageLabel}
          onDone={() => setConfirming(false)}
        />
      ) : (
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={() => setConfirming(true)}
        >
          Record offline payment
        </Button>
      )}
    </Card>
  )
}

function buildPaymentsCsv(rows: AdminPayment[]) {
  return toCsv(rows, [
    { header: 'Payment ID', value: (p) => p.id },
    { header: 'Booking ID', value: (p) => p.bookingId },
    { header: 'Billboard', value: (p) => p.billboardTitle },
    { header: 'Renter', value: (p) => p.renterName },
    { header: 'Start date', value: (p) => p.startDate },
    { header: 'End date', value: (p) => p.endDate },
    { header: 'Quoted', value: (p) => p.priceQuoted },
    { header: 'Amount', value: (p) => p.amount },
    { header: 'Currency', value: (p) => p.currency },
    { header: 'Status', value: (p) => p.status },
    { header: 'Reference', value: (p) => p.reference },
    { header: 'Submitted at', value: (p) => p.createdAt },
    { header: 'Confirmed at', value: (p) => p.confirmedAt },
  ])
}

function PaymentHistory() {
  const formatPrice = useFormatPrice()
  const history = useAdminPaymentHistory()
  const [search, setSearch] = useState('')
  const rows = useMemo(
    () =>
      history.items.filter((p) =>
        matchesSearch(
          search,
          p.billboardTitle,
          p.renterName,
          p.reference,
          p.status,
          p.id,
        ),
      ),
    [history.items, search],
  )

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SectionHeading title="Payment history" />
        <div className="flex flex-wrap items-center gap-2">
          <SearchBox
            value={search}
            onChange={setSearch}
            label="Search loaded payments"
            placeholder="Search renter, billboard, reference…"
          />
          <CsvExportButton
            name="payments"
            disabled={rows.length === 0}
            build={() => buildPaymentsCsv(rows)}
          />
        </div>
      </div>
      <QueryState
        isLoading={history.isLoading}
        error={history.error}
        onRetry={() => history.refetch()}
        label="Loading payments…"
      />
      {!history.isLoading && !history.error && (
        <>
          {rows.length === 0 ? (
            <EmptyState>
              {search.trim()
                ? 'No loaded payments match your search.'
                : 'No payments yet.'}
            </EmptyState>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[640px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink/10 font-mono text-[11px] tracking-widest text-ink/50 uppercase dark:border-paper/15 dark:text-paper/50">
                    <th className="py-2 pr-4 font-medium">Billboard</th>
                    <th className="py-2 pr-4 font-medium">Renter</th>
                    <th className="py-2 pr-4 font-medium">Dates</th>
                    <th className="py-2 pr-4 font-medium">Amount</th>
                    <th className="py-2 pr-4 font-medium">Reference</th>
                    <th className="py-2 pr-0 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => (
                    <tr
                      key={p.id}
                      className="border-b border-ink/5 last:border-0 dark:border-paper/10"
                    >
                      <td className="py-2 pr-4 font-medium">
                        {p.billboardTitle}
                      </td>
                      <td className="py-2 pr-4">{p.renterName}</td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {p.startDate} → {p.endDate}
                      </td>
                      <td className="py-2 pr-4 font-mono">
                        {formatPrice(p.amount)}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs">
                        {p.reference ?? '—'}
                      </td>
                      <td className="py-2 pr-0">
                        <Badge className={cn(PAYMENT_STATUS_CLASSES[p.status])}>
                          {p.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <LoadMore
            hasNextPage={history.hasNextPage}
            isFetchingNextPage={history.isFetchingNextPage}
            onLoadMore={() => history.fetchNextPage()}
            loadedCount={history.items.length}
          />
        </>
      )}
    </div>
  )
}

export function PaymentsPanel() {
  const submissions = usePendingSubmissions()
  const awaiting = useAwaitingPaymentBookings()
  const [search, setSearch] = useState('')
  const [rejecting, setRejecting] = useState<AdminPayment | null>(null)

  const pending = submissions.items.filter((p) =>
    matchesSearch(search, p.billboardTitle, p.renterName, p.reference),
  )
  const awaitingRows = awaiting.items.filter((b) =>
    matchesSearch(search, b.billboardTitle, b.renterName),
  )

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <SearchBox
          value={search}
          onChange={setSearch}
          label="Search pending payments"
          placeholder="Search renter or billboard…"
        />
      </div>

      <section className="space-y-3" aria-label="Payment submissions">
        <SectionHeading
          title="Submitted — awaiting confirmation"
          count={pending.length}
        />
        <QueryState
          isLoading={submissions.isLoading}
          error={submissions.error}
          onRetry={() => submissions.refetch()}
          label="Loading submissions…"
        />
        {!submissions.isLoading && !submissions.error && (
          <>
            {pending.length === 0 && (
              <EmptyState>
                No renter payment submissions awaiting confirmation.
              </EmptyState>
            )}
            {pending.map((p) => (
              <PendingSubmissionCard
                key={p.id}
                payment={p}
                onReject={setRejecting}
              />
            ))}
            {submissions.hasNextPage && (
              <LoadMore
                hasNextPage={submissions.hasNextPage}
                isFetchingNextPage={submissions.isFetchingNextPage}
                onLoadMore={() => submissions.fetchNextPage()}
                loadedCount={submissions.items.length}
              />
            )}
          </>
        )}
      </section>

      <section className="space-y-3" aria-label="Awaiting payment">
        <SectionHeading
          title="Approved — no payment submitted"
          count={awaitingRows.length}
        />
        <QueryState
          isLoading={awaiting.isLoading}
          error={awaiting.error}
          onRetry={() => awaiting.refetch()}
          label="Loading bookings…"
        />
        {!awaiting.isLoading && !awaiting.error && (
          <>
            {awaitingRows.length === 0 && (
              <EmptyState>
                No approved bookings waiting on a payment.
              </EmptyState>
            )}
            {awaitingRows.map((b) => (
              <AwaitingBookingCard key={b.id} booking={b} />
            ))}
            {awaiting.hasNextPage && (
              <LoadMore
                hasNextPage={awaiting.hasNextPage}
                isFetchingNextPage={awaiting.isFetchingNextPage}
                onLoadMore={() => awaiting.fetchNextPage()}
                loadedCount={awaiting.items.length}
              />
            )}
          </>
        )}
      </section>

      <PaymentHistory />

      <RejectPaymentDialog
        payment={rejecting}
        onClose={() => setRejecting(null)}
      />
    </div>
  )
}
