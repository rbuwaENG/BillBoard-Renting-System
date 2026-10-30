import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { formatDateRange } from '@/features/renter/formatDateRange'
import {
  OVERLAP_MESSAGE,
  addDays,
  buildMonthGrid,
  formatLongDate,
  formatShortDateRange,
  isBooked,
  mergeBookedRanges,
  parseISODate,
  rangeOverlapsBooked,
  selectDay,
  shiftMonthKeepDay,
  toISODate,
} from './availability'
import { todayISO } from './dateRange'

const BOOKED = [{ startDate: '2026-11-05', endDate: '2026-11-07' }]

describe('buildMonthGrid', () => {
  it('lays out November 2026 Sunday-first in 6 weeks', () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 })
    expect(grid).toHaveLength(6)
    expect(grid.every((w) => w.length === 7)).toBe(true)
    // Nov 1 2026 is a Sunday.
    expect(grid[0][0]).toBe('2026-11-01')
    expect(grid[4][1]).toBe('2026-11-30')
    expect(grid[4].slice(2).every((d) => d === null)).toBe(true)
    expect(grid.flat().filter(Boolean)).toHaveLength(30)
  })

  it('pads the first week and handles leap Februaries', () => {
    const feb = buildMonthGrid({ year: 2028, month: 1 })
    // Feb 1 2028 is a Tuesday.
    expect(feb[0].slice(0, 2)).toEqual([null, null])
    expect(feb[0][2]).toBe('2028-02-01')
    expect(feb.flat().filter(Boolean)).toHaveLength(29)
  })
})

describe('date arithmetic', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })

  it('shifts months keeping the day, clamped to month length', () => {
    expect(shiftMonthKeepDay('2026-01-31', 1)).toBe('2026-02-28')
    expect(shiftMonthKeepDay('2026-11-15', -1)).toBe('2026-10-15')
  })
})

describe('booked days', () => {
  it('marks every day of an inclusive range as booked', () => {
    expect(isBooked('2026-11-04', BOOKED)).toBe(false)
    expect(isBooked('2026-11-05', BOOKED)).toBe(true)
    expect(isBooked('2026-11-07', BOOKED)).toBe(true)
    expect(isBooked('2026-11-08', BOOKED)).toBe(false)
  })

  it('detects a selection that spans a booked range', () => {
    expect(rangeOverlapsBooked('2026-11-01', '2026-11-04', BOOKED)).toBe(false)
    expect(rangeOverlapsBooked('2026-11-01', '2026-11-05', BOOKED)).toBe(true)
    expect(rangeOverlapsBooked('2026-11-03', '2026-11-10', BOOKED)).toBe(true)
    expect(rangeOverlapsBooked('2026-11-08', '2026-11-10', BOOKED)).toBe(false)
    expect(rangeOverlapsBooked('2026-11-03', '', BOOKED)).toBe(false)
  })

  it('merges ranges from several billboards', () => {
    expect(
      mergeBookedRanges([
        [{ startDate: '2026-11-05', endDate: '2026-11-07' }],
        [
          { startDate: '2026-11-08', endDate: '2026-11-09' },
          { startDate: '2026-11-20', endDate: '2026-11-21' },
        ],
        [{ startDate: '2026-11-06', endDate: '2026-11-06' }],
      ]),
    ).toEqual([
      { startDate: '2026-11-05', endDate: '2026-11-09' },
      { startDate: '2026-11-20', endDate: '2026-11-21' },
    ])
  })
})

describe('selectDay', () => {
  const empty = { startDate: '', endDate: '' }

  it('starts, then closes a range', () => {
    const first = selectDay(empty, '2026-11-01', BOOKED)
    expect(first).toEqual({
      ok: true,
      selection: { startDate: '2026-11-01', endDate: '' },
    })
    const second = selectDay(
      { startDate: '2026-11-01', endDate: '' },
      '2026-11-04',
      BOOKED,
    )
    expect(second).toEqual({
      ok: true,
      selection: { startDate: '2026-11-01', endDate: '2026-11-04' },
    })
  })

  it('allows a single-day range', () => {
    expect(
      selectDay({ startDate: '2026-11-01', endDate: '' }, '2026-11-01', BOOKED),
    ).toEqual({
      ok: true,
      selection: { startDate: '2026-11-01', endDate: '2026-11-01' },
    })
  })

  it('rejects an end that would run across a booked day', () => {
    expect(
      selectDay({ startDate: '2026-11-03', endDate: '' }, '2026-11-09', BOOKED),
    ).toEqual({ ok: false, error: OVERLAP_MESSAGE })
  })

  it('moves the start when clicking before it, and restarts after a full range', () => {
    expect(
      selectDay({ startDate: '2026-11-10', endDate: '' }, '2026-11-08', BOOKED),
    ).toEqual({
      ok: true,
      selection: { startDate: '2026-11-08', endDate: '' },
    })
    expect(
      selectDay(
        { startDate: '2026-11-01', endDate: '2026-11-03' },
        '2026-11-20',
        BOOKED,
      ),
    ).toEqual({ ok: true, selection: { startDate: '2026-11-20', endDate: '' } })
  })
})

describe('timezone safety', () => {
  const originalTZ = process.env.TZ
  beforeAll(() => {
    // West of UTC: `new Date('2026-11-01')` is Oct 31 local time here.
    process.env.TZ = 'America/Los_Angeles'
  })
  afterAll(() => {
    process.env.TZ = originalTZ
  })

  it('is actually running west of UTC (guards the tests below)', () => {
    expect(new Date('2026-11-01').getDate()).toBe(31)
  })

  it('parses and formats YYYY-MM-DD as local dates', () => {
    expect(parseISODate('2026-11-01').getDate()).toBe(1)
    expect(toISODate(parseISODate('2026-11-01'))).toBe('2026-11-01')
    expect(formatLongDate('2026-11-01')).toBe('Sunday, November 1, 2026')
    expect(formatShortDateRange('2026-11-01', '2026-11-07')).toBe(
      'Nov 1 – Nov 7, 2026',
    )
    expect(formatDateRange('2026-11-01', '2026-11-07')).toBe(
      'Nov 1 – Nov 7, 2026',
    )
  })

  it('emits grid dates and today without a UTC shift', () => {
    const grid = buildMonthGrid({ year: 2026, month: 10 })
    expect(grid[0][0]).toBe('2026-11-01')
    // 11:30pm local on Oct 30 is already Oct 31 in UTC.
    expect(todayISO(new Date(2026, 9, 30, 23, 30))).toBe('2026-10-30')
  })

  it('steps across the DST change without skipping or repeating a day', () => {
    // US DST ends 2026-11-01.
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-11-01', 1)).toBe('2026-11-02')
  })
})
