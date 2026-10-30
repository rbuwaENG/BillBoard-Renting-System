import type { Notification, UserRole } from '@/types'

// Notification types whose ref_id is a booking id (see trg_booking_notify,
// request_booking_documents, add_proof_of_posting, the reminder cron and the
// payment RPCs).
const BOOKING_REF_TYPES = new Set([
  'booking_requested',
  'booking_approved',
  'booking_rejected',
  'booking_completed',
  'booking_cancelled',
  'booking_expired',
  'payment_confirmed',
  'payment_rejected',
  'payment_submitted',
  'payment_reminder',
  'documents_requested',
  'rental_starting_soon',
  'proof_of_posting',
])

// Where clicking a notification should take the viewer, or null when there's
// nothing more specific to show. Renter booking links open the billboard
// dialog on that booking (BillboardBrowsePage handles `?booking=`).
export function notificationHref(
  notification: Pick<Notification, 'type' | 'refId'>,
  role: UserRole | null,
): string | null {
  const { type, refId } = notification

  if (role === 'admin') return '/admin'

  if (role === 'rentor') {
    if (BOOKING_REF_TYPES.has(type) && refId) {
      return `/rentor?booking=${encodeURIComponent(refId)}`
    }
    return '/rentor'
  }

  if (role === 'renter') {
    if (type === 'new_message') return '/?activity=messages'
    if (BOOKING_REF_TYPES.has(type)) {
      return refId
        ? `/?booking=${encodeURIComponent(refId)}`
        : '/?activity=bookings'
    }
  }

  return null
}
