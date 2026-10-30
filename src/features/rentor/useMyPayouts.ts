import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import type { Payout } from '@/types'
import {
  buildEarningsLedger,
  type LedgerBookingInput,
  type LedgerPaymentInput,
} from './earningsLedger'

export interface OwnerPayout extends Payout {
  // Bookings bundled into this payout (payout_items).
  bookingIds: string[]
}

interface PayoutRow {
  id: string
  owner_id: string
  amount: number
  gross_amount: number
  fee_amount: number
  currency: string
  status: Payout['status']
  scheduled_release_date: string
  approved_by: string
  approved_at: string
  released_at: string | null
  created_at: string
  payout_items: { booking_id: string }[] | null
}

function toPayout(row: PayoutRow): OwnerPayout {
  return {
    id: row.id,
    ownerId: row.owner_id,
    amount: row.amount,
    grossAmount: row.gross_amount,
    feeAmount: row.fee_amount,
    currency: row.currency,
    status: row.status,
    scheduledReleaseDate: row.scheduled_release_date,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    releasedAt: row.released_at ?? undefined,
    createdAt: row.created_at,
    bookingIds: (row.payout_items ?? []).map((i) => i.booking_id),
  }
}

async function fetchMyPayouts(ownerId: string) {
  const { data, error } = await supabase
    .from('payouts')
    .select('*, payout_items(booking_id)')
    .eq('owner_id', ownerId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data as unknown as PayoutRow[]).map(toPayout)
}

export function useMyPayouts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.myPayouts.summary(user?.uid),
    queryFn: () => fetchMyPayouts(user!.uid),
    enabled: !!user,
  })
}

interface LedgerBookingRow {
  id: string
  start_date: string
  end_date: string
  price_quoted: number
  status: LedgerBookingInput['status']
  created_at: string
  billboards: { title: string } | null
}

interface LedgerPaymentRow {
  booking_id: string
  status: LedgerPaymentInput['status']
  confirmed_by: string | null
  created_at: string
}

// Booking statuses that carry money for the owner (or may soon).
const LEDGER_STATUSES = ['payment_pending', 'confirmed', 'active', 'completed']

// Per-booking earnings ledger: every money-relevant booking with its payment
// and payout state. RLS lets an owner read their own bookings, payments
// (owner_id), payouts and payout_items. Keyed under 'my-payouts' so payout
// invalidations from the admin side refresh it too.
export function useOwnerEarningsLedger() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.myPayouts.ledger(user?.uid),
    queryFn: async () => {
      const ownerId = user!.uid
      const [payouts, bookingsRes, paymentsRes] = await Promise.all([
        fetchMyPayouts(ownerId),
        supabase
          .from('bookings')
          .select(
            'id, start_date, end_date, price_quoted, status, created_at, billboards(title)',
          )
          .eq('owner_id', ownerId),
        supabase
          .from('payments')
          .select('booking_id, status, confirmed_by, created_at')
          .eq('owner_id', ownerId),
      ])
      if (bookingsRes.error) throw bookingsRes.error
      if (paymentsRes.error) throw paymentsRes.error

      const payments = ((paymentsRes.data ?? []) as LedgerPaymentRow[]).map(
        (p): LedgerPaymentInput => ({
          bookingId: p.booking_id,
          status: p.status,
          confirmed: !!p.confirmed_by,
          createdAt: p.created_at,
        }),
      )
      const paidBookingIds = new Set(payments.map((p) => p.bookingId))
      const payoutBookingIds = new Set(payouts.flatMap((p) => p.bookingIds))

      const bookings = (
        (bookingsRes.data ?? []) as unknown as LedgerBookingRow[]
      )
        .filter(
          (b) =>
            LEDGER_STATUSES.includes(b.status) ||
            paidBookingIds.has(b.id) ||
            payoutBookingIds.has(b.id),
        )
        .map((b): LedgerBookingInput => ({
          id: b.id,
          billboardTitle: b.billboards?.title ?? 'Billboard',
          startDate: b.start_date,
          endDate: b.end_date,
          priceQuoted: b.price_quoted,
          status: b.status,
          createdAt: b.created_at,
        }))

      return { payouts, ...buildEarningsLedger(bookings, payments, payouts) }
    },
    enabled: !!user,
  })
}
