import { describe, expect, it } from 'vitest'
import { getDisplayPrice, resolveEffectivePricePerDay } from './pricing'

const BASE = {
  pricePerDay: 100,
  salePricePerDay: null,
  adminPriceOverridePerDay: null,
}

describe('resolveEffectivePricePerDay', () => {
  it('falls back to the base price when nothing else is set', () => {
    expect(resolveEffectivePricePerDay(BASE)).toBe(100)
  })

  it('uses the sale price when lower than base', () => {
    expect(resolveEffectivePricePerDay({ ...BASE, salePricePerDay: 80 })).toBe(
      80,
    )
  })

  it('ignores a sale price that is not actually lower', () => {
    expect(resolveEffectivePricePerDay({ ...BASE, salePricePerDay: 120 })).toBe(
      100,
    )
  })

  it('admin override wins over sale price', () => {
    expect(
      resolveEffectivePricePerDay({
        ...BASE,
        salePricePerDay: 80,
        adminPriceOverridePerDay: 50,
      }),
    ).toBe(50)
  })

  it('admin override wins over a matching tier', () => {
    const tiers = [{ minDays: 1, maxDays: null, pricePerDay: 70 }]
    expect(
      resolveEffectivePricePerDay(
        { ...BASE, adminPriceOverridePerDay: 50 },
        10,
        tiers,
      ),
    ).toBe(50)
  })

  it('picks the matching tier over the sale price', () => {
    const tiers = [
      { minDays: 1, maxDays: 6, pricePerDay: 100 },
      { minDays: 7, maxDays: null, pricePerDay: 70 },
    ]
    expect(
      resolveEffectivePricePerDay({ ...BASE, salePricePerDay: 90 }, 10, tiers),
    ).toBe(70)
  })

  it('picks the most specific (largest min_days) tier when ranges overlap', () => {
    const tiers = [
      { minDays: 1, maxDays: null, pricePerDay: 100 },
      { minDays: 7, maxDays: null, pricePerDay: 70 },
    ]
    expect(resolveEffectivePricePerDay(BASE, 10, tiers)).toBe(70)
  })

  it('falls back to sale price when no tier matches the duration', () => {
    const tiers = [{ minDays: 30, maxDays: null, pricePerDay: 50 }]
    expect(
      resolveEffectivePricePerDay({ ...BASE, salePricePerDay: 90 }, 5, tiers),
    ).toBe(90)
  })

  it('treats an open-ended max_days as unlimited', () => {
    const tiers = [{ minDays: 7, maxDays: null, pricePerDay: 70 }]
    expect(resolveEffectivePricePerDay(BASE, 365, tiers)).toBe(70)
  })

  it('skips tier matching entirely when days is omitted (browse-time estimate)', () => {
    const tiers = [{ minDays: 1, maxDays: null, pricePerDay: 70 }]
    expect(
      resolveEffectivePricePerDay(
        { ...BASE, salePricePerDay: 80 },
        undefined,
        tiers,
      ),
    ).toBe(80)
  })
})

describe('getDisplayPrice', () => {
  it('returns no strikethrough when there is no discount', () => {
    expect(getDisplayPrice(BASE)).toEqual({
      price: 100,
      strikethroughFrom: null,
    })
  })

  it('strikes through the base price when a sale price applies', () => {
    expect(getDisplayPrice({ ...BASE, salePricePerDay: 80 })).toEqual({
      price: 80,
      strikethroughFrom: 100,
    })
  })

  it('strikes through the base price when an admin override applies', () => {
    expect(getDisplayPrice({ ...BASE, adminPriceOverridePerDay: 60 })).toEqual({
      price: 60,
      strikethroughFrom: 100,
    })
  })
})
