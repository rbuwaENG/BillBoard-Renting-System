import { useQueries, useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { mergeBookedRanges, type BookedRange } from './availability'

interface BookedRangeRow {
  start_date: string
  end_date: string
}

export function toBookedRanges(rows: BookedRangeRow[] | null): BookedRange[] {
  return (rows ?? []).map((r) => ({
    startDate: r.start_date,
    endDate: r.end_date,
  }))
}

export const bookedRangesKey = (billboardId: string) =>
  ['booked-ranges', billboardId] as const

// Shared by the single-billboard hook, the cart (one per board) and the
// browse "available between" filter, so they all hit the same cache entry.
export function bookedRangesQueryOptions(billboardId: string) {
  return {
    queryKey: bookedRangesKey(billboardId),
    queryFn: async (): Promise<BookedRange[]> => {
      const { data, error } = await supabase.rpc(
        'get_billboard_booked_ranges',
        {
          p_billboard_id: billboardId,
        },
      )
      if (error) throw error
      return toBookedRanges(data as BookedRangeRow[] | null)
    },
    staleTime: 60_000,
    // A failure (e.g. the RPC isn't deployed yet) just means "availability
    // unavailable" — booking still works and the server re-checks overlaps,
    // so don't hold the UI up with retries.
    retry: false,
  }
}

// Upcoming blocking bookings (pending/payment_pending/confirmed/active) for
// one billboard — get_billboard_booked_ranges (contract 4).
export function useBookedRanges(billboardId: string | null | undefined) {
  return useQuery({
    ...bookedRangesQueryOptions(billboardId ?? ''),
    enabled: !!billboardId,
  })
}

// Booked days across several billboards combined (a campaign books every
// board in the cart for the same dates, so a day booked on any of them is
// unavailable for the campaign).
export function useCombinedBookedRanges(billboardIds: string[]) {
  return useQueries({
    queries: billboardIds.map((id) => bookedRangesQueryOptions(id)),
    combine: combineBookedRanges,
  })
}

// Module-level so useQueries only re-runs it when a result changes.
function combineBookedRanges(
  results: { data?: BookedRange[]; isLoading: boolean; isError: boolean }[],
) {
  return {
    ranges: mergeBookedRanges(results.map((r) => r.data ?? [])),
    isLoading: results.some((r) => r.isLoading),
    isError: results.some((r) => r.isError),
  }
}
