import { create } from 'zustand'
import { useAuthStore } from '@/hooks/useAuth'

// The "add to campaign" cart is genuinely ephemeral, pre-submit UI state —
// kept client-only. Submitted campaigns themselves are real rows in the
// `campaigns`/`campaign_items` tables (see useCampaigns.ts).
//
// Stored per account (`billboard-campaigns-draft:<uid>`) and swapped whenever
// the signed-in user changes, so one person's cart never shows up for the
// next account on a shared browser.
const LEGACY_STORAGE_KEY = 'billboard-campaigns-draft'
export const draftStorageKey = (userId: string) =>
  `${LEGACY_STORAGE_KEY}:${userId}`

function readDraft(userId: string): string[] {
  try {
    const raw = window.localStorage.getItem(draftStorageKey(userId))
    const parsed: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === 'string')
      : []
  } catch {
    return []
  }
}

function writeDraft(userId: string, ids: string[]) {
  try {
    window.localStorage.setItem(draftStorageKey(userId), JSON.stringify(ids))
  } catch {
    // storage unavailable (private mode / quota) — keep the in-memory cart
  }
}

interface CampaignDraftState {
  userId: string | null
  draftIds: string[]
  setUser: (userId: string | null) => void
  toggleDraft: (id: string) => void
  removeFromDraft: (id: string) => void
  clearDraft: () => void
}

export const useCampaignStore = create<CampaignDraftState>()((set, get) => {
  function update(next: string[]) {
    const { userId } = get()
    if (!userId) return
    writeDraft(userId, next)
    set({ draftIds: next })
  }

  return {
    userId: null,
    draftIds: [],
    setUser: (userId) => {
      if (get().userId === userId) return
      set({ userId, draftIds: userId ? readDraft(userId) : [] })
    },
    toggleDraft: (id) => {
      const { draftIds } = get()
      update(
        draftIds.includes(id)
          ? draftIds.filter((x) => x !== id)
          : [...draftIds, id],
      )
    },
    removeFromDraft: (id) => update(get().draftIds.filter((x) => x !== id)),
    clearDraft: () => update([]),
  }
})

// The pre-per-user cart was shared by every account on this browser — drop it.
try {
  window.localStorage.removeItem(LEGACY_STORAGE_KEY)
} catch {
  // ignore
}

useCampaignStore.getState().setUser(useAuthStore.getState().user?.uid ?? null)
useAuthStore.subscribe((s) =>
  useCampaignStore.getState().setUser(s.user?.uid ?? null),
)
