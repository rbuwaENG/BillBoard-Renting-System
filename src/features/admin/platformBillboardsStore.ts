import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  MOCK_BILLBOARDS,
  type MockBillboard,
} from '@/features/billboards/mockBillboards'
import type { BillboardStatus } from '@/types'

interface PlatformBillboardsState {
  billboards: MockBillboard[]
  setStatus: (id: string, status: BillboardStatus) => void
}

// Admin moderation view over the full platform catalog (PLAN.md "Admin":
// moderate flagged billboards / unpublish). Seeded from the same catalog the
// public Browse map reads, but kept in its own store so status edits here
// don't require rewiring Browse to a shared store in this pass.
export const usePlatformBillboardsStore = create<PlatformBillboardsState>()(
  persist(
    (set) => ({
      billboards: MOCK_BILLBOARDS,
      setStatus: (id, status) =>
        set((s) => ({
          billboards: s.billboards.map((b) =>
            b.id === id
              ? { ...b, status, updatedAt: new Date().toISOString() }
              : b,
          ),
        })),
    }),
    { name: 'billboard-platform-billboards-preview' },
  ),
)
