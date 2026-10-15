import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useSubmitReview } from './useReviews'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useSubmitReview', () => {
  it('calls submit_review with the rating and comment', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: 'review-1' }, error: null } as never)

    const { result } = renderHook(() => useSubmitReview(), { wrapper })
    result.current.mutate({ bookingId: 'booking-1', rating: 4, comment: 'Great spot' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('submit_review', {
      p_booking_id: 'booking-1',
      p_rating: 4,
      p_comment: 'Great spot',
    })
  })

  it('surfaces an RPC error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: new Error('This booking has already been reviewed'),
    } as never)

    const { result } = renderHook(() => useSubmitReview(), { wrapper })
    result.current.mutate({ bookingId: 'booking-1', rating: 5 })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe(
      'This booking has already been reviewed',
    )
  })
})
