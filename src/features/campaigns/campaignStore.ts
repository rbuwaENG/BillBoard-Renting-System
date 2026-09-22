import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// A campaign bundles several billboards under one renter-created plan. Not
// part of PLAN.md's original Firestore schema — Phase 5/6 would add a real
// `campaigns` collection (one doc per campaign, a booking created per
// billboard on submit) once a Firebase project exists; this is a local,
// per-browser preview of the workflow.
export interface Campaign {
  id: string
  name: string
  billboardIds: string[]
  startDate: string
  endDate: string
  createdAt: string
}

interface CampaignState {
  draftIds: string[]
  campaigns: Campaign[]
  toggleDraft: (id: string) => void
  removeFromDraft: (id: string) => void
  createCampaign: (input: {
    name: string
    startDate: string
    endDate: string
  }) => void
  deleteCampaign: (id: string) => void
}

export const useCampaignStore = create<CampaignState>()(
  persist(
    (set) => ({
      draftIds: [],
      campaigns: [],
      toggleDraft: (id) =>
        set((s) => ({
          draftIds: s.draftIds.includes(id)
            ? s.draftIds.filter((x) => x !== id)
            : [...s.draftIds, id],
        })),
      removeFromDraft: (id) =>
        set((s) => ({ draftIds: s.draftIds.filter((x) => x !== id) })),
      createCampaign: ({ name, startDate, endDate }) =>
        set((s) => ({
          campaigns: [
            {
              id: crypto.randomUUID(),
              name,
              billboardIds: s.draftIds,
              startDate,
              endDate,
              createdAt: new Date().toISOString(),
            },
            ...s.campaigns,
          ],
          draftIds: [],
        })),
      deleteCampaign: (id) =>
        set((s) => ({ campaigns: s.campaigns.filter((c) => c.id !== id) })),
    }),
    { name: 'billboard-campaigns-preview' },
  ),
)
