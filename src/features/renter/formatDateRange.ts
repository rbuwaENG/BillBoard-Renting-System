import { formatShortDateRange } from '@/features/bookings/availability'

// Shared by BookingsTab/CampaignsTab/MessagesTab — every renter-panel tab
// that shows a date range formats it the same way. Booking dates are plain
// `YYYY-MM-DD` and are parsed as local dates (not UTC midnight), so they
// don't show a day early west of UTC.
export function formatDateRange(start: string, end: string) {
  return formatShortDateRange(start, end)
}
