// Calendar/availability date math. Every date is a plain local `YYYY-MM-DD`
// string (what Postgres `date` and <input type="date"> use) and is only ever
// turned into a `Date` via the local-time constructor `new Date(y, m, d)` —
// never `new Date('YYYY-MM-DD')`, which parses as UTC midnight and shows the
// previous day in timezones west of UTC.

export interface BookedRange {
  startDate: string
  endDate: string
}

export interface DateSelection {
  startDate: string
  // '' while only the start has been picked.
  endDate: string
}

export const OVERLAP_MESSAGE = 'Selected dates overlap an existing booking'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function toISODate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

// Local-midnight Date for a `YYYY-MM-DD` string (any time part is ignored).
export function parseISODate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(iso: string, days: number): string {
  const date = parseISODate(iso)
  date.setDate(date.getDate() + days)
  return toISODate(date)
}

export interface MonthRef {
  year: number
  // 0-based, like Date#getMonth.
  month: number
}

export function monthOf(iso: string): MonthRef {
  const date = parseISODate(iso)
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function addMonths(ref: MonthRef, delta: number): MonthRef {
  const date = new Date(ref.year, ref.month + delta, 1)
  return { year: date.getFullYear(), month: date.getMonth() }
}

export function compareMonths(a: MonthRef, b: MonthRef): number {
  return a.year * 12 + a.month - (b.year * 12 + b.month)
}

// Same day-of-month in the month `delta` away, clamped to that month's length
// (Jan 31 + 1 month → Feb 28/29).
export function shiftMonthKeepDay(iso: string, delta: number): string {
  const date = parseISODate(iso)
  const target = new Date(date.getFullYear(), date.getMonth() + delta, 1)
  const lastDay = new Date(
    target.getFullYear(),
    target.getMonth() + 1,
    0,
  ).getDate()
  target.setDate(Math.min(date.getDate(), lastDay))
  return toISODate(target)
}

// A Sunday-first month grid: always 6 rows of 7 cells so the calendar keeps
// its height while paging. Cells outside the month are `null`.
export function buildMonthGrid({ year, month }: MonthRef): (string | null)[][] {
  const first = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const offset = first.getDay()
  const weeks: (string | null)[][] = []
  for (let w = 0; w < 6; w++) {
    const week: (string | null)[] = []
    for (let d = 0; d < 7; d++) {
      const dayNumber = w * 7 + d - offset + 1
      week.push(
        dayNumber >= 1 && dayNumber <= daysInMonth
          ? toISODate(new Date(year, month, dayNumber))
          : null,
      )
    }
    weeks.push(week)
  }
  return weeks
}

export function isBooked(iso: string, ranges: BookedRange[]): boolean {
  return ranges.some((r) => r.startDate <= iso && iso <= r.endDate)
}

// Inclusive overlap test — the same rule as the bookings exclusion
// constraint (daterange '[]').
export function rangeOverlapsBooked(
  startDate: string,
  endDate: string,
  ranges: BookedRange[],
): boolean {
  if (!startDate || !endDate) return false
  return ranges.some((r) => r.startDate <= endDate && startDate <= r.endDate)
}

export type SelectionResult =
  { ok: true; selection: DateSelection } | { ok: false; error: string }

// What a click on `day` does to the current selection: the first click (or a
// click after a complete range) starts a new range, a click before the start
// moves the start, and a click on/after the start closes the range unless
// that range would cross a booked day.
export function selectDay(
  current: DateSelection,
  day: string,
  ranges: BookedRange[],
): SelectionResult {
  const { startDate, endDate } = current
  if (!startDate || endDate || day < startDate) {
    return { ok: true, selection: { startDate: day, endDate: '' } }
  }
  if (rangeOverlapsBooked(startDate, day, ranges)) {
    return { ok: false, error: OVERLAP_MESSAGE }
  }
  return { ok: true, selection: { startDate, endDate: day } }
}

export function mergeBookedRanges(lists: BookedRange[][]): BookedRange[] {
  const all = lists
    .flat()
    .slice()
    .sort((a, b) =>
      a.startDate < b.startDate ? -1 : a.startDate > b.startDate ? 1 : 0,
    )
  const merged: BookedRange[] = []
  for (const r of all) {
    const last = merged[merged.length - 1]
    if (last && r.startDate <= addDays(last.endDate, 1)) {
      if (r.endDate > last.endDate) last.endDate = r.endDate
    } else {
      merged.push({ ...r })
    }
  }
  return merged
}

const LONG_DATE: Intl.DateTimeFormatOptions = {
  weekday: 'long',
  year: 'numeric',
  month: 'long',
  day: 'numeric',
}

// "Saturday, October 31, 2026" — for aria-labels.
export function formatLongDate(iso: string): string {
  return parseISODate(iso).toLocaleDateString('en-US', LONG_DATE)
}

const SHORT_DATE: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
}

// "Nov 3 – Nov 9, 2026"
export function formatShortDateRange(start: string, end: string): string {
  const s = parseISODate(start).toLocaleDateString('en-US', SHORT_DATE)
  const e = parseISODate(end).toLocaleDateString('en-US', {
    ...SHORT_DATE,
    year: 'numeric',
  })
  return `${s} – ${e}`
}

export function formatMonthTitle({ year, month }: MonthRef): string {
  return new Date(year, month, 1).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}
