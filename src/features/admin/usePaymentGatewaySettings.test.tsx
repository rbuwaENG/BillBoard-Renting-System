import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import { useUpdatePaymentGatewaySettings } from './usePaymentGatewaySettings'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

describe('useUpdatePaymentGatewaySettings', () => {
  it('updates provider, keys, and enabled flag', async () => {
    const updateBuilder = createQueryBuilderMock({ data: null, error: null })
    vi.mocked(supabase.from).mockReturnValueOnce(updateBuilder as never)

    const { result } = renderHook(() => useUpdatePaymentGatewaySettings(), {
      wrapper,
    })
    result.current.mutate({
      provider: 'stripe',
      publicKey: 'pk_test_123',
      secretKey: 'sk_test_456',
      isEnabled: true,
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.from).toHaveBeenCalledWith('payment_gateway_settings')
    expect(updateBuilder.update).toHaveBeenCalledWith({
      provider: 'stripe',
      public_key: 'pk_test_123',
      secret_key: 'sk_test_456',
      is_enabled: true,
    })
  })
})
