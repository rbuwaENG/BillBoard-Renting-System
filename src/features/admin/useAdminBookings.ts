import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { Booking } from '@/types'

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

// Platform-wide bookings for the Admin analytics dashboard — RLS allows an
// admin to see every booking, not just ones they're a participant in.
export function useAllBookings() {
  return useQuery({
    queryKey: ['admin-bookings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as BookingRow[]).map(toBooking)
    },
  })
}
