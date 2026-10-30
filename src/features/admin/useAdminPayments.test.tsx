import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import {
  useAwaitingPaymentBookings,
  useConfirmPayment,
  usePendingSubmissions,
  useRejectPayment,
  useSucceededPaymentsTotal,
} from './useAdminPayments'

vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

function wrapper({ children }: { children: ReactNode }) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  )
}

// The shared mock builder has no `.range()` — add it (chainable) here.
function pagedBuilder(data: unknown) {
  const builder = createQueryBuilderMock({ data, error: null })
  builder.range = vi.fn(() => builder)
  return builder
}

describe('useConfirmPayment', () => {
  it('calls admin_confirm_payment with the entered amount and reference', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: 'payment-1' },
      error: null,
    } as never)

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

  it('surfaces the server amount-mismatch error', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { code: 'P0001', message: 'Amount does not match quoted price' },
    } as never)

    const { result } = renderHook(() => useConfirmPayment(), { wrapper })
    result.current.mutate({
      bookingId: 'booking-1',
      amount: 200,
      reference: 'x',
    })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect((result.current.error as { message: string }).message).toBe(
      'Amount does not match quoted price',
    )
  })
})

describe('useRejectPayment', () => {
  it('calls admin_reject_payment with the payment id and trimmed reason', async () => {
    const { result } = renderHook(() => useRejectPayment(), { wrapper })
    result.current.mutate({
      paymentId: 'payment-9',
      reason: '  No transfer received ',
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_reject_payment', {
      p_payment_id: 'payment-9',
      p_reason: 'No transfer received',
    })
  })

  it('refuses an empty reason without calling the server', async () => {
    const { result } = renderHook(() => useRejectPayment(), { wrapper })
    result.current.mutate({ paymentId: 'payment-9', reason: '  ' })

    await waitFor(() => expect(result.current.isError).toBe(true))
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})

describe('usePendingSubmissions', () => {
  it('lists pending payments joined to booking dates, billboard and renter, paged with range()', async () => {
    const builder = pagedBuilder([
      {
        id: 'pay-1',
        booking_id: 'bk-1',
        amount: 500,
        currency: 'LKR',
        status: 'pending',
        reference: 'TRX-1',
        created_at: '2026-10-29T10:00:00Z',
        confirmed_at: null,
        bookings: {
          id: 'bk-1',
          start_date: '2026-11-01',
          end_date: '2026-11-05',
          price_quoted: 500,
          status: 'payment_pending',
          billboards: { title: 'Galle Road LED' },
        },
        profiles: { display_name: 'Nimal' },
      },
    ])
    vi.mocked(supabase.from).mockReturnValueOnce(builder as never)

    const { result } = renderHook(() => usePendingSubmissions(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.from).toHaveBeenCalledWith('payments')
    expect(builder.eq).toHaveBeenCalledWith('status', 'pending')
    expect(builder.range).toHaveBeenCalledWith(0, 49)
    expect(result.current.items).toEqual([
      expect.objectContaining({
        id: 'pay-1',
        bookingId: 'bk-1',
        billboardTitle: 'Galle Road LED',
        renterName: 'Nimal',
        priceQuoted: 500,
        startDate: '2026-11-01',
        endDate: '2026-11-05',
        reference: 'TRX-1',
      }),
    ])
    expect(result.current.hasNextPage).toBe(false)
  })
})

describe('useAwaitingPaymentBookings', () => {
  it('only lists payment_pending bookings with no open (pending/succeeded) payment', async () => {
    const base = {
      price_quoted: 300,
      start_date: '2026-11-01',
      end_date: '2026-11-02',
      created_at: '2026-10-20T00:00:00Z',
      decision_at: '2026-10-21T00:00:00Z',
      billboards: { title: 'Board' },
      profiles: { display_name: 'Renter' },
    }
    const builder = pagedBuilder([
      { ...base, id: 'no-payment', payments: [] },
      {
        ...base,
        id: 'rejected-before',
        payments: [{ id: 'p1', status: 'failed' }],
      },
      { ...base, id: 'submitted', payments: [{ id: 'p2', status: 'pending' }] },
    ])
    vi.mocked(supabase.from).mockReturnValueOnce(builder as never)

    const { result } = renderHook(() => useAwaitingPaymentBookings(), {
      wrapper,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builder.eq).toHaveBeenCalledWith('status', 'payment_pending')
    expect(result.current.items.map((b) => b.id)).toEqual([
      'no-payment',
      'rejected-before',
    ])
    expect(result.current.items[0].approvedAt).toBe('2026-10-21T00:00:00Z')
  })
})

describe('useSucceededPaymentsTotal', () => {
  it('sums succeeded payment amounts', async () => {
    const builder = createQueryBuilderMock({
      data: [{ amount: 100 }, { amount: '250.5' }],
      error: null,
    })
    vi.mocked(supabase.from).mockReturnValueOnce(builder as never)

    const { result } = renderHook(() => useSucceededPaymentsTotal(), {
      wrapper,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(builder.eq).toHaveBeenCalledWith('status', 'succeeded')
    expect(result.current.data).toEqual({ total: 350.5, count: 2 })
  })
})
