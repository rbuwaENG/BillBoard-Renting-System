import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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
}

const PAYABLE_STATUSES: Booking['status'][] = ['confirmed', 'active', 'completed']

// Bookings whose payment has been confirmed but that haven't been attached
// to a payout yet, grouped by rentor — the admin picks from this list when
// creating a payout.
export function usePayableBookings() {
  return useQuery({
    queryKey: ['admin-payable-bookings'],
    queryFn: async (): Promise<PayableOwnerGroup[]> => {
      const [{ data: bookings, error: bookingsError }, { data: payoutItems, error: payoutItemsError }] =
        await Promise.all([
          supabase
            .from('bookings')
            .select('id, owner_id, price_quoted, status, billboards(title), profiles!bookings_owner_id_fkey(display_name)')
            .in('status', PAYABLE_STATUSES),
          supabase.from('payout_items').select('booking_id'),
        ])
      if (bookingsError) throw bookingsError
      if (payoutItemsError) throw payoutItemsError

      const paidOutIds = new Set((payoutItems as { booking_id: string }[]).map((p) => p.booking_id))
      const eligible = (bookings as unknown as PayableBookingRow[]).filter(
        (b) => !paidOutIds.has(b.id),
      )

      const groups = new Map<string, PayableOwnerGroup>()
      for (const row of eligible) {
        const group = groups.get(row.owner_id) ?? {
          ownerId: row.owner_id,
          ownerName: row.profiles?.display_name ?? 'Rentor',
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
  currency: string
  status: PayoutStatus
  scheduled_release_date: string
  released_at: string | null
  created_at: string
  profiles: { display_name: string } | null
}

export function useAdminPayouts() {
  return useQuery({
    queryKey: ['admin-payouts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('*, profiles!payouts_owner_id_fkey(display_name)')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as PayoutRow[]).map(
        (row): AdminPayout => ({
          id: row.id,
          ownerId: row.owner_id,
          ownerName: row.profiles?.display_name ?? 'Rentor',
          amount: row.amount,
          currency: row.currency,
          status: row.status,
          scheduledReleaseDate: row.scheduled_release_date,
          releasedAt: row.released_at ?? undefined,
          createdAt: row.created_at,
        }),
      )
    },
  })
}

function invalidatePayoutQueries(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['admin-payouts'] })
  qc.invalidateQueries({ queryKey: ['admin-payable-bookings'] })
  qc.invalidateQueries({ queryKey: ['my-payouts'] })
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
