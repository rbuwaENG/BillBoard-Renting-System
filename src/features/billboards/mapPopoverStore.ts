import { create } from 'zustand'

// The map's corner controls (filters, campaign draft, near-me, renter
// activity) each render their own popover anchored to the same top-right
// corner — without a shared "which one is open" state, opening a second
// one left the first one's panel stacked underneath/behind it.
export type MapPopoverKey = 'filters' | 'campaign' | 'nearme' | 'activity'

interface MapPopoverState {
  active: MapPopoverKey | null
  toggle: (key: MapPopoverKey) => void
  close: () => void
}

export const useMapPopoverStore = create<MapPopoverState>((set) => ({
  active: 'activity',
  toggle: (key) => set((s) => ({ active: s.active === key ? null : key })),
  close: () => set({ active: null }),
}))
