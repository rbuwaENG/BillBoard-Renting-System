import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc('cancel_booking', { p_booking_id: bookingId })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['booked-ranges'] })
      qc.invalidateQueries({ queryKey: ['owner-bookings'] })
    },
  })
}
