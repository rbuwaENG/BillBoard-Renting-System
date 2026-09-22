// Shared by BookingsTab/CampaignsTab/MessagesTab — every renter-panel tab
// that shows a date range formats it the same way.
export function formatDateRange(start: string, end: string) {
  const s = new Date(start)
  const e = new Date(end)
  const short: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' }
  return `${s.toLocaleDateString('en-US', short)} – ${e.toLocaleDateString('en-US', { ...short, year: 'numeric' })}`
}
