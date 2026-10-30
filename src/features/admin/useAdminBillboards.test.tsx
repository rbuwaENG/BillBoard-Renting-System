import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import {
  useAdminSetBillboardStatus,
  useSetAdminPriceOverride,
} from './useAdminBillboards'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries')
  function wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return { wrapper, invalidate }
}

describe('useSetAdminPriceOverride', () => {
  it('updates admin_price_override_per_day', async () => {
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(updateBuilder as never)

    const { wrapper } = makeWrapper()
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

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useSetAdminPriceOverride(), { wrapper })
    result.current.mutate({ id: 'billboard-1', price: null })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(updateBuilder.update).toHaveBeenCalledWith({
      admin_price_override_per_day: null,
    })
  })
})

describe('useAdminSetBillboardStatus', () => {
  it('flags via admin_set_billboard_status with the reason and refreshes the moderation list', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never)

    const { wrapper, invalidate } = makeWrapper()
    const { result } = renderHook(() => useAdminSetBillboardStatus(), {
      wrapper,
    })
    result.current.mutate({
      id: 'billboard-1',
      status: 'flagged',
      reason: '  Misleading photos ',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('admin_set_billboard_status', {
      p_billboard_id: 'billboard-1',
      p_status: 'flagged',
      p_reason: 'Misleading photos',
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin-billboards'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['billboards'] })
  })

  it('requires a reason to flag', async () => {
    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useAdminSetBillboardStatus(), {
      wrapper,
    })
    result.current.mutate({
      id: 'billboard-1',
      status: 'flagged',
      reason: '   ',
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toMatch(
      /reason is required/i,
    )
    expect(supabase.rpc).not.toHaveBeenCalled()
  })

  it('falls back to a direct update when the RPC is not deployed yet', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST202', message: 'Could not find the function' },
    } as never)
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(updateBuilder as never)

    const { wrapper, invalidate } = makeWrapper()
    const { result } = renderHook(() => useAdminSetBillboardStatus(), {
      wrapper,
    })
    result.current.mutate({ id: 'billboard-1', status: 'inactive' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(updateBuilder.update).toHaveBeenCalledWith({ status: 'inactive' })
    expect(updateBuilder.eq).toHaveBeenCalledWith('id', 'billboard-1')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['admin-billboards'] })
  })

  it('surfaces other RPC errors without falling back', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Only an admin can moderate listings' },
    } as never)

    const { wrapper } = makeWrapper()
    const { result } = renderHook(() => useAdminSetBillboardStatus(), {
      wrapper,
    })
    result.current.mutate({ id: 'billboard-1', status: 'active' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { message: string }).message).toBe(
      'Only an admin can moderate listings',
    )
    expect(supabase.from).not.toHaveBeenCalled()
  })
})
