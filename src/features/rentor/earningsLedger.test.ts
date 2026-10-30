import { describe, expect, it } from 'vitest'
import { buildEarningsLedger, type LedgerBookingInput } from './earningsLedger'

function booking(
  id: string,
  status: LedgerBookingInput['status'],
  priceQuoted: number,
  startDate = '2026-11-01',
): LedgerBookingInput {
  return {
    id,
    billboardTitle: `Board ${id}`,
    startDate,
    endDate: '2026-11-07',
    priceQuoted,
    status,
    createdAt: '2026-10-01T00:00:00Z',
  }
}

describe('buildEarningsLedger', () => {
  it('totals confirmed, paid bookings that are not in a payout yet', () => {
    const { rows, earnedUnscheduledTotal } = buildEarningsLedger(
      [
        booking('a', 'confirmed', 100),
        booking('b', 'completed', 200),
        booking('c', 'active', 300),
        booking('d', 'payment_pending', 400),
        booking('e', 'completed', 500),
      ],
      [
        {
          bookingId: 'a',
          status: 'succeeded',
          confirmed: true,
          createdAt: '1',
        },
        {
          bookingId: 'b',
          status: 'succeeded',
          confirmed: true,
          createdAt: '1',
        },
        // Succeeded but never confirmed by an admin: not payable.
        {
          bookingId: 'c',
          status: 'succeeded',
          confirmed: false,
          createdAt: '1',
        },
        { bookingId: 'd', status: 'pending', confirmed: false, createdAt: '1' },
        {
          bookingId: 'e',
          status: 'succeeded',
          confirmed: true,
          createdAt: '1',
        },
      ],
      [
        {
          id: 'payout-1',
          status: 'approved',
          scheduledReleaseDate: '2026-12-01',
          bookingIds: ['b'],
        },
      ],
    )

    // a + e (b is already in a payout, c unconfirmed, d unpaid)
    expect(earnedUnscheduledTotal).toBe(600)
    const byId = new Map(rows.map((r) => [r.bookingId, r]))
    expect(byId.get('a')?.earnedUnscheduled).toBe(true)
    expect(byId.get('b')?.payout?.id).toBe('payout-1')
    expect(byId.get('b')?.earnedUnscheduled).toBe(false)
    expect(byId.get('c')?.earnedUnscheduled).toBe(false)
    expect(byId.get('d')?.paymentStatus).toBe('pending')
  })

  it('reports the confirmed success over a newer failed attempt, and "none" when unpaid', () => {
    const { rows } = buildEarningsLedger(
      [booking('a', 'confirmed', 100), booking('b', 'payment_pending', 50)],
      [
        {
          bookingId: 'a',
          status: 'failed',
          confirmed: false,
          createdAt: '2026-10-02',
        },
        {
          bookingId: 'a',
          status: 'succeeded',
          confirmed: true,
          createdAt: '2026-10-01',
        },
      ],
      [],
    )
    const byId = new Map(rows.map((r) => [r.bookingId, r]))
    expect(byId.get('a')?.paymentStatus).toBe('succeeded')
    expect(byId.get('b')?.paymentStatus).toBe('none')
  })
})
