import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Booking } from '@/types'

export interface RentorBookingRequest extends Booking {
  renterName: string
  billboardTitle: string
  rejectionReason?: string
}

interface RentorBookingState {
  requests: RentorBookingRequest[]
  approve: (id: string) => void
  reject: (id: string, reason: string) => void
}

// Booking inbox scoped to the preview Rentor session (PLAN.md section 1:
// "review & approve/reject booking requests made against *their*
// billboards"). Local preview store — Phase 6 replaces approve/reject with
// the `respondToBooking` Cloud Function callable.
const SEED: RentorBookingRequest[] = [
  {
    id: 'req-1',
    billboardId: 'rentor-billboard-1',
    billboardTitle: 'Riverside Overpass Hoarding',
    ownerId: 'mock-rentor',
    renterId: 'renter-alice',
    renterName: 'Alice Nguyen',
    startDate: '2026-09-28',
    endDate: '2026-10-05',
    priceQuoted: 1050,
    status: 'pending_owner_review',
    createdAt: '2026-09-18T00:00:00.000Z',
    updatedAt: '2026-09-18T00:00:00.000Z',
  },
  {
    id: 'req-2',
    billboardId: 'rentor-billboard-2',
    billboardTitle: 'Galle Face Digital Screen',
    ownerId: 'mock-rentor',
    renterId: 'renter-marcus',
    renterName: 'Marcus Webb',
    startDate: '2026-09-20',
    endDate: '2026-09-27',
    priceQuoted: 1680,
    status: 'pending_owner_review',
    createdAt: '2026-09-16T00:00:00.000Z',
    updatedAt: '2026-09-16T00:00:00.000Z',
  },
  {
    id: 'req-3',
    billboardId: 'rentor-billboard-1',
    billboardTitle: 'Riverside Overpass Hoarding',
    ownerId: 'mock-rentor',
    renterId: 'renter-nadia',
    renterName: 'Nadia Iqbal',
    startDate: '2026-08-15',
    endDate: '2026-08-22',
    priceQuoted: 1050,
    status: 'confirmed',
    createdAt: '2026-08-05T00:00:00.000Z',
    updatedAt: '2026-08-06T00:00:00.000Z',
    decisionAt: '2026-08-06T00:00:00.000Z',
  },
  {
    id: 'req-4',
    billboardId: 'rentor-billboard-2',
    billboardTitle: 'Galle Face Digital Screen',
    ownerId: 'mock-rentor',
    renterId: 'renter-chen',
    renterName: 'Wei Chen',
    startDate: '2026-07-01',
    endDate: '2026-07-08',
    priceQuoted: 1680,
    status: 'completed',
    createdAt: '2026-06-20T00:00:00.000Z',
    updatedAt: '2026-07-08T00:00:00.000Z',
    decisionAt: '2026-06-21T00:00:00.000Z',
  },
  {
    id: 'req-5',
    billboardId: 'rentor-billboard-3',
    billboardTitle: 'Fort Station Transit Panel',
    ownerId: 'mock-rentor',
    renterId: 'renter-omar',
    renterName: 'Omar Farouk',
    startDate: '2026-08-01',
    endDate: '2026-08-08',
    priceQuoted: 560,
    status: 'rejected',
    createdAt: '2026-07-25T00:00:00.000Z',
    updatedAt: '2026-07-26T00:00:00.000Z',
    decisionAt: '2026-07-26T00:00:00.000Z',
    rejectionReason: 'Dates overlap with an existing confirmed booking.',
  },
]

export const useRentorBookingStore = create<RentorBookingState>()(
  persist(
    (set) => ({
      requests: SEED,
      approve: (id) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'payment_pending',
                  decisionAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : r,
          ),
        })),
      reject: (id, reason) =>
        set((s) => ({
          requests: s.requests.map((r) =>
            r.id === id
              ? {
                  ...r,
                  status: 'rejected',
                  rejectionReason: reason,
                  decisionAt: new Date().toISOString(),
                  updatedAt: new Date().toISOString(),
                }
              : r,
          ),
        })),
    }),
    { name: 'billboard-rentor-bookings-preview' },
  ),
)
