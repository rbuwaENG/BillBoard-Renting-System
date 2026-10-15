import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useRenterPayBooking } from './useMyBookings'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useRenterPayBooking', () => {
  it('calls renter_pay_booking with the booking id', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: 'payment-1' },
      error: null,
    } as never)

    const { result } = renderHook(() => useRenterPayBooking(), { wrapper })
    result.current.mutate('booking-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('renter_pay_booking', {
      p_booking_id: 'booking-1',
    })
  })

  it('surfaces an RPC error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: new Error('Booking is not awaiting payment'),
    } as never)

    const { result } = renderHook(() => useRenterPayBooking(), { wrapper })
    result.current.mutate('booking-1')

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe(
      'Booking is not awaiting payment',
    )
  })
})
