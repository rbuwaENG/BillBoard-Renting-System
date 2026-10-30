import type { QueryClient } from '@tanstack/react-query'

// Every TanStack Query key in the app, in one place. TanStack matches
// invalidation filters by prefix, so each family also exposes `.all` (just
// its root segment) to invalidate every entry under it at once.

type Id = string | null | undefined

// A key family whose entries are `[root, ...suffix(args)]`, plus `.all`.
function family<
  const R extends string,
  A extends unknown[],
  S extends readonly unknown[],
>(root: R, suffix: (...args: A) => S) {
  const key = (...args: A) => [root, ...suffix(...args)] as const
  return Object.assign(key, { all: [root] as const })
}

export const queryKeys = {
  // --- Bookings and booking-derived data ---
  myBookings: family('my-bookings', (uid: Id) => [uid]),
  ownerBookings: family('owner-bookings', (uid: Id) => [uid]),
  adminBookings: {
    all: ['admin-bookings'] as const,
    paged: ['admin-bookings', 'paged'] as const,
  },
  bookingEvents: family('booking-events', (bookingId: Id) => [bookingId]),
  bookingDocuments: family('booking-documents', (bookingId: Id) => [bookingId]),
  bookingContact: family('booking-contact', (bookingId: Id) => [bookingId]),
  proofOfPostingUrls: family(
    'proof-of-posting-urls',
    (bookingId: Id, paths: string[]) => [bookingId, paths],
  ),
  bookedRanges: family('booked-ranges', (billboardId: string) => [billboardId]),
  myCampaigns: family('my-campaigns', (uid: Id) => [uid]),
  notifications: family('notifications', (uid: Id) => [uid]),

  // --- Payments and payouts ---
  myPayments: family('my-payments', (uid: Id) => [uid]),
  adminPayments: {
    all: ['admin-payments'] as const,
    succeededTotal: ['admin-payments', 'succeeded-total'] as const,
  },
  adminPendingPayments: {
    all: ['admin-pending-payments'] as const,
    submissions: ['admin-pending-payments', 'submissions'] as const,
    awaiting: ['admin-pending-payments', 'awaiting'] as const,
  },
  adminPayableBookings: ['admin-payable-bookings'] as const,
  adminPayouts: ['admin-payouts'] as const,
  myPayouts: {
    all: ['my-payouts'] as const,
    summary: (uid: Id) => ['my-payouts', uid] as const,
    ledger: (uid: Id) => ['my-payouts', uid, 'ledger'] as const,
  },

  // --- Billboards ---
  billboards: ['billboards'] as const,
  billboardsNear: family(
    'billboards-near',
    (
      lat: number | null | undefined,
      lng: number | null | undefined,
      radiusKm: number,
    ) => [lat, lng, radiusKm],
  ),
  billboard: family('billboard', (id: Id) => [id]),
  rentorBillboards: family('rentor-billboards', (uid: Id) => [uid]),
  adminBillboards: {
    all: ['admin-billboards'] as const,
    paged: <F>(filter: F) => ['admin-billboards', 'paged', filter] as const,
    flaggedCount: ['admin-billboards', 'flagged-count'] as const,
  },
  pricingTiers: {
    all: ['pricing-tiers'] as const,
    billboard: (billboardId: Id) => ['pricing-tiers', billboardId] as const,
    cart: (billboardIds: string[]) =>
      ['pricing-tiers', 'cart', billboardIds] as const,
  },
  districtProfile: family('district-profile', (district: Id) => [district]),

  // --- Chat ---
  chatThread: family('chat-thread', (billboardId: Id, uid: Id) => [
    billboardId,
    uid,
  ]),
  chatMessages: family('chat-messages', (threadId: Id) => [threadId]),
  myChatThreads: family('my-chat-threads', (uid: Id) => [uid]),
  ownerChatThreads: family('owner-chat-threads', (uid: Id) => [uid]),

  // --- Admin and platform settings ---
  adminUsers: ['admin-users'] as const,
  adminAuditLog: family('admin-audit-log', (filters: unknown) => [filters]),
  platformSettings: ['platform-settings'] as const,
  paymentGatewaySettings: ['payment-gateway-settings'] as const,
  categories: ['categories'] as const,
  sizes: ['sizes'] as const,
}

// Everything that can change when a booking is created, moves status, is
// paid for, cancelled or gets a new event: renter/owner/admin booking lists,
// the booking's event timeline, payments, payable bookings, booked date
// ranges, campaigns and notifications. Pass `bookingId` to narrow the event
// timeline to that booking; the lists are always refreshed in full.
export function invalidateBooking(qc: QueryClient, bookingId?: string) {
  const keys = [
    queryKeys.myBookings.all,
    queryKeys.ownerBookings.all,
    queryKeys.adminBookings.all,
    bookingId
      ? queryKeys.bookingEvents(bookingId)
      : queryKeys.bookingEvents.all,
    queryKeys.myPayments.all,
    queryKeys.adminPayments.all,
    queryKeys.adminPendingPayments.all,
    queryKeys.adminPayableBookings,
    queryKeys.bookedRanges.all,
    queryKeys.myCampaigns.all,
    queryKeys.notifications.all,
  ]
  return Promise.all(
    keys.map((queryKey) => qc.invalidateQueries({ queryKey })),
  ).then(() => undefined)
}
