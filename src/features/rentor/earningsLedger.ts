import type { Booking, PayoutStatus } from '@/types'

export type LedgerPaymentStatus =
  'none' | 'pending' | 'succeeded' | 'failed' | 'refunded'

export interface LedgerBookingInput {
  id: string
  billboardTitle: string
  startDate: string
  endDate: string
  priceQuoted: number
  status: Booking['status'] | 'expired'
  createdAt: string
}

export interface LedgerPaymentInput {
  bookingId: string
  status: Exclude<LedgerPaymentStatus, 'none'>
  confirmed: boolean
  createdAt: string
}

export interface LedgerPayoutInput {
  id: string
  status: PayoutStatus
  scheduledReleaseDate: string
  releasedAt?: string
  bookingIds: string[]
}

export interface LedgerRow {
  bookingId: string
  billboardTitle: string
  startDate: string
  endDate: string
  amount: number
  bookingStatus: LedgerBookingInput['status']
  paymentStatus: LedgerPaymentStatus
  payout: {
    id: string
    status: PayoutStatus
    scheduledReleaseDate: string
    releasedAt?: string
  } | null
  // Paid and confirmed, eligible for a payout, but not attached to one yet.
  earnedUnscheduled: boolean
}

// Statuses the admin can pay out (mirrors admin_create_payout).
const PAYABLE_STATUSES = new Set(['confirmed', 'active', 'completed'])

// The status that best describes a booking's money: a confirmed success wins,
// then the newest attempt.
function pickPayment(payments: LedgerPaymentInput[]) {
  const succeeded = payments.find(
    (p) => p.status === 'succeeded' && p.confirmed,
  )
  if (succeeded) return succeeded
  return [...payments].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
}

export function buildEarningsLedger(
  bookings: LedgerBookingInput[],
  payments: LedgerPaymentInput[],
  payouts: LedgerPayoutInput[],
): { rows: LedgerRow[]; earnedUnscheduledTotal: number } {
  const paymentsByBooking = new Map<string, LedgerPaymentInput[]>()
  for (const p of payments) {
    const list = paymentsByBooking.get(p.bookingId) ?? []
    list.push(p)
    paymentsByBooking.set(p.bookingId, list)
  }

  const payoutByBooking = new Map<string, LedgerPayoutInput>()
  for (const payout of payouts) {
    for (const bookingId of payout.bookingIds) {
      payoutByBooking.set(bookingId, payout)
    }
  }

  let earnedUnscheduledTotal = 0
  const rows = bookings
    .map((b): LedgerRow => {
      const payment = pickPayment(paymentsByBooking.get(b.id) ?? [])
      const payout = payoutByBooking.get(b.id) ?? null
      const earnedUnscheduled =
        PAYABLE_STATUSES.has(b.status) &&
        payment?.status === 'succeeded' &&
        payment.confirmed &&
        !payout
      if (earnedUnscheduled) earnedUnscheduledTotal += b.priceQuoted
      return {
        bookingId: b.id,
        billboardTitle: b.billboardTitle,
        startDate: b.startDate,
        endDate: b.endDate,
        amount: b.priceQuoted,
        bookingStatus: b.status,
        paymentStatus: payment?.status ?? 'none',
        payout: payout
          ? {
              id: payout.id,
              status: payout.status,
              scheduledReleaseDate: payout.scheduledReleaseDate,
              releasedAt: payout.releasedAt,
            }
          : null,
        earnedUnscheduled,
      }
    })
    .sort((a, b) => b.startDate.localeCompare(a.startDate))

  return { rows, earnedUnscheduledTotal }
}
