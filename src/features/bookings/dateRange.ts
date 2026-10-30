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
    errors.start = "Start date can't be in the past."
  if (startDate && endDate && endDate < startDate) {
    errors.end = 'End date must be on or after the start date.'
  } else if (!startDate && endDate && endDate < today) {
    errors.end = "End date can't be in the past."
  }
  return errors
}

export function hasDateErrors(errors: DateRangeErrors): boolean {
  return !!errors.start || !!errors.end
}
