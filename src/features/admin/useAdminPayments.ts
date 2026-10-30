import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { invalidateBooking, queryKeys } from '@/lib/queryKeys'
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
// Every paged query ends its ORDER BY on `id`: rows created in one statement
// (e.g. `create_campaign`) share `created_at`, and without a unique
// tie-breaker `.range()` pages could repeat or skip them.
export function usePendingSubmissions() {
  return usePagedQuery(
    queryKeys.adminPendingPayments.submissions,
    async (from, to) => {
      const { data, error } = await supabase
        .from('payments')
        .select(PAYMENT_SELECT)
        .eq('status', 'pending')
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
      if (error) throw error
      return (data as unknown as PaymentRow[]).map(toAdminPayment)
    },
  )
}

function paymentHistoryPage(from: number, to: number) {
  return supabase
    .from('payments')
    .select(PAYMENT_SELECT)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)
}

// Every payment, newest first — the payments history table.
export function useAdminPaymentHistory() {
  return usePagedQuery(queryKeys.adminPayments.all, async (from, to) => {
    const { data, error } = await paymentHistoryPage(from, to)
    if (error) throw error
    return (data as unknown as PaymentRow[]).map(toAdminPayment)
  })
}

// The whole payment history (not just the loaded pages) for the CSV export.
export async function fetchAllPaymentHistory(): Promise<AdminPayment[]> {
  const rows = await fetchAllRows<PaymentRow>(paymentHistoryPage)
  return rows.map(toAdminPayment)
}

// Platform revenue = money actually received: the sum of succeeded payments.
// (Aggregated client-side, paging past PostgREST's 1000-row cap.)
export function useSucceededPaymentsTotal() {
  return useQuery({
    queryKey: queryKeys.adminPayments.succeededTotal,
    queryFn: async () => {
      const rows = await fetchAllRows<{ amount: number | string }>((from, to) =>
        supabase
          .from('payments')
          .select('id, amount')
          .eq('status', 'succeeded')
          .order('id', { ascending: true })
          .range(from, to),
      )
      return {
        total: rows.reduce((sum, r) => sum + Number(r.amount), 0),
        count: rows.length,
      }
    },
  })
}

// Legacy payments: 'succeeded' but never verified by an admin (0031 stripped
// the renter self-confirmations). They can't be paid out until an admin
// verifies them with `admin_verify_payment` (0035).
export function useUnverifiedPayments() {
  return usePagedQuery(
    queryKeys.adminPendingPayments.unverified,
    async (from, to) => {
      const { data, error } = await supabase
        .from('payments')
        .select(PAYMENT_SELECT)
        .eq('status', 'succeeded')
        .is('confirmed_by', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
      if (error) throw error
      return (data as unknown as PaymentRow[]).map(toAdminPayment)
    },
  )
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
}

// Approved bookings (status 'payment_pending') with no open submission yet.
// `bookings.payment_id` points at the open payment: `renter_submit_payment`
// sets it and `admin_reject_payment` clears it, so the filter runs in SQL —
// filtering after `.range()` would make "Load more" pages short or empty.
export function useAwaitingPaymentBookings() {
  return usePagedQuery(
    queryKeys.adminPendingPayments.awaiting,
    async (from, to) => {
      const { data, error } = await supabase
        .from('bookings')
        .select(
          'id, price_quoted, start_date, end_date, created_at, decision_at, billboards(title), ' +
            'profiles!bookings_renter_id_fkey(display_name)',
        )
        .eq('status', 'payment_pending')
        .is('payment_id', null)
        .order('created_at', { ascending: true })
        .order('id', { ascending: true })
        .range(from, to)
      if (error) throw error
      return (data as unknown as AwaitingBookingRow[]).map(
        (row): AwaitingPaymentBooking => ({
          id: row.id,
          billboardTitle: row.billboards?.title ?? 'Billboard',
          renterName: row.profiles?.display_name ?? 'Renter',
          priceQuoted: row.price_quoted,
          startDate: row.start_date,
          endDate: row.end_date,
          approvedAt: row.decision_at ?? row.created_at,
        }),
      )
    },
  )
}

// A payment decision moves the booking (and payable/payout state), so
// refresh everything booking-derived.
function invalidatePaymentQueries(qc: ReturnType<typeof useQueryClient>) {
  void invalidateBooking(qc)
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

// The confirm dialog shows the error inline, so no global toast.
export function useVerifyPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (paymentId: string) => {
      const { error } = await supabase.rpc('admin_verify_payment', {
        p_payment_id: paymentId,
      })
      if (error) throw error
    },
    meta: { suppressErrorToast: true },
    onSuccess: () => invalidatePaymentQueries(qc),
  })
}
