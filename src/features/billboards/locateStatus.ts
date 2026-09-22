export type LocateStatus = 'locating' | 'found' | 'denied' | 'unsupported'

export const LOCATE_STATUS_LABEL: Record<LocateStatus, string> = {
  locating: 'Locating you…',
  found: 'Showing your area',
  denied: 'Location access denied — showing default view',
  unsupported: 'Geolocation unavailable — showing default view',
}
