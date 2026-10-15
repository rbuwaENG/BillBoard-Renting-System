import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useSavePricingTiers } from './usePricingTiers'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useSavePricingTiers', () => {
  it('deletes existing tiers then inserts the new list', async () => {
    const deleteBuilder = createQueryBuilderMock({ data: null, error: null })
    const insertBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from)
      .mockReturnValueOnce(deleteBuilder as never)
      .mockReturnValueOnce(insertBuilder as never)

    const { result } = renderHook(() => useSavePricingTiers('billboard-1'), {
      wrapper,
    })
    result.current.mutate([
      { minDays: 1, maxDays: 6, pricePerDay: 100 },
      { minDays: 7, maxDays: null, pricePerDay: 80 },
    ])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('billboard_id', 'billboard-1')
    expect(insertBuilder.insert).toHaveBeenCalledWith([
      { billboard_id: 'billboard-1', min_days: 1, max_days: 6, price_per_day: 100 },
      { billboard_id: 'billboard-1', min_days: 7, max_days: null, price_per_day: 80 },
    ])
  })

  it('skips the insert call when saving an empty list', async () => {
    const deleteBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(deleteBuilder as never)

    const { result } = renderHook(() => useSavePricingTiers('billboard-1'), {
      wrapper,
    })
    result.current.mutate([])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.from).toHaveBeenCalledTimes(1)
  })
})
