import { useMutation, useQueryClient } from '@tanstack/react-query'
import { invalidateBooking } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

export function useCancelBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (bookingId: string) => {
      const { error } = await supabase.rpc('cancel_booking', {
        p_booking_id: bookingId,
      })
      if (error) throw error
    },
    onSuccess: (_data, bookingId) => {
      invalidateBooking(qc, bookingId)
    },
  })
}
