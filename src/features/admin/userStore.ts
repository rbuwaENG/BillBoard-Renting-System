import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile } from '@/types'

interface UserState {
  users: UserProfile[]
  toggleStatus: (uid: string) => void
}

// Platform user directory for the Admin "manage users (suspend/ban)"
// capability (PLAN.md section 1). Seeded with the billboard owners from the
// public catalog plus a couple of renters — a local preview store until
// Phase 9 replaces it with a Firestore `users` query + an admin-only
// suspend/reinstate Cloud Function callable.
const SEED_USERS: UserProfile[] = [
  {
    uid: 'mock-owner-1',
    displayName: 'Priya Sharma',
    email: 'priya.sharma@example.com',
    role: 'rentor',
    status: 'active',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    uid: 'mock-owner-2',
    displayName: 'Arjun Rao',
    email: 'arjun.rao@example.com',
    role: 'rentor',
    status: 'active',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
  {
    uid: 'mock-owner-3',
    displayName: 'Karan Mehta',
    email: 'karan.mehta@example.com',
    role: 'rentor',
    status: 'active',
    createdAt: '2026-01-03T00:00:00.000Z',
  },
  {
    uid: 'mock-owner-4',
    displayName: 'Fatima Al-Rashid',
    email: 'fatima.alrashid@example.com',
    role: 'rentor',
    status: 'active',
    createdAt: '2026-01-03T00:00:00.000Z',
  },
  {
    uid: 'renter-alice',
    displayName: 'Alice Nguyen',
    email: 'alice.nguyen@example.com',
    role: 'renter',
    status: 'active',
    createdAt: '2026-01-10T00:00:00.000Z',
  },
  {
    uid: 'renter-marcus',
    displayName: 'Marcus Webb',
    email: 'marcus.webb@example.com',
    role: 'renter',
    status: 'suspended',
    createdAt: '2026-01-11T00:00:00.000Z',
  },
  {
    uid: 'mock-admin',
    displayName: 'Dev Admin',
    email: 'admin@example.com',
    role: 'admin',
    status: 'active',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
]

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      users: SEED_USERS,
      toggleStatus: (uid) =>
        set((s) => ({
          users: s.users.map((u) =>
            u.uid === uid
              ? {
                  ...u,
                  status: u.status === 'active' ? 'suspended' : 'active',
                }
              : u,
          ),
        })),
    }),
    { name: 'billboard-users-preview' },
  ),
)
