import { useQueries } from '@tanstack/react-query'
import { useMemo } from 'react'
import {
  rangeOverlapsBooked,
  type BookedRange,
} from '@/features/bookings/availability'
import { bookedRangesQueryOptions } from '@/features/bookings/useBookedRanges'

// There's no bulk availability RPC yet, so "available between" checks one
// billboard per call; only the first N results (in display order) are
// checked. Candidate for a server-side `billboards_available_between` RPC.
export const AVAILABILITY_CHECK_LIMIT = 50

export interface AvailabilityFilterResult<T> {
  results: T[]
  active: boolean
  checking: boolean
  // Results past the limit that weren't checked (left out of `results`).
  uncheckedCount: number
  // Checked boards whose lookup failed — kept in `results` (unknown).
  failedCount: number
}

interface AvailabilityQueryResult {
  data?: BookedRange[]
  isError: boolean
  isPending: boolean
}

// Pure part, for tests: which of `list` stay given the booked ranges looked
// up for the first `limit` of them.
export function applyAvailabilityFilter<T extends { id: string }>(
  list: T[],
  range: { startDate: string; endDate: string },
  lookups: AvailabilityQueryResult[],
  limit = AVAILABILITY_CHECK_LIMIT,
): Omit<AvailabilityFilterResult<T>, 'active'> {
  const checked = list.slice(0, limit)
  const results: T[] = []
  let failedCount = 0
  let checking = false
  checked.forEach((billboard, i) => {
    const lookup = lookups[i]
    if (!lookup || lookup.isPending) {
      checking = true
      return
    }
    if (lookup.isError || !lookup.data) {
      failedCount++
      results.push(billboard)
      return
    }
    if (!rangeOverlapsBooked(range.startDate, range.endDate, lookup.data)) {
      results.push(billboard)
    }
  })
  return {
    results,
    checking,
    uncheckedCount: Math.max(list.length - limit, 0),
    failedCount,
  }
}

// Narrows `list` to billboards free for the whole [startDate, endDate]
// range. Inactive (no range) → `list` unchanged and no requests.
export function useAvailabilityFilter<T extends { id: string }>(
  list: T[],
  startDate: string,
  endDate: string,
): AvailabilityFilterResult<T> {
  const active = !!startDate && !!endDate && endDate >= startDate
  const checked = active ? list.slice(0, AVAILABILITY_CHECK_LIMIT) : []
  const lookups = useQueries({
    queries: checked.map((b) => bookedRangesQueryOptions(b.id)),
  })

  const lookupKey = lookups
    .map((l) => `${l.status}:${l.dataUpdatedAt}`)
    .join(',')
  return useMemo(() => {
    if (!active) {
      return {
        results: list,
        active,
        checking: false,
        uncheckedCount: 0,
        failedCount: 0,
      }
    }
    return {
      active,
      ...applyAvailabilityFilter(list, { startDate, endDate }, lookups),
    }
    // `lookups` is a new array every render; lookupKey captures its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, list, startDate, endDate, lookupKey])
}
