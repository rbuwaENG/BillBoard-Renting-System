import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getPaymentState,
  type BookingPaymentSummary,
  type PaymentRowStatus,
  type PaymentState,
} from '@/features/payments/paymentState'
import { useAuth } from '@/hooks/useAuth'
import { invalidateBooking, queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import type { Booking } from '@/types'

export interface MyBooking extends Booking {
  billboardTitle: string
  billboardCity: string
  // False when the billboard row is no longer visible to the renter (RLS only
  // exposes active listings), i.e. it was unlisted/archived/flagged.
  billboardListed: boolean
  review: { id: string; rating: number } | null
  payments: BookingPaymentSummary[]
  paymentState: PaymentState
}

interface BookingRow {
  id: string
  billboard_id: string
  owner_id: string
  renter_id: string
  start_date: string
  end_date: string
  creative_url: string | null
  price_quoted: number
  status: Booking['status']
  payment_id: string | null
  rejection_reason: string | null
  created_at: string
  updated_at: string
  decision_at: string | null
  billboards: { title: string; city: string; status: string } | null
  reviews: { id: string; rating: number }[] | null
  payments:
    | {
        id: string
        status: PaymentRowStatus
        reference: string | null
        created_at: string
      }[]
    | null
}

// bookings ↔ payments has two FKs (payments.booking_id and
// bookings.payment_id), so the embed names the one-to-many constraint.
export const MY_BOOKINGS_SELECT =
  '*, billboards(title, city, status), reviews(id, rating), payments!payments_booking_id_fkey(id, status, reference, created_at)'

export function toMyBooking(row: BookingRow): MyBooking {
  const payments = (row.payments ?? []).map((p) => ({
    id: p.id,
    status: p.status,
    reference: p.reference,
    createdAt: p.created_at,
  }))
  return {
    id: row.id,
    billboardId: row.billboard_id,
    ownerId: row.owner_id,
    renterId: row.renter_id,
    startDate: row.start_date,
    endDate: row.end_date,
    creativeUrl: row.creative_url ?? undefined,
    priceQuoted: row.price_quoted,
    status: row.status,
    paymentId: row.payment_id ?? undefined,
    rejectionReason: row.rejection_reason ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    decisionAt: row.decision_at ?? undefined,
    billboardTitle: row.billboards?.title ?? 'Unlisted billboard',
    billboardCity: row.billboards?.city ?? '',
    billboardListed: row.billboards?.status === 'active',
    review: row.reviews?.[0] ?? null,
    payments,
    paymentState: getPaymentState(payments),
  }
}

export function useMyBookings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.myBookings(user?.uid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select(MY_BOOKINGS_SELECT)
        .eq('renter_id', user!.uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as BookingRow[]).map(toMyBooking)
    },
    enabled: !!user,
  })
}

// Contract 1: the renter only *reports* a bank transfer — an admin confirms
// (admin_confirm_payment) or rejects (admin_reject_payment) it. The booking
// stays payment_pending until then.
export function useSubmitPayment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      bookingId,
      reference,
    }: {
      bookingId: string
      reference?: string
    }) => {
      const { data, error } = await supabase.rpc('renter_submit_payment', {
        p_booking_id: bookingId,
        p_reference: reference?.trim() ? reference.trim() : null,
      })
      if (error) throw error
      return data
    },
    onSuccess: (_data, vars) => {
      invalidateBooking(qc, vars.bookingId)
    },
  })
}
