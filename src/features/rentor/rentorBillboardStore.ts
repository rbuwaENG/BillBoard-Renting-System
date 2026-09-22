import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { Billboard, BillboardStatus } from '@/types'

export interface RentorBillboard
  extends Omit<Billboard, 'categoryId' | 'sizeId'> {
  category: string
  size: string
}

export interface RentorBillboardInput {
  title: string
  description: string
  category: string
  size: string
  address: string
  city: string
  lat: number
  lng: number
  pricePerDay: number
  images: string[]
}

interface RentorBillboardState {
  billboards: RentorBillboard[]
  addBillboard: (input: RentorBillboardInput) => void
  updateBillboard: (id: string, input: RentorBillboardInput) => void
  setStatus: (id: string, status: BillboardStatus) => void
  deleteBillboard: (id: string) => void
}

// Matches useAuthStore's `mockLogin` uid pattern (`mock-${role}`) so the
// signed-in preview Rentor session actually owns these listings.
const OWNER_ID = 'mock-rentor'

const SEED_TIME = '2026-09-01T00:00:00.000Z'

const SEED: RentorBillboard[] = [
  {
    id: 'rentor-billboard-1',
    ownerId: OWNER_ID,
    title: 'Riverside Overpass Hoarding',
    description: 'Southbound commuter traffic, unobstructed sightline.',
    category: 'Highway',
    size: '20 × 50 ft',
    location: {
      lat: 6.9271,
      lng: 79.8612,
      address: 'Baseline Road',
      city: 'Colombo',
    },
    pricePerDay: 150,
    images: [],
    status: 'active',
    rating: { avg: 4.5, count: 12 },
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: 'rentor-billboard-2',
    ownerId: OWNER_ID,
    title: 'Galle Face Digital Screen',
    description:
      'Full-colour LED facing the promenade, evening peak slots.',
    category: 'Digital',
    size: 'LED 10 × 20 ft',
    location: {
      lat: 6.9224,
      lng: 79.8442,
      address: 'Galle Face Green',
      city: 'Colombo',
    },
    pricePerDay: 240,
    images: [],
    status: 'active',
    rating: { avg: 4.7, count: 21 },
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
  {
    id: 'rentor-billboard-3',
    ownerId: OWNER_ID,
    title: 'Fort Station Transit Panel',
    description: 'High-footfall panel at the main railway station exit.',
    category: 'Transit',
    size: '6 × 10 ft',
    location: {
      lat: 6.9339,
      lng: 79.85,
      address: 'Fort Railway Station',
      city: 'Colombo',
    },
    pricePerDay: 80,
    images: [],
    status: 'inactive',
    rating: { avg: 4.1, count: 6 },
    createdAt: SEED_TIME,
    updatedAt: SEED_TIME,
  },
]

function buildBillboard(id: string, input: RentorBillboardInput): RentorBillboard {
  const now = new Date().toISOString()
  return {
    id,
    ownerId: OWNER_ID,
    title: input.title,
    description: input.description,
    category: input.category,
    size: input.size,
    location: {
      lat: input.lat,
      lng: input.lng,
      address: input.address,
      city: input.city,
    },
    pricePerDay: input.pricePerDay,
    images: input.images,
    status: 'active',
    rating: { avg: 0, count: 0 },
    createdAt: now,
    updatedAt: now,
  }
}

export const useRentorBillboardStore = create<RentorBillboardState>()(
  persist(
    (set) => ({
      billboards: SEED,
      addBillboard: (input) =>
        set((s) => ({
          billboards: [
            buildBillboard(crypto.randomUUID(), input),
            ...s.billboards,
          ],
        })),
      updateBillboard: (id, input) =>
        set((s) => ({
          billboards: s.billboards.map((b) =>
            b.id === id
              ? {
                  ...b,
                  title: input.title,
                  description: input.description,
                  category: input.category,
                  size: input.size,
                  location: {
                    lat: input.lat,
                    lng: input.lng,
                    address: input.address,
                    city: input.city,
                  },
                  pricePerDay: input.pricePerDay,
                  images: input.images,
                  updatedAt: new Date().toISOString(),
                }
              : b,
          ),
        })),
      setStatus: (id, status) =>
        set((s) => ({
          billboards: s.billboards.map((b) =>
            b.id === id
              ? { ...b, status, updatedAt: new Date().toISOString() }
              : b,
          ),
        })),
      deleteBillboard: (id) =>
        set((s) => ({
          billboards: s.billboards.filter((b) => b.id !== id),
        })),
    }),
    { name: 'billboard-rentor-billboards-preview' },
  ),
)
