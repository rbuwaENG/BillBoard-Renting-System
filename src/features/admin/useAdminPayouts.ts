import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import type { Booking, PayoutStatus } from '@/types'

export interface PayableBooking {
  id: string
  billboardTitle: string
  priceQuoted: number
}

export interface PayableOwnerGroup {
  ownerId: string
  ownerName: string
  bookings: PayableBooking[]
  total: number
}

interface PayableBookingRow {
  id: string
  owner_id: string
  price_quoted: number
  status: Booking['status']
  billboards: { title: string } | null
  profiles: { display_name: string } | null
  payments: { status: string; confirmed_by: string | null }[] | null
}

interface PayoutItemRow {
  booking_id: string
  payouts: { status: PayoutStatus } | null
}

const PAYABLE_STATUSES: Booking['status'][] = [
  'confirmed',
  'active',
  'completed',
]

// Payments contract: only money an admin has actually confirmed is payable —
// a booking needs a `succeeded` payment with `confirmed_by` set.
export function hasConfirmedPayment(
  row: Pick<PayableBookingRow, 'payments'>,
): boolean {
  return (row.payments ?? []).some(
    (p) => p.status === 'succeeded' && !!p.confirmed_by,
  )
}

// Bookings with an admin-confirmed payment that aren't attached to a live
// (non-cancelled) payout yet, grouped by rentor — the admin picks from this
// list when creating a payout.
export function usePayableBookings() {
  return useQuery({
    queryKey: queryKeys.adminPayableBookings,
    queryFn: async (): Promise<PayableOwnerGroup[]> => {
      const [
        { data: bookings, error: bookingsError },
        { data: payoutItems, error: payoutItemsError },
      ] = await Promise.all([
        supabase
          .from('bookings')
          .select(
            'id, owner_id, price_quoted, status, billboards(title), profiles!bookings_owner_id_fkey(display_name), ' +
              'payments!payments_booking_id_fkey(status, confirmed_by)',
          )
          .in('status', PAYABLE_STATUSES),
        supabase.from('payout_items').select('booking_id, payouts(status)'),
      ])
      if (bookingsError) throw bookingsError
      if (payoutItemsError) throw payoutItemsError

      const paidOutIds = new Set(
        ((payoutItems ?? []) as unknown as PayoutItemRow[])
          .filter((p) => p.payouts?.status !== 'cancelled')
          .map((p) => p.booking_id),
      )
      const eligible = (
        (bookings ?? []) as unknown as PayableBookingRow[]
      ).filter((b) => !paidOutIds.has(b.id) && hasConfirmedPayment(b))

      const groups = new Map<string, PayableOwnerGroup>()
      for (const row of eligible) {
        const group = groups.get(row.owner_id) ?? {
          ownerId: row.owner_id,
          ownerName: row.profiles?.display_name ?? 'Owner',
          bookings: [],
          total: 0,
        }
        group.bookings.push({
          id: row.id,
          billboardTitle: row.billboards?.title ?? 'Billboard',
          priceQuoted: row.price_quoted,
        })
        group.total += row.price_quoted
        groups.set(row.owner_id, group)
      }
      return Array.from(groups.values())
    },
  })
}

export interface AdminPayout {
  id: string
  ownerId: string
  ownerName: string
  amount: number
  grossAmount: number
  feeAmount: number
  currency: string
  status: PayoutStatus
  scheduledReleaseDate: string
  releasedAt?: string
  createdAt: string
}

interface PayoutRow {
  id: string
  owner_id: string
  amount: number
  gross_amount: number
  fee_amount: number
  currency: string
  status: PayoutStatus
  scheduled_release_date: string
  released_at: string | null
  created_at: string
  profiles: { display_name: string } | null
}

export function useAdminPayouts() {
  return useQuery({
    queryKey: queryKeys.adminPayouts,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('*, profiles!payouts_owner_id_fkey(display_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as PayoutRow[]).map((row): AdminPayout => ({
        id: row.id,
        ownerId: row.owner_id,
        ownerName: row.profiles?.display_name ?? 'Owner',
        amount: row.amount,
        grossAmount: row.gross_amount,
        feeAmount: row.fee_amount,
        currency: row.currency,
        status: row.status,
        scheduledReleaseDate: row.scheduled_release_date,
        releasedAt: row.released_at ?? undefined,
        createdAt: row.created_at,
      }))
    },
  })
}

function invalidatePayoutQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.adminPayouts })
  qc.invalidateQueries({ queryKey: queryKeys.adminPayableBookings })
  qc.invalidateQueries({ queryKey: queryKeys.myPayouts.all })
}

export function useCreatePayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      ownerId: string
      bookingIds: string[]
      scheduledReleaseDate: string
    }) => {
      const { error } = await supabase.rpc('admin_create_payout', {
        p_owner_id: input.ownerId,
        p_booking_ids: input.bookingIds,
        p_scheduled_release_date: input.scheduledReleaseDate,
      })
      if (error) throw error
    },
    onSuccess: () => invalidatePayoutQueries(qc),
  })
}

export function useReleasePayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await supabase.rpc('admin_release_payout', {
        p_payout_id: payoutId,
      })
      if (error) throw error
    },
    onSuccess: () => invalidatePayoutQueries(qc),
  })
}

// Cancels an approved (not yet released) payout. No RLS policy lets an admin
// update `payouts` directly, so this goes through `admin_cancel_payout`,
// which is expected to free the payout's bookings for a new payout.
export function useCancelPayout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payoutId: string) => {
      const { error } = await supabase.rpc('admin_cancel_payout', {
        p_payout_id: payoutId,
      })
      if (error) throw error
    },
    onSuccess: () => invalidatePayoutQueries(qc),
  })
}
