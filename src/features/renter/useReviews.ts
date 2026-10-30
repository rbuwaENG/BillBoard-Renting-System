import { useMutation, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

interface SubmitReviewInput {
  bookingId: string
  rating: number
  comment?: string
}

export function useSubmitReview() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: SubmitReviewInput) => {
      const { error } = await supabase.rpc('submit_review', {
        p_booking_id: input.bookingId,
        p_rating: input.rating,
        p_comment: input.comment ?? null,
      })
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.myBookings.all })
      qc.invalidateQueries({ queryKey: queryKeys.billboards })
      qc.invalidateQueries({ queryKey: queryKeys.billboardsNear.all })
    },
  })
}
