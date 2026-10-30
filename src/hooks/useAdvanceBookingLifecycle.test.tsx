import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { renderHook, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from './useAuth'
import { useAdvanceBookingLifecycle } from './useAdvanceBookingLifecycle'

const STORAGE_KEY = 'last-lifecycle-advance-at'

function setup() {
  const qc = new QueryClient()
  const invalidate = vi.spyOn(qc, 'invalidateQueries')
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
  renderHook(() => useAdvanceBookingLifecycle(), { wrapper })
  return { invalidate }
}

describe('useAdvanceBookingLifecycle', () => {
  beforeEach(() => {
    localStorage.clear()
    useAuthStore.setState({
      user: {
        uid: 'user-1',
        displayName: 'Test',
        email: 't@example.test',
        role: 'renter',
        status: 'active',
        createdAt: '',
      },
      isLoading: false,
    })
  })
  afterEach(() => {
    useAuthStore.setState({ user: null })
    vi.restoreAllMocks()
  })

  it('throttles and invalidates booking queries only after a successful run', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: null,
    } as never)
    const { invalidate } = setup()

    await waitFor(() =>
      expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull(),
    )
    expect(supabase.rpc).toHaveBeenCalledWith('advance_booking_lifecycle')
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['my-bookings'] })
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['owner-bookings'] })
  })

  it('does not record the throttle timestamp when the RPC fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'permission denied' },
    } as never)
    const { invalidate } = setup()

    await waitFor(() => expect(warn).toHaveBeenCalled())
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull()
    expect(invalidate).not.toHaveBeenCalled()
  })

  it('skips the RPC inside the throttle window', () => {
    localStorage.setItem(STORAGE_KEY, String(Date.now()))
    setup()
    expect(supabase.rpc).not.toHaveBeenCalled()
  })
})
