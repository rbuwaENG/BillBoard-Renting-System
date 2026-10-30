export type PaymentRowStatus = 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface BookingPaymentSummary {
  id: string
  status: PaymentRowStatus
  reference: string | null
  createdAt: string
}

// What the renter should see for a booking's payment, derived from the
// booking's payment rows (renter_submit_payment inserts 'pending', an admin
// promotes it to 'succeeded' or rejects it to 'failed').
//   none      — nothing submitted yet → offer "I've paid"
//   submitted — a pending submission is waiting on an admin
//   paid      — an admin confirmed a payment
//   rejected  — the latest submission was rejected → offer to resubmit
export type PaymentState = 'none' | 'submitted' | 'paid' | 'rejected'

export function getPaymentState(
  payments: BookingPaymentSummary[] | null | undefined,
): PaymentState {
  const list = payments ?? []
  if (list.some((p) => p.status === 'succeeded')) return 'paid'
  if (list.some((p) => p.status === 'pending')) return 'submitted'
  const latest = [...list].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  )[0]
  if (latest?.status === 'failed') return 'rejected'
  return 'none'
}

export const PAYMENT_STATE_MESSAGE: Record<
  Exclude<PaymentState, 'none'>,
  string
> = {
  submitted: 'Payment submitted — awaiting admin confirmation',
  paid: 'Payment confirmed',
  rejected: 'Payment rejected — please resubmit',
}
