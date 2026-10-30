import { describe, expect, it } from 'vitest'
import {
  bookingDays,
  hasDateErrors,
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
