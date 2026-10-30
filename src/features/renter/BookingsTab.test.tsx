import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import * as bookingsModule from '@/features/bookings'
import { supabase } from '@/lib/supabase'
import { BookingsTab } from './BookingsTab'
import * as myBookingsModule from './useMyBookings'
import type { MyBooking } from './useMyBookings'
import * as myPaymentsModule from './useMyPayments'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

function makeBooking(overrides: Partial<MyBooking> = {}): MyBooking {
  return {
    id: 'booking-1',
    billboardId: 'billboard-1',
    ownerId: 'owner-1',
    renterId: 'renter-1',
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    priceQuoted: 700,
    status: 'payment_pending',
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

function setup(
  bookings: MyBooking[],
  {
    loading = false,
    events = [] as bookingsModule.BookingEvent[],
    paymentsError = false,
  } = {},
) {
  vi.spyOn(myBookingsModule, 'useMyBookings').mockReturnValue({
    data: loading ? undefined : bookings,
    isLoading: loading,
    isError: false,
    error: null,
    refetch: vi.fn(),
  } as unknown as ReturnType<typeof myBookingsModule.useMyBookings>)
  vi.spyOn(myPaymentsModule, 'useMyPayments').mockReturnValue({
    data: paymentsError
      ? undefined
      : [
          { id: 'p1', status: 'succeeded', amount: 300 },
          { id: 'p2', status: 'pending', amount: 700 },
        ],
    isLoading: false,
    isError: paymentsError,
  } as unknown as ReturnType<typeof myPaymentsModule.useMyPayments>)
  vi.spyOn(bookingsModule, 'useBookingEvents').mockReturnValue({
    data: events,
  } as unknown as ReturnType<typeof bookingsModule.useBookingEvents>)

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(
    <QueryClientProvider client={queryClient}>
      <BookingsTab onSelectBillboard={vi.fn()} />
    </QueryClientProvider>,
  )
}

describe("BookingsTab — I've paid", () => {
  it('shows a loading state instead of "No bookings yet" while loading', () => {
    setup([], { loading: true })
    expect(screen.getByText('Loading your bookings…')).toBeInTheDocument()
    expect(screen.queryByText(/No bookings yet/)).toBeNull()
  })

  it('counts only succeeded payments as total paid', () => {
    setup([makeBooking()])
    // 300 succeeded; the 700 pending submission must not be counted
    expect(screen.getByText(/300/)).toBeInTheDocument()
    expect(screen.queryByText(/1,000|1000/)).toBeNull()
  })

  it('shows a dash instead of 0 for total paid when payments fail to load', () => {
    setup([makeBooking()], { paymentsError: true })
    const card = screen.getByText('Total paid').parentElement!
    expect(card).toHaveTextContent('—')
    expect(card).not.toHaveTextContent(/0/)
  })

  it('submits a payment through the confirm dialog', async () => {
    vi.mocked(supabase.rpc).mockResolvedValueOnce({
      data: { id: 'pay-1' },
      error: null,
    } as never)
    setup([makeBooking()])

    fireEvent.click(screen.getByRole('button', { name: "I've paid" }))
    expect(screen.getByText('Confirm your payment')).toBeInTheDocument()

    fireEvent.change(screen.getByLabelText(/Bank transfer reference/), {
      target: { value: 'TRX-42' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Submit payment' }))

    await waitFor(() =>
      expect(supabase.rpc).toHaveBeenCalledWith('renter_submit_payment', {
        p_booking_id: 'booking-1',
        p_reference: 'TRX-42',
      }),
    )
  })

  it('shows the awaiting-confirmation state instead of a pay button', () => {
    setup([makeBooking({ paymentState: 'submitted' })])
    expect(screen.queryByRole('button', { name: "I've paid" })).toBeNull()
    expect(
      screen.getByText('Payment submitted — awaiting admin confirmation'),
    ).toBeInTheDocument()
  })

  it('asks to resubmit after a rejection', () => {
    setup([makeBooking({ paymentState: 'rejected' })])
    expect(
      screen.getByRole('button', { name: 'Resubmit payment' }),
    ).toBeInTheDocument()
    expect(
      screen.getByText('Payment rejected — please resubmit'),
    ).toBeInTheDocument()
  })

  it('hides the payment button until requested documents are uploaded', () => {
    setup([makeBooking()], {
      events: [
        {
          id: 'e1',
          bookingId: 'booking-1',
          eventType: 'document_requested',
          actorId: 'owner-1',
          fromStatus: null,
          toStatus: null,
          message: 'logo',
          createdAt: '2026-10-02T00:00:00Z',
        },
      ],
    })
    expect(screen.queryByRole('button', { name: "I've paid" })).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Upload documents' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/upload them before paying/)).toBeInTheDocument()
  })
})
