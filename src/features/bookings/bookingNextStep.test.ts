import { describe, expect, it } from 'vitest'
import {
  getPaymentState,
  type BookingPaymentSummary,
} from '@/features/payments/paymentState'
import type { Booking } from '@/types'
import { canCancelBooking, getBookingPrimaryCta } from './bookingNextStep'
import { computeBookingTimeline } from './bookingTimelineLogic'
import type { BookingEvent } from './useBookingEvents'

const CTX = {
  viewerRole: 'renter' as const,
  ownerName: 'Owner Oscar',
  renterName: 'Renter Rita',
}

function booking(
  status: Booking['status'] | 'expired',
  overrides: Partial<Booking> = {},
): Booking {
  return {
    id: 'booking-1',
    billboardId: 'billboard-1',
    ownerId: 'owner-1',
    renterId: 'renter-1',
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    priceQuoted: 500,
    status: status as Booking['status'],
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-05T00:00:00.000Z',
    ...overrides,
  }
}

function payment(
  status: BookingPaymentSummary['status'],
  createdAt: string,
): BookingPaymentSummary {
  return { id: `p-${createdAt}`, status, reference: null, createdAt }
}

const docRequest: BookingEvent = {
  id: 'e1',
  bookingId: 'booking-1',
  eventType: 'document_requested',
  actorId: 'owner-1',
  fromStatus: null,
  toStatus: null,
  message: 'brand logo',
  createdAt: '2026-10-03T00:00:00.000Z',
}

describe('getPaymentState', () => {
  it('is none without payments', () => {
    expect(getPaymentState([])).toBe('none')
    expect(getPaymentState(undefined)).toBe('none')
  })
  it('is submitted while a pending payment exists', () => {
    expect(getPaymentState([payment('pending', '2026-10-03')])).toBe(
      'submitted',
    )
  })
  it('is rejected when the latest submission failed', () => {
    expect(getPaymentState([payment('failed', '2026-10-03')])).toBe('rejected')
  })
  it('is submitted again after a rejected payment is resubmitted', () => {
    expect(
      getPaymentState([
        payment('failed', '2026-10-03'),
        payment('pending', '2026-10-04'),
      ]),
    ).toBe('submitted')
  })
  it('is paid once an admin confirmed a payment', () => {
    expect(
      getPaymentState([
        payment('failed', '2026-10-03'),
        payment('succeeded', '2026-10-04'),
      ]),
    ).toBe('paid')
  })
})

describe("getBookingPrimaryCta — I've paid flow", () => {
  it("offers I've paid when nothing was submitted", () => {
    expect(
      getBookingPrimaryCta(booking('payment_pending'), [], {
        paymentState: 'none',
      }),
    ).toEqual({
      key: 'complete-payment',
      label: "I've paid",
    })
  })

  it('offers no payment action while a submission awaits admin confirmation', () => {
    expect(
      getBookingPrimaryCta(booking('payment_pending'), [], {
        paymentState: 'submitted',
      }),
    ).toBeNull()
  })

  it('offers to resubmit after a rejection', () => {
    expect(
      getBookingPrimaryCta(booking('payment_pending'), [], {
        paymentState: 'rejected',
      }),
    ).toEqual({
      key: 'complete-payment',
      label: 'Resubmit payment',
    })
  })

  it('keeps the upload-documents gate ahead of payment', () => {
    expect(
      getBookingPrimaryCta(booking('payment_pending'), [docRequest])?.key,
    ).toBe('upload-documents')
  })

  it('offers a review only for completed, unreviewed bookings', () => {
    expect(getBookingPrimaryCta(booking('completed'), [])?.key).toBe(
      'leave-review',
    )
    expect(
      getBookingPrimaryCta(booking('completed'), [], { hasReview: true }),
    ).toBeNull()
    expect(getBookingPrimaryCta(booking('cancelled'), [])).toBeNull()
    expect(getBookingPrimaryCta(booking('expired'), [])).toBeNull()
  })

  it('cannot cancel expired bookings', () => {
    expect(canCancelBooking(booking('expired'))).toBe(false)
    expect(canCancelBooking(booking('payment_pending'))).toBe(true)
  })
})

describe('computeBookingTimeline — payment + expired', () => {
  it('tells the renter a submitted payment awaits admin confirmation', () => {
    const stages = computeBookingTimeline(booking('payment_pending'), [], {
      ...CTX,
      paymentState: 'submitted',
    })
    const payment = stages.find((s) => s.key === 'payment')
    expect(payment?.state).toBe('current')
    expect(payment?.description).toContain('awaiting admin confirmation')
  })

  it('tells the renter to resubmit after a rejection', () => {
    const stages = computeBookingTimeline(booking('payment_pending'), [], {
      ...CTX,
      paymentState: 'rejected',
    })
    expect(stages.find((s) => s.key === 'payment')?.description).toContain(
      'resubmit',
    )
  })

  it('ends an unanswered request with an expired stage', () => {
    const stages = computeBookingTimeline(booking('expired'), [], CTX)
    const last = stages.at(-1)
    expect(last?.key).toBe('expired')
    expect(last?.state).toBe('blocked')
    expect(last?.description).toContain("the owner didn't respond in time")
  })

  it('explains an expiry after approval as an unpaid booking', () => {
    const approved: BookingEvent = {
      ...docRequest,
      id: 'e2',
      eventType: 'status_change',
      fromStatus: 'pending_owner_review',
      toStatus: 'payment_pending',
    }
    const stages = computeBookingTimeline(booking('expired'), [approved], CTX)
    expect(stages.find((s) => s.key === 'payment')?.state).toBe('completed')
    expect(stages.at(-1)?.description).toContain(
      "payment wasn't completed in time",
    )
  })
})
