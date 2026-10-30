import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useAuthStore } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import { createQueryBuilderMock } from '@/test/supabaseMock'
import { useMyPayments } from './useMyPayments'

const initialAuth = useAuthStore.getState()

afterEach(() => {
  useAuthStore.setState(initialAuth, true)
})

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useMyPayments', () => {
  it('embeds bookings through the payments.booking_id FK (payments and bookings are linked by two FKs)', async () => {
    useAuthStore.setState({
      user: { uid: 'renter-1', role: 'renter' } as never,
      isLoading: false,
      profileError: null,
    })
    const builder = createQueryBuilderMock({
      data: [
        {
          id: 'p1',
          booking_id: 'b1',
          amount: 500,
          currency: 'LKR',
          status: 'succeeded',
          reference: 'TRX',
          created_at: '2026-10-01T00:00:00Z',
          confirmed_at: null,
          bookings: { billboards: { title: 'Main Street Board' } },
        },
      ],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValueOnce(builder as never)

    const { result } = renderHook(() => useMyPayments(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(builder.select).toHaveBeenCalledWith(
      '*, bookings!payments_booking_id_fkey(billboards(title))',
    )
    expect(builder.eq).toHaveBeenCalledWith('renter_id', 'renter-1')
    expect(result.current.data?.[0]).toMatchObject({
      id: 'p1',
      bookingId: 'b1',
      billboardTitle: 'Main Street Board',
      amount: 500,
    })
  })
})
