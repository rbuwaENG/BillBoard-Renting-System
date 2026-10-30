import { describe, expect, it } from 'vitest'
import {
  addDaysISO,
  bookingDays,
  hasDateErrors,
  maxEndDate,
  maxStartDate,
  todayISO,
  validateDateRange,
} from './dateRange'

const TODAY = '2026-10-30'

describe('validateDateRange', () => {
  it('accepts today through a later end date', () => {
    expect(hasDateErrors(validateDateRange(TODAY, '2026-11-02', TODAY))).toBe(
      false,
    )
  })
  it('accepts a single-day range', () => {
    expect(hasDateErrors(validateDateRange(TODAY, TODAY, TODAY))).toBe(false)
  })
  it('rejects a start date in the past', () => {
    expect(validateDateRange('2026-10-29', '2026-11-02', TODAY).start).toMatch(
      /past/,
    )
  })
  it('rejects an end before the start', () => {
    expect(validateDateRange('2026-11-05', '2026-11-02', TODAY).end).toMatch(
      /on or after/,
    )
  })
  it('does not complain about empty fields', () => {
    expect(hasDateErrors(validateDateRange('', '', TODAY))).toBe(false)
  })
})

describe('validateDateRange — server limits (0035)', () => {
  it('allows a start exactly 365 days ahead, not 366', () => {
    expect(maxStartDate(TODAY)).toBe('2027-10-30')
    expect(validateDateRange('2027-10-30', '2027-10-30', TODAY).start).toBe(
      undefined,
    )
    expect(validateDateRange('2027-10-31', '2027-10-31', TODAY).start).toBe(
      'Bookings can start at most 365 days ahead',
    )
  })

  it('allows 365 days inclusive, not 366', () => {
    expect(maxEndDate('2026-11-01')).toBe('2027-10-31')
    expect(bookingDays('2026-11-01', '2027-10-31')).toBe(365)
    expect(
      hasDateErrors(validateDateRange('2026-11-01', '2027-10-31', TODAY)),
    ).toBe(false)
    expect(validateDateRange('2026-11-01', '2027-11-01', TODAY).end).toBe(
      'Bookings can be at most 365 days long',
    )
  })

  it('counts a leap year correctly', () => {
    // 2028 is a leap year: Jan 1 + 364 days is Dec 30.
    expect(maxEndDate('2028-01-01')).toBe('2028-12-30')
    expect(bookingDays('2028-01-01', '2028-12-30')).toBe(365)
  })

  it('addDaysISO crosses month and year boundaries', () => {
    expect(addDaysISO('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDaysISO('2026-03-01', -1)).toBe('2026-02-28')
  })
})

describe('bookingDays', () => {
  it('counts inclusively like request_booking', () => {
    expect(bookingDays('2026-11-01', '2026-11-01')).toBe(1)
    expect(bookingDays('2026-11-01', '2026-11-07')).toBe(7)
  })
  it('is zero for incomplete or inverted ranges', () => {
    expect(bookingDays('', '2026-11-07')).toBe(0)
    expect(bookingDays('2026-11-07', '2026-11-01')).toBe(0)
  })
})

describe('todayISO', () => {
  it('formats the local date', () => {
    expect(todayISO(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05')
  })
})
