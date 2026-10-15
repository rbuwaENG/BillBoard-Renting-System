import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import type { RentorBookingRequest } from './useRentorBookings'
import { BookingInboxPanel } from './BookingInboxPanel'
import * as useRentorBookingsModule from './useRentorBookings'
import * as useCurrencySettingModule from '@/features/admin/useCurrencySetting'

// useRentorBookings.ts (via useAuth) imports the real Supabase client, which
// opens a background auth listener — mock it out so this test doesn't spin
// up a real GoTrueClient per run.
vi.mock('@/lib/supabase', () => ({ supabase: createSupabaseMock() }))

const REQUEST: RentorBookingRequest = {
  id: 'booking-1',
  billboardId: 'billboard-1',
  ownerId: 'owner-1',
  renterId: 'renter-1',
  startDate: '2026-11-01',
  endDate: '2026-11-07',
  priceQuoted: 500,
  status: 'pending_owner_review',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  billboardTitle: 'Downtown Billboard',
  renterName: 'Jane Renter',
}

function setup(mutate: ReturnType<typeof vi.fn>) {
  vi.spyOn(useRentorBookingsModule, 'useOwnerBookings').mockReturnValue({
    data: [REQUEST],
  } as ReturnType<typeof useRentorBookingsModule.useOwnerBookings>)
  vi.spyOn(useRentorBookingsModule, 'useRespondToBooking').mockReturnValue({
    mutate,
  } as unknown as ReturnType<typeof useRentorBookingsModule.useRespondToBooking>)
  vi.spyOn(useCurrencySettingModule, 'useFormatPrice').mockReturnValue(
    (amount: number) => `$${amount}`,
  )
}

describe('BookingInboxPanel', () => {
  it('approves a pending booking request', () => {
    const mutate = vi.fn()
    setup(mutate)

    render(<BookingInboxPanel />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    expect(mutate).toHaveBeenCalledWith({ bookingId: 'booking-1', approve: true })
  })

  it('rejects a pending booking request with a reason', () => {
    const mutate = vi.fn()
    setup(mutate)

    render(<BookingInboxPanel />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    fireEvent.change(screen.getByPlaceholderText('Reason for rejecting'), {
      target: { value: 'Dates unavailable' },
    })
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }))

    expect(mutate).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      approve: false,
      reason: 'Dates unavailable',
    })
  })
})
