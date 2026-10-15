import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useSetAdminPriceOverride } from './useAdminBillboards'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useSetAdminPriceOverride', () => {
  it('updates admin_price_override_per_day', async () => {
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(updateBuilder as never)

    const { result } = renderHook(() => useSetAdminPriceOverride(), { wrapper })
    result.current.mutate({ id: 'billboard-1', price: 75 })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.from).toHaveBeenCalledWith('billboards')
    expect(updateBuilder.update).toHaveBeenCalledWith({
      admin_price_override_per_day: 75,
    })
  })

  it('clears the override by passing null', async () => {
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(updateBuilder as never)

    const { result } = renderHook(() => useSetAdminPriceOverride(), { wrapper })
    result.current.mutate({ id: 'billboard-1', price: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateBuilder.update).toHaveBeenCalledWith({
      admin_price_override_per_day: null,
    })
  })
})
