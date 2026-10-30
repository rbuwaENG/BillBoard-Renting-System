import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createSupabaseMock } from '@/test/supabaseMock'
import type { RentorBookingRequest } from './useRentorBookings'
import { BookingInboxPanel } from './BookingInboxPanel'
import * as useRentorBookingsModule from './useRentorBookings'
import * as useCurrencySettingModule from '@/features/admin/useCurrencySetting'
import * as bookingsModule from '@/features/bookings'

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

type RespondMock = Partial<
  ReturnType<typeof useRentorBookingsModule.useRespondToBooking>
>

function setup(
  mutate: ReturnType<typeof vi.fn>,
  {
    requests = [REQUEST],
    respond = {},
    query = {},
  }: {
    requests?: RentorBookingRequest[]
    respond?: RespondMock
    query?: Record<string, unknown>
  } = {},
) {
  vi.spyOn(useRentorBookingsModule, 'useOwnerBookings').mockReturnValue({
    data: requests,
    isLoading: false,
    isError: false,
    ...query,
  } as unknown as ReturnType<typeof useRentorBookingsModule.useOwnerBookings>)
  vi.spyOn(useRentorBookingsModule, 'useRespondToBooking').mockReturnValue({
    mutate,
    isPending: false,
    isError: false,
    ...respond,
  } as unknown as ReturnType<
    typeof useRentorBookingsModule.useRespondToBooking
  >)
  vi.spyOn(useCurrencySettingModule, 'useFormatPrice').mockReturnValue(
    (amount: number) => `$${amount}`,
  )
  // BookingDetailsDisclosure (the collapsible timeline/documents section) calls
  // these unconditionally, independent of its open/closed state.
  vi.spyOn(bookingsModule, 'useBookingEvents').mockReturnValue({
    data: [],
  } as unknown as ReturnType<typeof bookingsModule.useBookingEvents>)
  vi.spyOn(bookingsModule, 'useRequestBookingDocuments').mockReturnValue({
    mutate: vi.fn(),
    isPending: false,
    isError: false,
  } as unknown as ReturnType<typeof bookingsModule.useRequestBookingDocuments>)
}

describe('BookingInboxPanel', () => {
  it('approves a pending booking request', () => {
    const mutate = vi.fn()
    setup(mutate)

    render(<BookingInboxPanel />)
    fireEvent.click(screen.getByRole('button', { name: /approve/i }))

    expect(mutate).toHaveBeenCalledWith({
      bookingId: 'booking-1',
      approve: true,
    })
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

    expect(mutate).toHaveBeenCalledWith(
      {
        bookingId: 'booking-1',
        approve: false,
        reason: 'Dates unavailable',
      },
      expect.objectContaining({ onSuccess: expect.any(Function) }),
    )
  })

  it('requires a reason before rejecting and offers quick reasons', () => {
    const mutate = vi.fn()
    setup(mutate)

    render(<BookingInboxPanel />)
    fireEvent.click(screen.getByRole('button', { name: /reject/i }))
    const confirm = screen.getByRole('button', { name: /confirm reject/i })
    expect(confirm).toBeDisabled()
    fireEvent.click(confirm)
    expect(mutate).not.toHaveBeenCalled()

    fireEvent.click(
      screen.getByRole('button', { name: 'Billboard under maintenance' }),
    )
    expect(screen.getByPlaceholderText('Reason for rejecting')).toHaveValue(
      'Billboard under maintenance',
    )
    expect(confirm).toBeEnabled()
  })

  it('disables approve/reject while a response is in flight', () => {
    const mutate = vi.fn()
    setup(mutate, {
      respond: {
        isPending: true,
        variables: { bookingId: 'booking-1', approve: true },
      },
    })

    render(<BookingInboxPanel />)
    const approve = screen.getByRole('button', { name: /approving/i })
    expect(approve).toBeDisabled()
    expect(screen.getByRole('button', { name: /reject/i })).toBeDisabled()
    fireEvent.click(approve)
    expect(mutate).not.toHaveBeenCalled()
  })

  it('shows the server error on the request that failed', () => {
    setup(vi.fn(), {
      respond: {
        isError: true,
        error: new Error('Cannot respond after the booking start date'),
        variables: { bookingId: 'booking-1', approve: true },
      },
    })

    render(<BookingInboxPanel />)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Cannot respond after the booking start date',
    )
  })

  it('shows a respond-by hint on pending requests', () => {
    setup(vi.fn())
    render(<BookingInboxPanel />)
    expect(screen.getByText(/respond by/i)).toBeInTheDocument()
  })

  it('pins pending requests on top and labels expired ones', () => {
    const older = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
    setup(vi.fn(), {
      requests: [
        {
          ...REQUEST,
          id: 'done',
          billboardTitle: 'Completed Board',
          status: 'completed',
          createdAt: new Date().toISOString(),
        },
        {
          ...REQUEST,
          id: 'pending',
          billboardTitle: 'Pending Board',
          createdAt: older,
        },
        {
          ...REQUEST,
          id: 'expired',
          billboardTitle: 'Expired Board',
          status: 'expired' as RentorBookingRequest['status'],
          createdAt: older,
        },
      ],
    })

    render(<BookingInboxPanel />)
    const titles = screen.getAllByText(/Board$/).map((el) => el.textContent)
    expect(titles).toEqual([
      'Pending Board',
      'Completed Board',
      'Expired Board',
    ])
    // The badge (a span), not the "Expired" option of the status filter.
    expect(
      screen.getByText('Expired', { selector: 'span' }),
    ).toBeInTheDocument()
  })

  it('filters by status', () => {
    setup(vi.fn(), {
      requests: [
        { ...REQUEST, id: 'a', billboardTitle: 'Pending Board' },
        {
          ...REQUEST,
          id: 'b',
          billboardTitle: 'Completed Board',
          status: 'completed',
        },
      ],
    })

    render(<BookingInboxPanel />)
    fireEvent.change(screen.getByLabelText('Status'), {
      target: { value: 'completed' },
    })
    expect(screen.queryByText('Pending Board')).not.toBeInTheDocument()
    expect(screen.getByText('Completed Board')).toBeInTheDocument()
  })

  it('shows a loading state instead of the empty message', () => {
    setup(vi.fn(), {
      requests: [],
      query: { data: undefined, isLoading: true },
    })
    render(<BookingInboxPanel />)
    expect(screen.getByRole('status')).toHaveTextContent(/loading/i)
    expect(
      screen.queryByText(/no booking requests yet/i),
    ).not.toBeInTheDocument()
  })

  it('offers proof-of-posting upload only for confirmed/active bookings', () => {
    setup(vi.fn(), {
      requests: [
        { ...REQUEST, id: 'a', billboardTitle: 'Pending Board' },
        { ...REQUEST, id: 'b', billboardTitle: 'Live Board', status: 'active' },
      ],
    })
    const queryClient = new QueryClient()
    render(
      <QueryClientProvider client={queryClient}>
        <BookingInboxPanel />
      </QueryClientProvider>,
    )
    const buttons = screen.getAllByRole('button', {
      name: /upload proof of posting/i,
    })
    expect(buttons).toHaveLength(1)
    fireEvent.click(buttons[0])
    expect(
      screen.getByRole('button', { name: /close proof of posting/i }),
    ).toHaveAttribute('aria-expanded', 'true')
  })

  it('focuses the booking from a notification link: clears filters, highlights and expands it', () => {
    const other: RentorBookingRequest = {
      ...REQUEST,
      id: 'booking-2',
      status: 'rejected',
      billboardTitle: 'Harbour Board',
    }
    setup(vi.fn(), { requests: [REQUEST, other] })
    const queryClient = new QueryClient()
    const view = (focus: string | null) => (
      <QueryClientProvider client={queryClient}>
        <BookingInboxPanel focusBookingId={focus} />
      </QueryClientProvider>
    )
    const { rerender } = render(view(null))

    // Hide booking-2 behind a filter, then follow a link to it.
    fireEvent.change(screen.getByDisplayValue('All statuses'), {
      target: { value: 'pending_owner_review' },
    })
    expect(screen.queryByText('Harbour Board')).toBeNull()

    rerender(view('booking-2'))
    const card = screen.getByText('Harbour Board').closest('[aria-current]')
    expect(card).toHaveAttribute('aria-current', 'true')
    expect(card).toHaveAttribute('id', 'inbox-booking-booking-2')
    expect(
      within(card as HTMLElement).getByRole('button', {
        name: /hide timeline & documents/i,
      }),
    ).toBeInTheDocument()
    // The other booking stays collapsed and unhighlighted.
    expect(
      screen.getAllByRole('button', { name: /view timeline & documents/i }),
    ).toHaveLength(1)
  })
})
