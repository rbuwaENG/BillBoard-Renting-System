import { describe, expect, it } from 'vitest'
import { notificationHref } from './notificationLinks'

describe('notificationHref', () => {
  it('links renter booking notifications to that booking', () => {
    expect(
      notificationHref({ type: 'booking_approved', refId: 'bk-1' }, 'renter'),
    ).toBe('/?booking=bk-1')
    expect(
      notificationHref(
        { type: 'documents_requested', refId: 'bk-2' },
        'renter',
      ),
    ).toBe('/?booking=bk-2')
    expect(
      notificationHref({ type: 'proof_of_posting', refId: 'bk-3' }, 'renter'),
    ).toBe('/?booking=bk-3')
  })

  it('links renter chat notifications to the messages tab', () => {
    expect(
      notificationHref({ type: 'new_message', refId: 'thread-1' }, 'renter'),
    ).toBe('/?activity=messages')
  })

  it('sends owners and admins to their dashboards', () => {
    expect(
      notificationHref({ type: 'booking_requested', refId: 'bk-1' }, 'rentor'),
    ).toBe('/rentor?booking=bk-1')
    expect(
      notificationHref({ type: 'payout_released', refId: 'po-1' }, 'rentor'),
    ).toBe('/rentor')
    expect(
      notificationHref({ type: 'payment_submitted', refId: 'bk-1' }, 'admin'),
    ).toBe('/admin')
  })

  it('is not a link when nothing specific applies', () => {
    expect(
      notificationHref({ type: 'review_received', refId: 'rv-1' }, 'renter'),
    ).toBeNull()
    expect(
      notificationHref({ type: 'booking_approved', refId: 'bk-1' }, null),
    ).toBeNull()
  })
})
