import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'

interface RequestBookingInput {
  billboardId: string
  startDate: string
  endDate: string
  creativeUrl?: string
}

export function useRequestBooking() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: RequestBookingInput) => {
      const { data, error } = await supabase.rpc('request_booking', {
        p_billboard_id: input.billboardId,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_creative_url: input.creativeUrl ?? null,
      })
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['my-bookings'] })
      qc.invalidateQueries({ queryKey: ['owner-bookings'] })
    },
  })
}
