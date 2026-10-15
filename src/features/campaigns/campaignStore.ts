import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// The "add to campaign" cart is genuinely ephemeral, pre-submit UI state —
// kept client-only. Submitted campaigns themselves are real rows in the
// `campaigns`/`campaign_items` tables (see useCampaigns.ts).
interface CampaignDraftState {
  draftIds: string[]
  toggleDraft: (id: string) => void
  removeFromDraft: (id: string) => void
  clearDraft: () => void
}

export const useCampaignStore = create<CampaignDraftState>()(
  persist(
    (set) => ({
      draftIds: [],
      toggleDraft: (id) =>
        set((s) => ({
          draftIds: s.draftIds.includes(id)
            ? s.draftIds.filter((x) => x !== id)
            : [...s.draftIds, id],
        })),
      removeFromDraft: (id) =>
        set((s) => ({ draftIds: s.draftIds.filter((x) => x !== id) })),
      clearDraft: () => set({ draftIds: [] }),
    }),
    { name: 'billboard-campaigns-draft' },
  ),
)
