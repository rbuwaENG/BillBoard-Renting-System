import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as bookingsModule from '@/features/bookings'
import * as myBookingsModule from '@/features/renter/useMyBookings'
import type { MyBooking } from '@/features/renter/useMyBookings'
import { useAuthStore } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { UserRole } from '@/types'
import { BillboardDetailContent } from './BillboardDetailDialog'
import type { BillboardWithDetails } from './useBillboards'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const BILLBOARD: BillboardWithDetails = {
  id: 'billboard-1',
  ownerId: 'owner-1',
  ownerName: 'Oscar Owner',
  title: 'Main Street Board',
  description: 'Big and bright',
  category: 'Digital',
  size: '10x20',
  location: { lat: 6.9, lng: 79.8, address: '1 Main St', city: 'Colombo' },
  pricePerDay: 100,
  salePricePerDay: null,
  adminPriceOverridePerDay: null,
  images: [],
  status: 'active',
  district: null,
  trafficLevel: 'heavy',
  rating: { avg: 0, count: 0 },
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function booking(overrides: Partial<MyBooking>): MyBooking {
  return {
    id: 'booking-1',
    billboardId: 'billboard-1',
    ownerId: 'owner-1',
    renterId: 'renter-1',
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    priceQuoted: 700,
    status: 'rejected',
    createdAt: '2026-10-01T00:00:00Z',
    updatedAt: '2026-10-01T00:00:00Z',
    billboardTitle: 'Main Street Board',
    billboardCity: 'Colombo',
    billboardListed: true,
    review: null,
    payments: [],
    paymentState: 'none',
    ...overrides,
  }
}

function setUser(role: UserRole | null) {
  useAuthStore.setState({
    isLoading: false,
    user: role
      ? {
          uid: role === 'rentor' ? 'other-owner' : 'renter-1',
          displayName: 'Rita',
          email: 'rita@example.test',
          role,
          status: 'active',
          createdAt: '2026-01-01T00:00:00Z',
        }
      : null,
  })
}

function renderContent(bookings: MyBooking[], billboard = BILLBOARD) {
  vi.spyOn(myBookingsModule, 'useMyBookings').mockReturnValue({
    data: bookings,
  } as unknown as ReturnType<typeof myBookingsModule.useMyBookings>)
  vi.spyOn(bookingsModule, 'useBookingEvents').mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof bookingsModule.useBookingEvents>)
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <BillboardDetailContent
          billboard={billboard}
          userCoords={null}
          renderTitle={(t) => <h2>{t}</h2>}
        />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

afterEach(() => setUser(null))

describe('BillboardDetailContent — rebook', () => {
  it('offers "Book again" when the only booking was rejected, and keeps its history', () => {
    setUser('renter')
    renderContent([booking({ status: 'rejected' })])

    expect(
      screen.getByRole('button', { name: /Book again/ }),
    ).toBeInTheDocument()
    expect(screen.queryByText('Status & Timeline')).toBeNull()
    expect(screen.getByText('Your past bookings')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'View history' }))
    expect(screen.getByText('Status & Timeline')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Back to overview/ }),
    ).toBeInTheDocument()
  })

  it.each(['cancelled', 'completed', 'expired'] as const)(
    'does not block a new request after a %s booking',
    (status) => {
      setUser('renter')
      renderContent([booking({ status: status as MyBooking['status'] })])
      expect(
        screen.getByRole('button', { name: /Book again/ }),
      ).toBeInTheDocument()
    },
  )

  it('opens on the timeline while a booking is in progress', () => {
    setUser('renter')
    renderContent([
      booking({ id: 'old', status: 'rejected' }),
      booking({
        id: 'current',
        status: 'payment_pending',
        createdAt: '2026-10-05T00:00:00Z',
      }),
    ])
    expect(screen.getByText('Status & Timeline')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: "I've paid" }),
    ).toBeInTheDocument()
  })

  it('shows "New" instead of 0.0 stars and gates contact details', () => {
    setUser('renter')
    renderContent([])
    expect(screen.getByText(/New · no reviews yet/)).toBeInTheDocument()
    expect(screen.queryByText('0.0')).toBeNull()
    expect(
      screen.getByText(
        'Contact details are shared once your booking is confirmed.',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/owner@example\.com/)).toBeNull()
  })

  it('hides renter-only actions from owners/admins but not from logged-out visitors', () => {
    setUser('rentor')
    const { unmount } = renderContent([])
    expect(screen.queryByRole('button', { name: /Request booking/ })).toBeNull()
    expect(screen.queryByRole('button', { name: /Add to campaign/ })).toBeNull()
    unmount()

    setUser(null)
    renderContent([])
    expect(
      screen.getByRole('button', { name: /Request booking/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Add to campaign/ }),
    ).toBeInTheDocument()
  })

  it('shows a no-longer-listed state for inactive billboards', () => {
    setUser('renter')
    renderContent([], { ...BILLBOARD, status: 'inactive' })
    expect(screen.getByText('Not listed')).toBeInTheDocument()
    expect(screen.getByText(/no longer listed/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Request booking/ })).toBeNull()
  })
})

describe('BillboardDetailContent — gallery & availability', () => {
  it('shows a photo gallery when the billboard has images', () => {
    setUser('renter')
    renderContent([], {
      ...BILLBOARD,
      images: ['https://img.test/a.jpg', 'https://img.test/b.jpg'],
    })
    expect(
      screen.getByRole('region', { name: 'Photos of Main Street Board' }),
    ).toBeInTheDocument()
    expect(screen.getByText('1 / 2')).toBeInTheDocument()
  })

  it('loads booked ranges into the request form calendar', async () => {
    setUser('renter')
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: [{ start_date: '2099-01-05', end_date: '2099-01-06' }],
      error: null,
    } as never)
    renderContent([])
    fireEvent.click(screen.getByRole('button', { name: /Request booking/ }))
    expect(supabase.rpc).toHaveBeenCalledWith('get_billboard_booked_ranges', {
      p_billboard_id: 'billboard-1',
    })
    expect(
      screen.getByRole('grid', { name: /Booking dates/ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Send booking request' }),
    ).toBeDisabled()
    await waitFor(() =>
      expect(screen.queryByText('Loading availability…')).toBeNull(),
    )
  })

  it('still allows booking when availability fails to load', async () => {
    setUser('renter')
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: null,
      error: { message: 'function get_billboard_booked_ranges does not exist' },
    } as never)
    renderContent([])
    fireEvent.click(screen.getByRole('button', { name: /Request booking/ }))
    expect(
      await screen.findByText(/Availability couldn't be loaded/),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('grid', { name: /Booking dates/ }),
    ).toBeInTheDocument()
  })
})
