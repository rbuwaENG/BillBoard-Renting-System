import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Booking } from '@/types'

export interface RentorBookingRequest extends Booking {
  renterName: string
  billboardTitle: string
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
  billboards: { title: string } | null
  profiles: { display_name: string } | null
}

function toRentorBookingRequest(row: BookingRow): RentorBookingRequest {
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
    renterName: row.profiles?.display_name ?? 'Renter',
  }
}

export function useOwnerBookings() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['owner-bookings', user?.uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bookings')
        .select('*, billboards(title), profiles!bookings_renter_id_fkey(display_name)')
        .eq('owner_id', user!.uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as BookingRow[]).map(toRentorBookingRequest)
    },
    enabled: !!user,
  })
}

export function useRespondToBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      bookingId,
      approve,
      reason,
    }: {
      bookingId: string
      approve: boolean
      reason?: string
    }) => {
      const { error } = await supabase.rpc('respond_to_booking', {
        p_booking_id: bookingId,
        p_approve: approve,
        p_reason: reason ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['owner-bookings'] })
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
    },
  })
}
