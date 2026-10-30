import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { createQueryBuilderMock, createSupabaseMock } from '@/test/supabaseMock'
import { supabase } from '@/lib/supabase'
import {
  hasConfirmedPayment,
  useCancelPayout,
  useCreatePayout,
  usePayableBookings,
  useReleasePayout,
} from './useAdminPayouts'

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
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: 'payout-1' },
      error: null,
    } as never)

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

describe('useCancelPayout', () => {
  it('calls admin_cancel_payout for the given payout', async () => {
    const { result } = renderHook(() => useCancelPayout(), { wrapper })
    result.current.mutate('payout-7')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(supabase.rpc).toHaveBeenCalledWith('admin_cancel_payout', {
      p_payout_id: 'payout-7',
    })
  })
})

describe('usePayableBookings', () => {
  it('only includes bookings with an admin-confirmed succeeded payment and no live payout', async () => {
    const booking = (
      id: string,
      payments: { status: string; confirmed_by: string | null }[],
    ) => ({
      id,
      owner_id: 'owner-1',
      price_quoted: 100,
      status: 'confirmed',
      billboards: { title: `Board ${id}` },
      profiles: { display_name: 'Owner One' },
      payments,
    })
    vi.mocked(supabase.from)
      .mockReturnValueOnce(
        createQueryBuilderMock({
          data: [
            booking('confirmed-by-admin', [
              { status: 'succeeded', confirmed_by: 'admin-1' },
            ]),
            booking('self-reported', [
              { status: 'succeeded', confirmed_by: null },
            ]),
            booking('pending-only', [
              { status: 'pending', confirmed_by: null },
            ]),
            booking('already-paid-out', [
              { status: 'succeeded', confirmed_by: 'admin-1' },
            ]),
            booking('cancelled-payout', [
              { status: 'succeeded', confirmed_by: 'admin-1' },
            ]),
          ],
          error: null,
        }) as never,
      )
      .mockReturnValueOnce(
        createQueryBuilderMock({
          data: [
            { booking_id: 'already-paid-out', payouts: { status: 'approved' } },
            {
              booking_id: 'cancelled-payout',
              payouts: { status: 'cancelled' },
            },
          ],
          error: null,
        }) as never,
      )

    const { result } = renderHook(() => usePayableBookings(), { wrapper })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(1)
    expect(result.current.data?.[0].bookings.map((b) => b.id)).toEqual([
      'confirmed-by-admin',
      'cancelled-payout',
    ])
    expect(result.current.data?.[0].total).toBe(200)
  })
})

describe('hasConfirmedPayment', () => {
  it('needs succeeded + confirmed_by', () => {
    expect(
      hasConfirmedPayment({
        payments: [{ status: 'succeeded', confirmed_by: 'a' }],
      }),
    ).toBe(true)
    expect(
      hasConfirmedPayment({
        payments: [{ status: 'succeeded', confirmed_by: null }],
      }),
    ).toBe(false)
    expect(
      hasConfirmedPayment({
        payments: [{ status: 'refunded', confirmed_by: 'a' }],
      }),
    ).toBe(false)
    expect(hasConfirmedPayment({ payments: null })).toBe(false)
  })
})

describe('useReleasePayout', () => {
  it('calls admin_release_payout for the given payout', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: 'payout-1' },
      error: null,
    } as never)

    const { result } = renderHook(() => useReleasePayout(), { wrapper })
    result.current.mutate('payout-1')

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(supabase.rpc).toHaveBeenCalledWith('admin_release_payout', {
      p_payout_id: 'payout-1',
    })
  })
})
