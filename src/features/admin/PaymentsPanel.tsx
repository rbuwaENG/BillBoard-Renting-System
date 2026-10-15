import { useState } from 'react'
import { Button, Card } from '@/components'
import { useFormatPrice } from './useCurrencySetting'
import { useConfirmPayment, usePendingPayments } from './useAdminPayments'

export function PaymentsPanel() {
  const formatPrice = useFormatPrice()
  const { data } = usePendingPayments()
  const payments = data ?? []
  const confirmPayment = useConfirmPayment()
  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')

  function startConfirm(id: string, defaultAmount: number) {
    setConfirmingId(id)
    setAmount(String(defaultAmount))
    setReference('')
  }

  async function submitConfirm() {
    if (!confirmingId || !amount) return
    await confirmPayment.mutateAsync({
      bookingId: confirmingId,
      amount: Number(amount),
      reference: reference.trim() || undefined,
    })
    setConfirmingId(null)
  }

  return (
    <div className="space-y-3">
      {payments.length === 0 && (
        <p className="py-10 text-center text-sm text-ink/40 dark:text-paper/40">
          No payments awaiting confirmation.
        </p>
      )}

      {payments.map((p) => (
        <Card key={p.id} className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-display text-sm font-semibold tracking-tight">
                {p.billboardTitle}
              </p>
              <p className="mt-0.5 font-mono text-[11px] tracking-wide text-ink/50 uppercase dark:text-paper/50">
                {p.renterName}
              </p>
            </div>
            <span className="font-mono text-sm font-semibold text-accent">
              {formatPrice(p.priceQuoted)}
            </span>
          </div>

          <div className="mt-3">
            {confirmingId === p.id ? (
              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Amount"
                  className="w-28 border-b border-ink/20 bg-transparent py-1 text-sm focus:border-accent focus:outline-none dark:border-paper/20"
                />
                <input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Reference (optional)"
                  className="w-48 border-b border-ink/20 bg-transparent py-1 text-sm placeholder:text-ink/30 focus:border-accent focus:outline-none dark:border-paper/20 dark:placeholder:text-paper/30"
                />
                <Button
                  size="sm"
                  onClick={submitConfirm}
                  disabled={confirmPayment.isPending || !amount}
                >
                  Confirm received
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setConfirmingId(null)}
                >
                  Cancel
                </Button>
              </div>
            ) : (
              <Button size="sm" onClick={() => startConfirm(p.id, p.priceQuoted)}>
                Confirm payment received
              </Button>
            )}
          </div>
        </Card>
      ))}
    </div>
  )
}
