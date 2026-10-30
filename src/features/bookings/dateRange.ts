// Booking date helpers. Dates are plain `YYYY-MM-DD` strings (what
// <input type="date"> and Postgres `date` both use), so string comparison is
// chronological comparison.

function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Today in the viewer's local calendar — what the date picker shows as
// "today", so `min` matches what the user sees.
export function todayISO(now: Date = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

// Inclusive day count, matching request_booking's `(end - start) + 1`.
export function bookingDays(startDate: string, endDate: string): number {
  if (!startDate || !endDate || endDate < startDate) return 0
  const ms =
    Date.parse(`${endDate}T00:00:00Z`) - Date.parse(`${startDate}T00:00:00Z`)
  return Math.round(ms / 86_400_000) + 1
}

// Server limits (request_booking / create_campaign, migration 0035).
export const MAX_BOOKING_DAYS = 365
export const MAX_ADVANCE_DAYS = 365
export const MAX_LENGTH_MESSAGE = 'Bookings can be at most 365 days long'
export const MAX_ADVANCE_MESSAGE = 'Bookings can start at most 365 days ahead'

// `iso` shifted by whole days (calendar arithmetic, DST-safe via UTC).
export function addDaysISO(iso: string, days: number): string {
  const date = new Date(`${iso}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

// The latest day a booking may start on (server: platform_today() + 365).
export function maxStartDate(today: string = todayISO()): string {
  return addDaysISO(today, MAX_ADVANCE_DAYS)
}

// The latest end date for a booking starting on `startDate`.
export function maxEndDate(startDate: string): string {
  return addDaysISO(startDate, MAX_BOOKING_DAYS - 1)
}

export interface DateRangeErrors {
  start?: string
  end?: string
}

export function validateDateRange(
  startDate: string,
  endDate: string,
  today: string = todayISO(),
): DateRangeErrors {
  const errors: DateRangeErrors = {}
  if (startDate && startDate < today)
    errors.start = 'Start date cannot be in the past'
  else if (startDate && startDate > maxStartDate(today))
    errors.start = MAX_ADVANCE_MESSAGE
  if (startDate && endDate && endDate < startDate) {
    errors.end = 'End date must be on or after the start date.'
  } else if (
    startDate &&
    endDate &&
    bookingDays(startDate, endDate) > MAX_BOOKING_DAYS
  ) {
    errors.end = MAX_LENGTH_MESSAGE
  } else if (!startDate && endDate && endDate < today) {
    errors.end = 'End date cannot be in the past'
  }
  return errors
}

export function hasDateErrors(errors: DateRangeErrors): boolean {
  return !!errors.start || !!errors.end
}
