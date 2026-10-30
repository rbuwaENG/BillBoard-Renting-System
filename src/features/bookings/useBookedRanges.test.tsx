import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { applyAvailabilityFilter } from '@/features/billboards/useAvailabilityFilter'
import {
  toBookedRanges,
  useBookedRanges,
  useCombinedBookedRanges,
} from './useBookedRanges'

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useBookedRanges', () => {
  it('maps snake_case rows to { startDate, endDate }', () => {
    expect(
      toBookedRanges([{ start_date: '2026-11-05', end_date: '2026-11-07' }]),
    ).toEqual([{ startDate: '2026-11-05', endDate: '2026-11-07' }])
    expect(toBookedRanges(null)).toEqual([])
  })

  it('calls get_billboard_booked_ranges for the billboard', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ start_date: '2026-11-05', end_date: '2026-11-07' }],
      error: null,
    } as never)
    const { result } = renderHook(() => useBookedRanges('bb-1'), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('get_billboard_booked_ranges', {
      p_billboard_id: 'bb-1',
    })
    expect(result.current.data).toEqual([
      { startDate: '2026-11-05', endDate: '2026-11-07' },
    ])
  })

  it('surfaces errors (availability unavailable) without retrying', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'function does not exist' },
    } as never)
    const { result } = renderHook(() => useBookedRanges('bb-1'), { wrapper })
    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledTimes(1)
    vi.mocked(supabase.rpc).mockImplementation(
      () => Promise.resolve({ data: null, error: null }) as never,
    )
  })

  it('does nothing without a billboard id', () => {
    renderHook(() => useBookedRanges(null), { wrapper })
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('combines several billboards into merged ranges', async () => {
    vi.mocked(supabase.rpc).mockImplementation(((
      _fn: string,
      args: { p_billboard_id: string },
    ) =>
      Promise.resolve({
        data:
          args.p_billboard_id === 'a'
            ? [{ start_date: '2026-11-05', end_date: '2026-11-07' }]
            : [{ start_date: '2026-11-08', end_date: '2026-11-08' }],
        error: null,
      })) as never)
    const { result } = renderHook(() => useCombinedBookedRanges(['a', 'b']), {
      wrapper,
    })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.ranges).toEqual([
      { startDate: '2026-11-05', endDate: '2026-11-08' },
    ])
    vi.mocked(supabase.rpc).mockImplementation(
      () => Promise.resolve({ data: null, error: null }) as never,
    )
  })
})

describe('applyAvailabilityFilter', () => {
  const boards = [
    { id: 'free' },
    { id: 'busy' },
    { id: 'failed' },
    { id: 'far' },
  ]
  const range = { startDate: '2026-11-01', endDate: '2026-11-10' }
  const lookups = [
    { data: [], isError: false, isPending: false },
    {
      data: [{ startDate: '2026-11-09', endDate: '2026-11-12' }],
      isError: false,
      isPending: false,
    },
    { data: undefined, isError: true, isPending: false },
  ]

  it('keeps free and unknown boards, drops booked ones and those past the cap', () => {
    expect(applyAvailabilityFilter(boards, range, lookups, 3)).toEqual({
      results: [{ id: 'free' }, { id: 'failed' }],
      checking: false,
      uncheckedCount: 1,
      failedCount: 1,
    })
  })

  it('reports while lookups are still pending', () => {
    const pending = [{ data: undefined, isError: false, isPending: true }]
    expect(
      applyAvailabilityFilter([{ id: 'x' }], range, pending, 3),
    ).toMatchObject({ results: [], checking: true })
  })
})
