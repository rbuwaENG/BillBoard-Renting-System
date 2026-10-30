import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export interface BookingContact {
  email: string | null
  phone: string | null
}

// Contract 5: counterparty email/phone, only for booking participants once
// the booking is confirmed/active/completed. The RPC may return a single
// row or a one-row set depending on how it's declared — accept both.
export function useBookingContact(
  bookingId: string | null | undefined,
  enabled: boolean,
) {
  return useQuery({
    queryKey: ['booking-contact', bookingId],
    queryFn: async (): Promise<BookingContact | null> => {
      const { data, error } = await supabase.rpc('get_booking_contact', {
        p_booking_id: bookingId,
      })
      if (error) throw error
      const row = (Array.isArray(data) ? data[0] : data) as
        { email?: string | null; phone?: string | null } | null | undefined
      if (!row) return null
      return { email: row.email ?? null, phone: row.phone ?? null }
    },
    enabled: !!bookingId && enabled,
    retry: false,
    staleTime: 5 * 60_000,
  })
}
