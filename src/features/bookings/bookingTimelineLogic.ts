import type { PaymentState } from '@/features/payments/paymentState'
import type { Booking } from '@/types'
import type { AnyBookingStatus } from './bookingStatus'
import type { BookingEvent } from './useBookingEvents'

export const EXPIRED_REQUEST_COPY = "Request expired — the owner didn't respond in time"
export const EXPIRED_PAYMENT_COPY = "Booking expired — payment wasn't completed in time"

export type TimelineStageState = 'completed' | 'current' | 'upcoming' | 'blocked'
export type TimelineActor = 'customer' | 'owner' | 'platform'

export interface TimelineStage {
  key: string
  label: string
  state: TimelineStageState
  timestamp?: string
  description?: string
  actor?: TimelineActor
  // Set on a completed "Posted" stage: BookingTimeline shows that booking's
  // proof-of-posting photos under the steps.
  proofBookingId?: string
}

export interface TimelineContext {
  viewerRole: 'renter' | 'owner'
  ownerName: string
  renterName: string
  // Renter-side payment submission state (renter_submit_payment); omitted →
  // nothing submitted yet.
  paymentState?: PaymentState
}

export interface AwaitingDocumentsInfo {
  active: boolean
  note: string | null
  requestedAt?: string
}

function findEventTimestamp(events: BookingEvent[], toStatus: string): string | undefined {
  return events.find((e) => e.eventType === 'status_change' && e.toStatus === toStatus)?.createdAt
}

// A document request is "resolved" once the renter uploads something after
// it was asked for — purely derived from the event log, no extra status.
export function getAwaitingDocumentsInfo(events: BookingEvent[]): AwaitingDocumentsInfo {
  let lastRequest: BookingEvent | null = null
  let lastUpload: BookingEvent | null = null
  for (const e of events) {
    if (e.eventType === 'document_requested') lastRequest = e
    if (e.eventType === 'document_uploaded') lastUpload = e
  }
  if (!lastRequest) return { active: false, note: null }
  const resolved = !!lastUpload && lastUpload.createdAt > lastRequest.createdAt
  return { active: !resolved, note: lastRequest.message, requestedAt: lastRequest.createdAt }
}

// When the owner first shared proof of posting (add_proof_of_posting logs a
// 'proof_posted' event per photo), or undefined if there is none yet.
export function getProofPostedAt(events: BookingEvent[]): string | undefined {
  let first: string | undefined
  for (const e of events) {
    if (e.eventType === 'proof_posted' && (!first || e.createdAt < first)) first = e.createdAt
  }
  return first
}

export function computeBookingTimeline(
  booking: Booking,
  events: BookingEvent[],
  ctx: TimelineContext,
): TimelineStage[] {
  const stages: TimelineStage[] = []
  const awaiting = getAwaitingDocumentsInfo(events)
  const isRenter = ctx.viewerRole === 'renter'
  const status = booking.status as AnyBookingStatus
  const paymentState = ctx.paymentState ?? 'none'
  const proofPostedAt = getProofPostedAt(events)

  stages.push({
    key: 'submitted',
    label: 'Booking Request Submitted',
    state: 'completed',
    timestamp: booking.createdAt,
    description: isRenter
      ? `Your request has been sent to ${ctx.ownerName}.`
      : `${ctx.renterName} submitted a booking request.`,
    actor: 'platform',
  })

  if (booking.status === 'rejected') {
    stages.push({ key: 'review', label: 'Owner Reviewing', state: 'completed', timestamp: booking.createdAt })
    stages.push({
      key: 'declined',
      label: 'Request Declined',
      state: 'blocked',
      timestamp: booking.decisionAt,
      description: isRenter
        ? booking.rejectionReason
          ? `The owner declined your request: ${booking.rejectionReason}`
          : 'The owner declined your request.'
        : booking.rejectionReason
          ? `You declined this request: ${booking.rejectionReason}`
          : 'You declined this request.',
      actor: 'platform',
    })
    return stages
  }

  if (booking.status === 'cancelled') {
    const wasApproved = events.some((e) => e.toStatus === 'payment_pending')
    stages.push({ key: 'review', label: 'Owner Reviewing', state: 'completed', timestamp: booking.createdAt })
    if (wasApproved) {
      stages.push({
        key: 'payment',
        label: 'Payment Pending',
        state: 'completed',
        timestamp: findEventTimestamp(events, 'payment_pending'),
      })
    }
    stages.push({
      key: 'cancelled',
      label: 'Booking Cancelled',
      state: 'blocked',
      timestamp: findEventTimestamp(events, 'cancelled'),
      description: 'This booking was cancelled before the rental began.',
      actor: 'platform',
    })
    return stages
  }

  if (status === 'expired') {
    const wasApproved = events.some((e) => e.toStatus === 'payment_pending')
    stages.push({
      key: 'review',
      label: 'Owner Reviewing',
      state: wasApproved ? 'completed' : 'blocked',
      timestamp: booking.createdAt,
    })
    if (wasApproved) {
      stages.push({
        key: 'payment',
        label: 'Payment Pending',
        state: 'completed',
        timestamp: findEventTimestamp(events, 'payment_pending') ?? booking.decisionAt,
      })
    }
    stages.push({
      key: 'expired',
      label: 'Request Expired',
      state: 'blocked',
      timestamp: findEventTimestamp(events, 'expired') ?? booking.updatedAt,
      description: wasApproved
        ? isRenter
          ? `${EXPIRED_PAYMENT_COPY}. You can request these dates again if they're still free.`
          : `${EXPIRED_PAYMENT_COPY}.`
        : isRenter
          ? `${EXPIRED_REQUEST_COPY}. You can send a new request.`
          : "This request expired because it wasn't answered in time.",
      actor: 'platform',
    })
    return stages
  }

  // --- Owner Reviewing (or an interstitial "awaiting your information") ---
  if (booking.status === 'pending_owner_review') {
    if (awaiting.active) {
      stages.push({
        key: 'awaiting-info',
        label: 'Awaiting Your Information',
        state: 'current',
        timestamp: awaiting.requestedAt,
        description: isRenter
          ? awaiting.note
            ? `Please upload what the owner asked for: ${awaiting.note}`
            : 'Please upload the requested documents to continue.'
          : `Waiting on ${ctx.renterName} to upload the requested documents.`,
        actor: 'customer',
      })
    } else {
      stages.push({
        key: 'review',
        label: 'Owner Reviewing',
        state: 'current',
        description: isRenter
          ? "The owner is reviewing your booking. We'll notify you when there's an update."
          : 'Review this request and respond below.',
        actor: 'owner',
      })
    }
  } else {
    stages.push({ key: 'review', label: 'Owner Reviewing', state: 'completed', timestamp: booking.createdAt })
  }

  // --- Payment Pending (or the same interstitial, if requested post-approval) ---
  if (booking.status === 'payment_pending') {
    if (awaiting.active) {
      stages.push({
        key: 'awaiting-info',
        label: 'Awaiting Your Information',
        state: 'current',
        timestamp: awaiting.requestedAt,
        description: isRenter
          ? awaiting.note
            ? `Please upload what the owner asked for: ${awaiting.note}`
            : 'Please upload the requested documents to continue.'
          : `Waiting on ${ctx.renterName} to upload the requested documents.`,
        actor: 'customer',
      })
    } else {
      stages.push({
        key: 'payment',
        label: 'Payment Pending',
        state: 'current',
        timestamp: booking.decisionAt,
        description: isRenter
          ? paymentState === 'submitted'
            ? "Payment submitted — awaiting admin confirmation. We'll notify you once it's confirmed."
            : paymentState === 'rejected'
              ? 'Payment rejected — please check your transfer and resubmit.'
              : 'Your booking is approved. Pay the quoted amount by bank transfer, then tap “I’ve paid”.'
          : paymentState === 'submitted'
            ? `${ctx.renterName} submitted a payment — awaiting admin confirmation.`
            : `Waiting on ${ctx.renterName} to complete payment.`,
        actor: paymentState === 'submitted' ? 'platform' : 'customer',
      })
    }
  } else if (booking.status === 'confirmed' || booking.status === 'active' || booking.status === 'completed') {
    stages.push({
      key: 'payment',
      label: 'Payment Pending',
      state: 'completed',
      timestamp: booking.decisionAt,
    })
  } else {
    stages.push({ key: 'payment', label: 'Payment Pending', state: 'upcoming' })
  }

  // --- Booking Confirmed ---
  if (booking.status === 'confirmed') {
    stages.push({
      key: 'confirmed',
      label: 'Booking Confirmed',
      state: 'current',
      timestamp: findEventTimestamp(events, 'confirmed'),
      description: isRenter
        ? "You're all set! Your billboard rental is confirmed. You can review your booking details below."
        : proofPostedAt
          ? 'Payment received — the booking is confirmed.'
          : 'Payment received — the booking is confirmed. Once the creative is up, upload proof of posting.',
      actor: 'platform',
    })
  } else if (booking.status === 'active' || booking.status === 'completed') {
    stages.push({
      key: 'confirmed',
      label: 'Booking Confirmed',
      state: 'completed',
      timestamp: findEventTimestamp(events, 'confirmed'),
    })
  } else {
    stages.push({ key: 'confirmed', label: 'Booking Confirmed', state: 'upcoming' })
  }

  // --- Posted (proof of posting, contract 7) ---
  // Complete once the owner has shared at least one photo. Owners can post
  // proof while the booking is confirmed or active, so until then the step
  // stays upcoming; completed bookings from before proof existed skip it.
  if (proofPostedAt) {
    stages.push({
      key: 'posted',
      label: 'Posted',
      state: 'completed',
      timestamp: proofPostedAt,
      proofBookingId: booking.id,
    })
  } else if (booking.status !== 'completed') {
    stages.push({ key: 'posted', label: 'Posted', state: 'upcoming' })
  }

  // --- Campaign Active ---
  if (booking.status === 'active') {
    const proofHint = proofPostedAt
      ? ''
      : isRenter
        ? " The owner hasn't shared proof of posting yet — we'll notify you when they do."
        : ' Upload proof of posting so the renter can see their ad is up.'
    stages.push({
      key: 'active',
      label: 'Campaign Active',
      state: 'current',
      timestamp: findEventTimestamp(events, 'active'),
      description:
        (isRenter
          ? 'Your rental period has started.'
          : 'This rental is currently running.') + proofHint,
      actor: proofPostedAt || isRenter ? 'platform' : 'owner',
    })
  } else if (booking.status === 'completed') {
    stages.push({
      key: 'active',
      label: 'Campaign Active',
      state: 'completed',
      timestamp: findEventTimestamp(events, 'active'),
    })
  } else {
    stages.push({ key: 'active', label: 'Campaign Active', state: 'upcoming' })
  }

  // --- Rental Completed ---
  if (booking.status === 'completed') {
    stages.push({
      key: 'completed',
      label: 'Rental Completed',
      state: 'current',
      timestamp: findEventTimestamp(events, 'completed'),
      description: isRenter
        ? 'Your rental has been completed. Thank you for using our platform.'
        : 'This rental is complete.',
      actor: 'platform',
    })
  } else {
    stages.push({ key: 'completed', label: 'Rental Completed', state: 'upcoming' })
  }

  return stages
}
