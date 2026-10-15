import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useConfirmPayment } from './useAdminPayments'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useConfirmPayment', () => {
  it('calls admin_confirm_payment with the entered amount and reference', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({ data: { id: 'payment-1' }, error: null } as never)

    const { result } = renderHook(() => useConfirmPayment(), { wrapper })
    result.current.mutate({
      bookingId: 'booking-1',
      amount: 250,
      reference: 'bank-ref-123',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('admin_confirm_payment', {
      p_booking_id: 'booking-1',
      p_amount: 250,
      p_reference: 'bank-ref-123',
    })
  })
})
