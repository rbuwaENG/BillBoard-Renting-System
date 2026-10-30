import { useQuery } from '@tanstack/react-query'
import { fetchAllRows } from '@/lib/fetchAllRows'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import type { Booking } from '@/types'
import { usePagedQuery } from './usePagedQuery'

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
}

function toBooking(row: BookingRow): Booking {
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
  }
}

export interface AdminBookingRow extends Booking {
  billboardTitle: string
  renterName: string
  ownerName: string
}

interface JoinedBookingRow extends BookingRow {
  billboards: { title: string } | null
  renter: { display_name: string } | null
  owner: { display_name: string } | null
}

function adminBookingsPage(from: number, to: number) {
  return supabase
    .from('bookings')
    .select(
      '*, billboards(title), renter:profiles!bookings_renter_id_fkey(display_name), ' +
        'owner:profiles!bookings_owner_id_fkey(display_name)',
    )
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .range(from, to)
}

function toAdminBookingRow(row: JoinedBookingRow): AdminBookingRow {
  return {
    ...toBooking(row),
    billboardTitle: row.billboards?.title ?? 'Billboard',
    renterName: row.renter?.display_name ?? 'Renter',
    ownerName: row.owner?.display_name ?? 'Owner',
  }
}

// Paged ("Load more") bookings table for the Bookings tab, newest first.
// `id` breaks `created_at` ties (a campaign's bookings share a timestamp).
export function useAdminBookingsPaged() {
  return usePagedQuery(queryKeys.adminBookings.paged, async (from, to) => {
    const { data, error } = await adminBookingsPage(from, to)
    if (error) throw error
    return (data as unknown as JoinedBookingRow[]).map(toAdminBookingRow)
  })
}

// Every booking (not just the loaded pages) for the CSV export.
export async function fetchAllAdminBookings(): Promise<AdminBookingRow[]> {
  const rows = await fetchAllRows<JoinedBookingRow>(adminBookingsPage)
  return rows.map(toAdminBookingRow)
}

// Platform-wide bookings for the Admin analytics dashboard — RLS allows an
// admin to see every booking, not just ones they're a participant in. Paged
// past PostgREST's 1000-row cap so the totals cover every booking.
export function useAllBookings() {
  return useQuery({
    queryKey: queryKeys.adminBookings.all,
    queryFn: async () => {
      const rows = await fetchAllRows<BookingRow>((from, to) =>
        supabase
          .from('bookings')
          .select('*')
          .order('created_at', { ascending: false })
          .order('id', { ascending: false })
          .range(from, to),
      )
      return rows.map(toBooking)
    },
  })
}
