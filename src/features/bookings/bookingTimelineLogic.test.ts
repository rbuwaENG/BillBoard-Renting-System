import { describe, expect, it } from 'vitest'
import type { Booking } from '@/types'
import { computeBookingTimeline, getAwaitingDocumentsInfo } from './bookingTimelineLogic'
import type { BookingEvent } from './useBookingEvents'

const CTX = { viewerRole: 'renter' as const, ownerName: 'Owner Oscar', renterName: 'Renter Rita' }

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: 'booking-1',
    billboardId: 'billboard-1',
    ownerId: 'owner-1',
    renterId: 'renter-1',
    startDate: '2026-11-01',
    endDate: '2026-11-07',
    priceQuoted: 500,
    status: 'pending_owner_review',
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

function makeEvent(overrides: Partial<BookingEvent>): BookingEvent {
  return {
    id: 'event-1',
    bookingId: 'booking-1',
    eventType: 'status_change',
    actorId: null,
    fromStatus: null,
    toStatus: null,
    message: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    ...overrides,
  }
}

function stageByKey(stages: ReturnType<typeof computeBookingTimeline>, key: string) {
  return stages.find((s) => s.key === key)
}

describe('computeBookingTimeline', () => {
  it('marks "Owner Reviewing" as current while pending review', () => {
    const stages = computeBookingTimeline(makeBooking(), [], CTX)
    expect(stageByKey(stages, 'submitted')?.state).toBe('completed')
    expect(stageByKey(stages, 'review')?.state).toBe('current')
    expect(stageByKey(stages, 'payment')?.state).toBe('upcoming')
  })

  it('ends in a terminal "Request Declined" stage when rejected, with no further stages', () => {
    const booking = makeBooking({
      status: 'rejected',
      decisionAt: '2026-10-02T00:00:00.000Z',
      rejectionReason: 'Dates unavailable',
    })
    const stages = computeBookingTimeline(booking, [], CTX)
    expect(stages.at(-1)?.key).toBe('declined')
    expect(stages.at(-1)?.state).toBe('blocked')
    expect(stages.at(-1)?.description).toContain('Dates unavailable')
    expect(stageByKey(stages, 'payment')).toBeUndefined()
  })

  it('shows "Payment Pending" as current once approved', () => {
    const booking = makeBooking({ status: 'payment_pending', decisionAt: '2026-10-02T00:00:00.000Z' })
    const stages = computeBookingTimeline(booking, [], CTX)
    expect(stageByKey(stages, 'review')?.state).toBe('completed')
    expect(stageByKey(stages, 'payment')?.state).toBe('current')
    expect(stageByKey(stages, 'confirmed')?.state).toBe('upcoming')
  })

  it('shows "Booking Confirmed" as current once paid', () => {
    const booking = makeBooking({ status: 'confirmed', decisionAt: '2026-10-02T00:00:00.000Z' })
    const events = [makeEvent({ toStatus: 'confirmed', createdAt: '2026-10-03T00:00:00.000Z' })]
    const stages = computeBookingTimeline(booking, events, CTX)
    expect(stageByKey(stages, 'payment')?.state).toBe('completed')
    expect(stageByKey(stages, 'confirmed')?.state).toBe('current')
    expect(stageByKey(stages, 'confirmed')?.timestamp).toBe('2026-10-03T00:00:00.000Z')
    expect(stageByKey(stages, 'active')?.state).toBe('upcoming')
  })

  it('shows "Campaign Active" as current once the rental starts', () => {
    const booking = makeBooking({ status: 'active' })
    const stages = computeBookingTimeline(booking, [], CTX)
    expect(stageByKey(stages, 'confirmed')?.state).toBe('completed')
    expect(stageByKey(stages, 'active')?.state).toBe('current')
    expect(stageByKey(stages, 'completed')?.state).toBe('upcoming')
  })

  it('marks every prior stage completed once the rental is completed', () => {
    const booking = makeBooking({ status: 'completed' })
    const stages = computeBookingTimeline(booking, [], CTX)
    expect(stageByKey(stages, 'review')?.state).toBe('completed')
    expect(stageByKey(stages, 'payment')?.state).toBe('completed')
    expect(stageByKey(stages, 'confirmed')?.state).toBe('completed')
    expect(stageByKey(stages, 'active')?.state).toBe('completed')
    expect(stageByKey(stages, 'completed')?.state).toBe('current')
  })

  it('ends in "Booking Cancelled" and includes a completed Payment Pending stage if it was approved first', () => {
    const booking = makeBooking({ status: 'cancelled' })
    const events = [
      makeEvent({ toStatus: 'payment_pending', createdAt: '2026-10-02T00:00:00.000Z' }),
      makeEvent({ toStatus: 'cancelled', createdAt: '2026-10-03T00:00:00.000Z' }),
    ]
    const stages = computeBookingTimeline(booking, events, CTX)
    expect(stageByKey(stages, 'payment')?.state).toBe('completed')
    expect(stages.at(-1)?.key).toBe('cancelled')
    expect(stages.at(-1)?.timestamp).toBe('2026-10-03T00:00:00.000Z')
  })

  it('omits the completed Payment Pending stage when cancelled before approval', () => {
    const booking = makeBooking({ status: 'cancelled' })
    const events = [makeEvent({ toStatus: 'cancelled', createdAt: '2026-10-02T00:00:00.000Z' })]
    const stages = computeBookingTimeline(booking, events, CTX)
    expect(stageByKey(stages, 'payment')).toBeUndefined()
    expect(stages.at(-1)?.key).toBe('cancelled')
  })

  it('shows "Awaiting Your Information" in place of "Owner Reviewing" while a document request is unresolved', () => {
    const booking = makeBooking({ status: 'pending_owner_review' })
    const events = [
      makeEvent({
        eventType: 'document_requested',
        message: 'Please send your brand logo',
        createdAt: '2026-10-02T00:00:00.000Z',
      }),
    ]
    const stages = computeBookingTimeline(booking, events, CTX)
    expect(stageByKey(stages, 'awaiting-info')?.state).toBe('current')
    expect(stageByKey(stages, 'awaiting-info')?.description).toContain('brand logo')
    expect(stageByKey(stages, 'review')).toBeUndefined()
  })

  it('clears the "awaiting information" interstitial once a document is uploaded after the request', () => {
    const booking = makeBooking({ status: 'pending_owner_review' })
    const events = [
      makeEvent({
        eventType: 'document_requested',
        message: 'Please send your brand logo',
        createdAt: '2026-10-02T00:00:00.000Z',
      }),
      makeEvent({
        eventType: 'document_uploaded',
        message: 'logo.png',
        createdAt: '2026-10-03T00:00:00.000Z',
      }),
    ]
    const stages = computeBookingTimeline(booking, events, CTX)
    expect(stageByKey(stages, 'awaiting-info')).toBeUndefined()
    expect(stageByKey(stages, 'review')?.state).toBe('current')
  })
})

describe('getAwaitingDocumentsInfo', () => {
  it('is inactive when no document has ever been requested', () => {
    expect(getAwaitingDocumentsInfo([]).active).toBe(false)
  })

  it('stays active if the latest upload predates the latest request', () => {
    const events = [
      makeEvent({ eventType: 'document_uploaded', createdAt: '2026-10-01T00:00:00.000Z' }),
      makeEvent({ eventType: 'document_requested', createdAt: '2026-10-02T00:00:00.000Z' }),
    ]
    expect(getAwaitingDocumentsInfo(events).active).toBe(true)
  })
})

describe('computeBookingTimeline — Posted step (proof of posting)', () => {
  const proof = makeEvent({
    id: 'event-proof',
    eventType: 'proof_posted',
    message: 'front.jpg',
    createdAt: '2026-11-01T09:00:00.000Z',
  })

  it('is upcoming while a confirmed booking has no proof yet', () => {
    const stages = computeBookingTimeline(makeBooking({ status: 'confirmed' }), [], CTX)
    const keys = stages.map((s) => s.key)
    expect(keys.indexOf('posted')).toBe(keys.indexOf('confirmed') + 1)
    expect(stageByKey(stages, 'posted')?.state).toBe('upcoming')
    expect(stageByKey(stages, 'posted')?.proofBookingId).toBeUndefined()
  })

  it('is complete once proof exists, and carries the booking id for the photos', () => {
    const later = makeEvent({ ...proof, id: 'event-proof-2', createdAt: '2026-11-02T09:00:00.000Z' })
    const stages = computeBookingTimeline(makeBooking({ status: 'confirmed' }), [later, proof], CTX)
    expect(stageByKey(stages, 'posted')).toMatchObject({
      state: 'completed',
      timestamp: proof.createdAt,
      proofBookingId: 'booking-1',
    })
    expect(stageByKey(stages, 'confirmed')?.state).toBe('current')
  })

  it('asks the owner for proof while an active booking has none', () => {
    const booking = makeBooking({ status: 'active' })
    const owner = computeBookingTimeline(booking, [], { ...CTX, viewerRole: 'owner' })
    expect(stageByKey(owner, 'posted')?.state).toBe('upcoming')
    expect(stageByKey(owner, 'active')).toMatchObject({ state: 'current', actor: 'owner' })
    expect(stageByKey(owner, 'active')?.description).toMatch(/upload proof of posting/i)

    const renter = computeBookingTimeline(booking, [], CTX)
    expect(stageByKey(renter, 'active')?.description).toMatch(/hasn't shared proof of posting/)

    const withProof = computeBookingTimeline(booking, [proof], { ...CTX, viewerRole: 'owner' })
    expect(stageByKey(withProof, 'active')?.actor).toBe('platform')
    expect(stageByKey(withProof, 'active')?.description).not.toMatch(/proof/i)
  })

  it('is skipped for completed bookings that never had proof', () => {
    expect(
      stageByKey(computeBookingTimeline(makeBooking({ status: 'completed' }), [], CTX), 'posted'),
    ).toBeUndefined()
    expect(
      stageByKey(computeBookingTimeline(makeBooking({ status: 'completed' }), [proof], CTX), 'posted')
        ?.state,
    ).toBe('completed')
  })
})
