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

// The shared builder mock doesn't chain `upsert`/`not`; add them here.
function builder(result: { data: unknown; error: unknown }) {
  const b = createQueryBuilderMock(result)
  b.upsert = vi.fn(() => b)
  b.not = vi.fn(() => b)
  return b
}

describe('useSavePricingTiers', () => {
  it('upserts every tier, then deletes only the rows that were removed', async () => {
    const upsertBuilder = builder({ data: null, error: null })
    const deleteBuilder = builder({ data: null, error: null })
    vi.mocked(supabase.from)
      .mockReturnValueOnce(upsertBuilder as never)
      .mockReturnValueOnce(deleteBuilder as never)

    const { result } = renderHook(() => useSavePricingTiers('billboard-1'), {
      wrapper,
    })
    result.current.mutate([
      { id: 'tier-1', minDays: 1, maxDays: 6, pricePerDay: 100 },
      { id: 'tier-new', minDays: 7, maxDays: null, pricePerDay: 80 },
    ])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(upsertBuilder.upsert).toHaveBeenCalledWith(
      [
        {
          id: 'tier-1',
          billboard_id: 'billboard-1',
          min_days: 1,
          max_days: 6,
          price_per_day: 100,
        },
        {
          id: 'tier-new',
          billboard_id: 'billboard-1',
          min_days: 7,
          max_days: null,
          price_per_day: 80,
        },
      ],
      { onConflict: 'id' },
    )
    expect(deleteBuilder.delete).toHaveBeenCalled()
    expect(deleteBuilder.eq).toHaveBeenCalledWith('billboard_id', 'billboard-1')
    expect(deleteBuilder.not).toHaveBeenCalledWith(
      'id',
      'in',
      '(tier-1,tier-new)',
    )
  })

  it('gives rows without an id a generated one', async () => {
    const upsertBuilder = builder({ data: null, error: null })
    const deleteBuilder = builder({ data: null, error: null })
    vi.mocked(supabase.from)
      .mockReturnValueOnce(upsertBuilder as never)
      .mockReturnValueOnce(deleteBuilder as never)

    const { result } = renderHook(() => useSavePricingTiers('billboard-1'), {
      wrapper,
    })
    result.current.mutate([{ minDays: 1, maxDays: null, pricePerDay: 90 }])
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const [rows] = vi.mocked(upsertBuilder.upsert as ReturnType<typeof vi.fn>)
      .mock.calls[0] as [{ id: string }[]]
    expect(rows[0].id).toMatch(/^[0-9a-f-]{36}$/)
    expect(deleteBuilder.not).toHaveBeenCalledWith(
      'id',
      'in',
      `(${rows[0].id})`,
    )
  })

  it('never deletes anything when the upsert fails', async () => {
    const upsertBuilder = builder({ data: null, error: { message: 'boom' } })
    vi.mocked(supabase.from).mockReturnValueOnce(upsertBuilder as never)

    const { result } = renderHook(() => useSavePricingTiers('billboard-1'), {
      wrapper,
    })
    result.current.mutate([
      { id: 'tier-1', minDays: 1, maxDays: null, pricePerDay: 90 },
    ])

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })

  it('deletes all tiers (no upsert) when saving an empty list', async () => {
    const deleteBuilder = builder({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(deleteBuilder as never)

    const { result } = renderHook(() => useSavePricingTiers('billboard-1'), {
      wrapper,
    })
    result.current.mutate([])

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.from).toHaveBeenCalledTimes(1)
    expect(deleteBuilder.eq).toHaveBeenCalledWith('billboard_id', 'billboard-1')
    expect(deleteBuilder.not).not.toHaveBeenCalled()
  })
})
