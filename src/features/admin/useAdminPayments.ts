import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Payment } from '@/types'
import { usePagedQuery } from './usePagedQuery'

// Payments contract: a renter submits "I've paid" (`renter_submit_payment`
// → payments row with status 'pending'); an admin then confirms it with
// `admin_confirm_payment` (amount must equal the quote) or rejects it with
// `admin_reject_payment`. Bookings approved but with no submission yet are
// listed separately — an admin can still confirm an offline payment there.

// payments → bookings is ambiguous for PostgREST (payments.booking_id and
// bookings.payment_id both link the tables), so embeds name the FK.
const PAYMENT_SELECT =
  'id, booking_id, amount, currency, status, reference, created_at, confirmed_at, ' +
  'bookings!payments_booking_id_fkey(id, start_date, end_date, price_quoted, status, billboards(title)), ' +
  'profiles!payments_renter_id_fkey(display_name)'

interface PaymentRow {
  id: string
  booking_id: string
  amount: number
  currency: string
  status: Payment['status']
  reference: string | null
  created_at: string
  confirmed_at: string | null
  bookings: {
    id: string
    start_date: string
    end_date: string
    price_quoted: number
    status: string
    billboards: { title: string } | null
  } | null
  profiles: { display_name: string } | null
}

export interface AdminPayment {
  id: string
  bookingId: string
  amount: number
  currency: string
  status: Payment['status']
  reference?: string
  createdAt: string
  confirmedAt?: string
  billboardTitle: string
  renterName: string
  priceQuoted: number
  startDate: string
  endDate: string
  bookingStatus: string
}

function toAdminPayment(row: PaymentRow): AdminPayment {
  return {
    id: row.id,
    bookingId: row.booking_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    reference: row.reference ?? undefined,
    createdAt: row.created_at,
    confirmedAt: row.confirmed_at ?? undefined,
    billboardTitle: row.bookings?.billboards?.title ?? 'Billboard',
    renterName: row.profiles?.display_name ?? 'Renter',
    priceQuoted: row.bookings?.price_quoted ?? row.amount,
    startDate: row.bookings?.start_date ?? '',
    endDate: row.bookings?.end_date ?? '',
    bookingStatus: row.bookings?.status ?? '',
  }
}

// Renter-submitted payments awaiting an admin decision, oldest first.
export function usePendingSubmissions() {
  return usePagedQuery(
    ['admin-pending-payments', 'submissions'],
    async (from, to) => {
      const { data, error } = await supabase
        .from('payments')
        .select(PAYMENT_SELECT)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .range(from, to)
      if (error) throw error
      return (data as unknown as PaymentRow[]).map(toAdminPayment)
    },
  )
}

// Every payment, newest first — the payments history table / CSV export.
export function useAdminPaymentHistory() {
  return usePagedQuery(['admin-payments'], async (from, to) => {
    const { data, error } = await supabase
      .from('payments')
      .select(PAYMENT_SELECT)
      .order('created_at', { ascending: false })
      .range(from, to)
    if (error) throw error
    return (data as unknown as PaymentRow[]).map(toAdminPayment)
  })
}

// Platform revenue = money actually received: the sum of succeeded payments.
// (Aggregated client-side; a server-side aggregate is out of scope.)
export function useSucceededPaymentsTotal() {
  return useQuery({
    queryKey: ['admin-payments', 'succeeded-total'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payments')
        .select('amount')
        .eq('status', 'succeeded')
      if (error) throw error
      const rows = (data ?? []) as { amount: number | string }[]
      return {
        total: rows.reduce((sum, r) => sum + Number(r.amount), 0),
        count: rows.length,
      }
    },
  })
}

export interface AwaitingPaymentBooking {
  id: string
  billboardTitle: string
  renterName: string
  priceQuoted: number
  startDate: string
  endDate: string
  // When the owner approved (falls back to the request time).
  approvedAt: string
}

interface AwaitingBookingRow {
  id: string
  price_quoted: number
  start_date: string
  end_date: string
  created_at: string
  decision_at: string | null
  billboards: { title: string } | null
  profiles: { display_name: string } | null
  payments: { id: string; status: Payment['status'] }[] | null
}

const OPEN_PAYMENT_STATUSES = new Set<Payment['status']>([
  'pending',
  'succeeded',
])

// Approved bookings (status 'payment_pending') with no open submission yet.
export function useAwaitingPaymentBookings() {
  return usePagedQuery(
    ['admin-pending-payments', 'awaiting'],
    async (from, to) => {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, price_quoted, start_date, end_date, created_at, decision_at, billboards(title), ' +
            'profiles!bookings_renter_id_fkey(display_name), payments!payments_booking_id_fkey(id, status)',
        )
        .eq('status', 'payment_pending')
        .order('created_at', { ascending: true })
        .range(from, to)
      if (error) throw error
      return (data as unknown as AwaitingBookingRow[])
        .filter(
          (row) =>
            !(row.payments ?? []).some((p) =>
              OPEN_PAYMENT_STATUSES.has(p.status),
            ),
        )
        .map((row): AwaitingPaymentBooking => ({
          id: row.id,
          billboardTitle: row.billboards?.title ?? 'Billboard',
          renterName: row.profiles?.display_name ?? 'Renter',
          priceQuoted: row.price_quoted,
          startDate: row.start_date,
          endDate: row.end_date,
          approvedAt: row.decision_at ?? row.created_at,
        }))
    },
  )
}

function invalidatePaymentQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin-pending-payments'] })
  qc.invalidateQueries({ queryKey: ['admin-payments'] })
  qc.invalidateQueries({ queryKey: ['admin-bookings'] })
  qc.invalidateQueries({ queryKey: ['owner-bookings'] })
  qc.invalidateQueries({ queryKey: ['my-bookings'] })
  qc.invalidateQueries({ queryKey: ['admin-payable-bookings'] })
}

export function useConfirmPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      bookingId: string
      amount: number
      reference?: string
    }) => {
      const { error } = await supabase.rpc('admin_confirm_payment', {
        p_booking_id: input.bookingId,
        p_amount: input.amount,
        p_reference: input.reference ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => invalidatePaymentQueries(qc),
  })
}

export function useRejectPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { paymentId: string; reason: string }) => {
      const reason = input.reason.trim()
      if (!reason) throw new Error('A reason is required to reject a payment')
      const { error } = await supabase.rpc('admin_reject_payment', {
        p_payment_id: input.paymentId,
        p_reason: reason,
      })
      if (error) throw error
    },
    onSuccess: () => invalidatePaymentQueries(qc),
  })
}
