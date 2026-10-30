import type { Booking, BookingStatus } from '@/types'

// 'expired' is set server-side by advance_booking_lifecycle (stale requests /
// unpaid approvals). Widened here so every status map handles it even before
// the shared BookingStatus type picks it up.
export type AnyBookingStatus = BookingStatus | 'expired'

// Bookings that still "occupy" the renter's relationship with a billboard —
// while one of these exists the detail dialog opens on its timeline instead
// of offering a new request.
export const IN_PROGRESS_STATUSES: ReadonlySet<AnyBookingStatus> =
  new Set<AnyBookingStatus>([
    'pending_owner_review',
    'approved',
    'payment_pending',
    'confirmed',
    'active',
  ])

// Once a booking reaches one of these, nothing more can be attached to it.
export const DOCUMENTS_LOCKED_STATUSES: ReadonlySet<AnyBookingStatus> =
  new Set<AnyBookingStatus>(['completed', 'cancelled', 'expired', 'rejected'])

// Counterparty contact details unlock from get_booking_contact once paid.
export const CONTACT_UNLOCKED_STATUSES: ReadonlySet<AnyBookingStatus> =
  new Set<AnyBookingStatus>(['confirmed', 'active', 'completed'])

// The owner may share proof of posting while the booking is paid and not yet
// over (add_proof_of_posting, 0033).
export const PROOF_UPLOAD_STATUSES: ReadonlySet<AnyBookingStatus> =
  new Set<AnyBookingStatus>(['confirmed', 'active'])

export function isInProgress(status: AnyBookingStatus): boolean {
  return IN_PROGRESS_STATUSES.has(status)
}

export function canUploadDocuments(status: AnyBookingStatus): boolean {
  return !DOCUMENTS_LOCKED_STATUSES.has(status)
}

export const STATUS_LABEL: Record<AnyBookingStatus, string> = {
  pending_owner_review: 'Pending review',
  approved: 'Approved',
  rejected: 'Rejected',
  payment_pending: 'Payment pending',
  confirmed: 'Confirmed',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
  expired: 'Expired',
}

type BookingLike = Pick<Booking, 'id' | 'billboardId' | 'createdAt'> & {
  status: AnyBookingStatus
}

interface BillboardBookings<T extends BookingLike> {
  current: T | null
  past: T[]
}

// Splits a renter's bookings for one billboard into the in-progress one (the
// most recently created, if several) and the finished/declined history, so a
// past rejected/cancelled/completed booking never blocks booking again.
export function splitBillboardBookings<T extends BookingLike>(
  bookings: T[],
  billboardId: string,
): BillboardBookings<T> {
  const forBoard = bookings
    .filter((b) => b.billboardId === billboardId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
  const current = forBoard.find((b) => isInProgress(b.status)) ?? null
  return { current, past: forBoard.filter((b) => b !== current) }
}
