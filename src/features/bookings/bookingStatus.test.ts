import { describe, expect, it } from 'vitest'
import type { Booking } from '@/types'
import {
  canUploadDocuments,
  splitBillboardBookings,
  type AnyBookingStatus,
} from './bookingStatus'

type Row = Pick<Booking, 'id' | 'billboardId' | 'createdAt'> & {
  status: AnyBookingStatus
}

function row(
  id: string,
  status: AnyBookingStatus,
  createdAt: string,
  billboardId = 'bb-1',
): Row {
  return { id, status, createdAt, billboardId }
}

describe('splitBillboardBookings (rebook)', () => {
  it('has no current booking when every past booking is finished', () => {
    const { current, past } = splitBillboardBookings(
      [
        row('a', 'rejected', '2026-01-01'),
        row('b', 'cancelled', '2026-02-01'),
        row('c', 'completed', '2026-03-01'),
        row('d', 'expired', '2026-04-01'),
      ],
      'bb-1',
    )
    expect(current).toBeNull()
    expect(past.map((b) => b.id)).toEqual(['d', 'c', 'b', 'a'])
  })

  it('picks the in-progress booking even when an older finished one exists', () => {
    const { current, past } = splitBillboardBookings(
      [
        row('old', 'rejected', '2026-01-01'),
        row('new', 'payment_pending', '2026-02-01'),
      ],
      'bb-1',
    )
    expect(current?.id).toBe('new')
    expect(past.map((b) => b.id)).toEqual(['old'])
  })

  it.each<AnyBookingStatus>([
    'pending_owner_review',
    'payment_pending',
    'confirmed',
    'active',
  ])('treats %s as in progress', (status) => {
    expect(
      splitBillboardBookings([row('x', status, '2026-01-01')], 'bb-1').current
        ?.id,
    ).toBe('x')
  })

  it('prefers the most recent in-progress booking and ignores other billboards', () => {
    const { current, past } = splitBillboardBookings(
      [
        row('other', 'active', '2026-05-01', 'bb-2'),
        row('first', 'confirmed', '2026-01-01'),
        row('second', 'pending_owner_review', '2026-03-01'),
      ],
      'bb-1',
    )
    expect(current?.id).toBe('second')
    expect(past.map((b) => b.id)).toEqual(['first'])
  })
})

describe('canUploadDocuments', () => {
  it.each<[AnyBookingStatus, boolean]>([
    ['pending_owner_review', true],
    ['payment_pending', true],
    ['confirmed', true],
    ['active', true],
    ['completed', false],
    ['cancelled', false],
    ['expired', false],
    ['rejected', false],
  ])('%s → %s', (status, expected) => {
    expect(canUploadDocuments(status)).toBe(expected)
  })
})
