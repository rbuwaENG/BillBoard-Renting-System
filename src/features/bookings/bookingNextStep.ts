import type { Booking } from '@/types'
import { getAwaitingDocumentsInfo } from './bookingTimelineLogic'
import type { BookingEvent } from './useBookingEvents'

export type BookingActionKey =
  | 'upload-documents'
  | 'complete-payment'
  | 'cancel-booking'
  | 'leave-review'

export interface BookingNextStepCta {
  key: BookingActionKey
  label: string
}

// The single next action a renter should take, if any — derived purely from
// booking status + the document-request event log, never invented client-side.
export function getBookingPrimaryCta(
  booking: Booking,
  events: BookingEvent[],
): BookingNextStepCta | null {
  const awaiting = getAwaitingDocumentsInfo(events)
  if (
    awaiting.active &&
    (booking.status === 'pending_owner_review' || booking.status === 'payment_pending')
  ) {
    return { key: 'upload-documents', label: 'Upload Documents' }
  }
  if (booking.status === 'payment_pending') {
    return { key: 'complete-payment', label: 'Complete Payment' }
  }
  if (booking.status === 'completed') {
    return { key: 'leave-review', label: 'Leave a Review' }
  }
  return null
}

export function canCancelBooking(booking: Booking): boolean {
  return booking.status === 'pending_owner_review' || booking.status === 'payment_pending'
}
