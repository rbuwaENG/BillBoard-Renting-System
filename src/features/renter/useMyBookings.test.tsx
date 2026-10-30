import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import {
  MY_BOOKINGS_SELECT,
  toMyBooking,
  useSubmitPayment,
} from './useMyBookings'

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

describe('useSubmitPayment', () => {
  it('calls renter_submit_payment with the booking id and trimmed reference', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: 'payment-1', status: 'pending' },
      error: null,
    } as never)
    const { wrapper, invalidate } = makeWrapper()

    const { result } = renderHook(() => useSubmitPayment(), { wrapper })
    result.current.mutate({ bookingId: 'booking-1', reference: '  TRX-1  ' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('renter_submit_payment', {
      p_booking_id: 'booking-1',
      p_reference: 'TRX-1',
    })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-bookings'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-payments'] })
  })

  it('sends a null reference when none is given', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: {},
      error: null,
    } as never)
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useSubmitPayment(), { wrapper })
    result.current.mutate({ bookingId: 'booking-1', reference: '   ' })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('renter_submit_payment', {
      p_booking_id: 'booking-1',
      p_reference: null,
    })
  })

  it('surfaces an RPC error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: new Error('A payment is already pending for this booking'),
    } as never)
    const { wrapper } = makeWrapper()

    const { result } = renderHook(() => useSubmitPayment(), { wrapper })
    result.current.mutate({ bookingId: 'booking-1' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as Error).message).toBe(
      'A payment is already pending for this booking',
    )
  })
})

describe('toMyBooking', () => {
  const baseRow = {
    id: 'booking-1',
    billboard_id: 'billboard-1',
    owner_id: 'owner-1',
    renter_id: 'renter-1',
    start_date: '2026-11-01',
    end_date: '2026-11-07',
    creative_url: null,
    price_quoted: 700,
    status: 'payment_pending' as const,
    payment_id: null,
    rejection_reason: null,
    created_at: '2026-10-01T00:00:00Z',
    updated_at: '2026-10-01T00:00:00Z',
    decision_at: '2026-10-02T00:00:00Z',
    billboards: { title: 'Main St', city: 'Colombo', status: 'active' },
    reviews: [],
    payments: [],
  }

  it('embeds payments through the booking_id FK (bookings ↔ payments is ambiguous)', () => {
    expect(MY_BOOKINGS_SELECT).toContain(
      'payments!payments_booking_id_fkey(id, status, reference, created_at)',
    )
  })

  it('derives the payment state from the embedded payments', () => {
    expect(toMyBooking(baseRow).paymentState).toBe('none')
    expect(
      toMyBooking({
        ...baseRow,
        payments: [
          {
            id: 'p1',
            status: 'pending',
            reference: null,
            created_at: '2026-10-03T00:00:00Z',
          },
        ],
      }).paymentState,
    ).toBe('submitted')
    expect(
      toMyBooking({
        ...baseRow,
        payments: [
          {
            id: 'p1',
            status: 'failed',
            reference: 'x',
            created_at: '2026-10-03T00:00:00Z',
          },
        ],
      }).paymentState,
    ).toBe('rejected')
  })

  it('marks a booking whose billboard is no longer visible as unlisted', () => {
    expect(toMyBooking(baseRow).billboardListed).toBe(true)
    const unlisted = toMyBooking({ ...baseRow, billboards: null })
    expect(unlisted.billboardListed).toBe(false)
    expect(unlisted.billboardTitle).toBe('Unlisted billboard')
  })
})
