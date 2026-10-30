import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { RentorDashboardPage } from './RentorDashboardPage'

vi.mock('@/hooks/useAdvanceBookingLifecycle', () => ({
  useAdvanceBookingLifecycle: () => {},
}))
vi.mock('./useRentorBookings', () => ({
  useOwnerBookings: () => ({ data: [] }),
}))
vi.mock('./BookingInboxPanel', () => ({
  BookingInboxPanel: ({
    focusBookingId,
  }: {
    focusBookingId?: string | null
  }) => <p>Inbox focus: {focusBookingId ?? 'none'}</p>,
}))
vi.mock('./MyBillboardsPanel', () => ({
  MyBillboardsPanel: () => <p>Billboards panel</p>,
}))
vi.mock('./MessagesPanel', () => ({
  MessagesPanel: () => <p>Messages panel</p>,
}))
vi.mock('./EarningsPanel', () => ({
  EarningsPanel: () => <p>Earnings panel</p>,
}))

function LocationProbe() {
  const location = useLocation()
  return <output data-testid="location">{location.search}</output>
}

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <RentorDashboardPage />
      <LocationProbe />
    </MemoryRouter>,
  )
}

describe('RentorDashboardPage — deep links', () => {
  it('opens the Bookings tab focused on ?booking=', () => {
    renderAt('/rentor?booking=booking-9')
    expect(screen.getByText('Inbox focus: booking-9')).toBeInTheDocument()
  })

  it('defaults to My billboards and honours ?tab=', () => {
    renderAt('/rentor')
    expect(screen.getByText('Billboards panel')).toBeInTheDocument()

    renderAt('/rentor?tab=earnings')
    expect(screen.getByText('Earnings panel')).toBeInTheDocument()
  })

  it('ignores an unknown ?tab= value', () => {
    renderAt('/rentor?tab=nope')
    expect(screen.getByText('Billboards panel')).toBeInTheDocument()
  })

  it('switching tabs updates the URL and drops the focused booking', () => {
    renderAt('/rentor?booking=booking-9')
    fireEvent.click(screen.getByRole('button', { name: 'Messages' }))
    expect(screen.getByText('Messages panel')).toBeInTheDocument()
    expect(screen.getByTestId('location')).toHaveTextContent('?tab=messages')
    expect(screen.getByTestId('location')).not.toHaveTextContent('booking')
  })
})
