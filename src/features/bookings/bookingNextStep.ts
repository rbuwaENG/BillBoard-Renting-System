import type { PaymentState } from '@/features/payments/paymentState'
import type { Booking } from '@/types'
import type { AnyBookingStatus } from './bookingStatus'
import { getAwaitingDocumentsInfo } from './bookingTimelineLogic'
import type { BookingEvent } from './useBookingEvents'

export type BookingActionKey =
  'upload-documents' | 'complete-payment' | 'cancel-booking' | 'leave-review'

export interface BookingNextStepCta {
  key: BookingActionKey
  label: string
}

export interface BookingNextStepOptions {
  // Derived from the booking's payment rows (see getPaymentState). Omitted →
  // treated as "nothing submitted yet".
  paymentState?: PaymentState
  // Whether the renter already reviewed this booking.
  hasReview?: boolean
}

// The single next action a renter should take, if any — derived purely from
// booking status + the document-request event log + payment submissions,
// never invented client-side.
export function getBookingPrimaryCta(
  booking: Pick<Booking, 'status'>,
  events: BookingEvent[],
  options: BookingNextStepOptions = {},
): BookingNextStepCta | null {
  const status = booking.status as AnyBookingStatus
  const paymentState = options.paymentState ?? 'none'
  const awaiting = getAwaitingDocumentsInfo(events)
  if (
    awaiting.active &&
    (status === 'pending_owner_review' || status === 'payment_pending')
  ) {
    return { key: 'upload-documents', label: 'Upload Documents' }
  }
  if (status === 'payment_pending') {
    if (paymentState === 'none')
      return { key: 'complete-payment', label: "I've paid" }
    if (paymentState === 'rejected')
      return { key: 'complete-payment', label: 'Resubmit payment' }
    return null
  }
  if (status === 'completed' && !options.hasReview) {
    return { key: 'leave-review', label: 'Leave a Review' }
  }
  return null
}

export function canCancelBooking(booking: Pick<Booking, 'status'>): boolean {
  return (
    booking.status === 'pending_owner_review' ||
    booking.status === 'payment_pending'
  )
}
