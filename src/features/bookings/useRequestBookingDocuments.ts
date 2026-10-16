import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

export function useRequestBookingDocuments() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ bookingId, note }: { bookingId: string; note: string }) => {
      const { error } = await supabase.rpc('request_booking_documents', {
        p_booking_id: bookingId,
        p_note: note,
      })
      if (error) throw error
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['booking-events', vars.bookingId] })
    },
  })
}
