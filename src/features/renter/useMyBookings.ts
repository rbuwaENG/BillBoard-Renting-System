import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Booking } from '@/types'

export interface MyBooking extends Booking {
  billboardTitle: string
  billboardCity: string
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
  billboards: { title: string; city: string } | null
}

function toMyBooking(row: BookingRow): MyBooking {
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
    billboardTitle: row.billboards?.title ?? 'Billboard',
    billboardCity: row.billboards?.city ?? '',
  }
}

export function useMyBookings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-bookings', user?.uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, billboards(title, city)')
        .eq('renter_id', user!.uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as BookingRow[]).map(toMyBooking)
    },
    enabled: !!user,
  })
}
