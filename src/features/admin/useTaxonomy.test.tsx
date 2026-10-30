import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { formatAge, todayIsoDate } from './adminUtils'
import { useRemoveCategory, useRemoveSize } from './useTaxonomy'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

const FK_ERROR = { code: '23503', message: 'violates foreign key constraint' }

describe('taxonomy delete', () => {
  it('explains an in-use category with the billboard count', async () => {
    const countBuilder = createQueryBuilderMock({
      data: null,
      error: null,
      count: 3,
    } as never)
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        createQueryBuilderMock({ data: null, error: FK_ERROR }) as never,
      )
      .mockReturnValueOnce(countBuilder as never)

    const { result } = renderHook(() => useRemoveCategory(), { wrapper })
    result.current.mutate('cat-1')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe(
      "Can't delete this category — it's in use by 3 billboards. Reassign those listings first.",
    )
    expect(countBuilder.eq).toHaveBeenCalledWith('category_id', 'cat-1')
  })

  it('uses the size column for sizes and singular wording', async () => {
    const countBuilder = createQueryBuilderMock({
      data: null,
      error: null,
      count: 1,
    } as never)
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        createQueryBuilderMock({ data: null, error: FK_ERROR }) as never,
      )
      .mockReturnValueOnce(countBuilder as never)

    const { result } = renderHook(() => useRemoveSize(), { wrapper })
    result.current.mutate('size-1')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(
      /in use by 1 billboard\./,
    )
    expect(countBuilder.eq).toHaveBeenCalledWith('size_id', 'size-1')
  })

  it('passes other errors through unchanged', async () => {
    vi.mocked(supabase.from).mockReturnValueOnce(
      createQueryBuilderMock({
        data: null,
        error: { code: '42501', message: 'denied' },
      }) as never,
    )

    const { result } = renderHook(() => useRemoveCategory(), { wrapper })
    result.current.mutate('cat-1')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { message: string }).message).toBe('denied')
  })
})

describe('admin utils', () => {
  it('formats ages compactly', () => {
    const now = Date.parse('2026-10-30T12:00:00Z')
    expect(formatAge('2026-10-30T11:59:40Z', now)).toBe('just now')
    expect(formatAge('2026-10-30T11:15:00Z', now)).toBe('45m ago')
    expect(formatAge('2026-10-30T02:00:00Z', now)).toBe('10h ago')
    expect(formatAge('2026-10-25T12:00:00Z', now)).toBe('5d ago')
    expect(formatAge(null, now)).toBe('—')
  })

  it('returns a local YYYY-MM-DD date', () => {
    expect(todayIsoDate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
