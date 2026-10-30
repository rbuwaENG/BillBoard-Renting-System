import { describe, expect, it, vi } from 'vitest'
import { bookingDays } from '@/features/bookings/dateRange'
import { estimateBookingTotal, estimateCartTotal } from './pricing'
import { groupTiersByBillboard } from './useCartPricing'

vi.mock('@/lib/supabase', async () => {
  const { createSupabaseMock } = await import('@/test/supabaseMock')
  return { supabase: createSupabaseMock() }
})

const BASE = {
  pricePerDay: 100,
  salePricePerDay: null,
  adminPriceOverridePerDay: null,
}

describe('estimateCartTotal', () => {
  const tiers = groupTiersByBillboard([
    { billboard_id: 'a', min_days: 1, max_days: 6, price_per_day: 95 },
    { billboard_id: 'a', min_days: 7, max_days: null, price_per_day: 70 },
  ])

  it('applies each billboard’s own tier for the chosen duration', () => {
    const cart = [
      { id: 'a', ...BASE },
      { id: 'b', ...BASE, salePricePerDay: 80 },
      { id: 'c', ...BASE, adminPriceOverridePerDay: 40 },
    ]
    const days = bookingDays('2026-11-01', '2026-11-07') // 7 days
    expect(days).toBe(7)
    // a: tier 7+ → 70/day; b: sale 80/day; c: override 40/day
    expect(estimateCartTotal(cart, days, tiers)).toBe((70 + 80 + 40) * 7)
  })

  it('uses the shorter-duration tier for short ranges', () => {
    expect(estimateCartTotal([{ id: 'a', ...BASE }], 3, tiers)).toBe(95 * 3)
  })

  it('is not the naive base-price sum', () => {
    const cart = [
      { id: 'a', ...BASE },
      { id: 'b', ...BASE, salePricePerDay: 80 },
    ]
    const naive = (100 + 100) * 10
    expect(estimateCartTotal(cart, 10, tiers)).not.toBe(naive)
    expect(estimateCartTotal(cart, 10, tiers)).toBe((70 + 80) * 10)
  })

  it('is zero without a valid range', () => {
    expect(estimateCartTotal([{ id: 'a', ...BASE }], 0, tiers)).toBe(0)
    expect(estimateBookingTotal(BASE, 0)).toBe(0)
  })
})
