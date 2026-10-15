import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useCreatePayout, useReleasePayout } from './useAdminPayouts'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useCreatePayout', () => {
  it('calls admin_create_payout with the selected bookings and release date', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: 'payout-1' }, error: null } as never)

    const { result } = renderHook(() => useCreatePayout(), { wrapper })
    result.current.mutate({
      ownerId: 'owner-1',
      bookingIds: ['booking-1', 'booking-2'],
      scheduledReleaseDate: '2026-11-01',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('admin_create_payout', {
      p_owner_id: 'owner-1',
      p_booking_ids: ['booking-1', 'booking-2'],
      p_scheduled_release_date: '2026-11-01',
    })
  })
})

describe('useReleasePayout', () => {
  it('calls admin_release_payout for the given payout', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: 'payout-1' }, error: null } as never)

    const { result } = renderHook(() => useReleasePayout(), { wrapper })
    result.current.mutate('payout-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('admin_release_payout', {
      p_payout_id: 'payout-1',
    })
  })
})
