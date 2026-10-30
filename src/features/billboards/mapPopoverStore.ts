import { create } from 'zustand'

// The map's corner controls (filters, campaign draft, near-me, renter
// activity) each render their own popover anchored to the same top-right
// corner — without a shared "which one is open" state, opening a second
// one left the first one's panel stacked underneath/behind it.
export type MapPopoverKey = 'filters' | 'campaign' | 'nearme' | 'activity'

export type ActivityTabKey = 'bookings' | 'payments' | 'campaigns' | 'messages'

interface MapPopoverState {
  active: MapPopoverKey | null
  activityTab: ActivityTabKey
  toggle: (key: MapPopoverKey) => void
  close: () => void
  setActivityTab: (tab: ActivityTabKey) => void
  // Deep links (e.g. a notification) open My activity on a given tab.
  openActivity: (tab: ActivityTabKey) => void
}

export const useMapPopoverStore = create<MapPopoverState>((set) => ({
  // Everything starts closed — the activity panel used to open by default
  // and covered most of the map on phones.
  active: null,
  activityTab: 'bookings',
  toggle: (key) => set((s) => ({ active: s.active === key ? null : key })),
  close: () => set({ active: null }),
  setActivityTab: (tab) => set({ activityTab: tab }),
  openActivity: (tab) => set({ active: 'activity', activityTab: tab }),
}))
