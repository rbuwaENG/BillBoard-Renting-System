import { QueryClient } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { invalidateBooking, queryKeys } from './queryKeys'

describe('queryKeys', () => {
  it('builds the same key arrays the hooks used before centralising', () => {
    expect(queryKeys.myBookings('u1')).toEqual(['my-bookings', 'u1'])
    expect(queryKeys.myBookings.all).toEqual(['my-bookings'])
    expect(queryKeys.bookedRanges('b1')).toEqual(['booked-ranges', 'b1'])
    expect(queryKeys.myPayouts.ledger('u1')).toEqual([
      'my-payouts',
      'u1',
      'ledger',
    ])
    expect(queryKeys.adminBillboards.paged('flagged')).toEqual([
      'admin-billboards',
      'paged',
      'flagged',
    ])
  })
})

describe('invalidateBooking', () => {
  it('invalidates every booking-derived query family', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    await invalidateBooking(qc)
    const keys = invalidate.mock.calls.map(([filters]) => filters?.queryKey)
    expect(keys).toEqual(
      expect.arrayContaining([
        ['my-bookings'],
        ['owner-bookings'],
        ['admin-bookings'],
        ['booking-events'],
        ['my-payments'],
        ['admin-payments'],
        ['admin-pending-payments'],
        ['admin-payable-bookings'],
        ['booked-ranges'],
        ['my-campaigns'],
        ['notifications'],
      ]),
    )
  })

  it('narrows the event timeline to one booking when given its id', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    await invalidateBooking(qc, 'bk1')
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: ['booking-events', 'bk1'],
    })
    expect(invalidate).not.toHaveBeenCalledWith({
      queryKey: ['booking-events'],
    })
  })

  it('matches per-user entries through their root prefix', async () => {
    const qc = new QueryClient()
    qc.setQueryData(queryKeys.myBookings('u1'), [])
    await invalidateBooking(qc)
    expect(qc.getQueryState(queryKeys.myBookings('u1'))?.isInvalidated).toBe(
      true,
    )
  })
})
