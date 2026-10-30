import { describe, expect, it } from 'vitest'
import { validatePricingTiers } from './pricingTierValidation'

describe('validatePricingTiers', () => {
  it('accepts an empty list and contiguous, non-overlapping tiers', () => {
    expect(validatePricingTiers([])).toBeNull()
    expect(
      validatePricingTiers([
        { minDays: 7, maxDays: 29, pricePerDay: 90 },
        { minDays: 1, maxDays: 6, pricePerDay: 100 },
        { minDays: 30, maxDays: null, pricePerDay: 75 },
      ]),
    ).toBeNull()
  })

  it('rejects non-positive prices', () => {
    expect(
      validatePricingTiers([{ minDays: 1, maxDays: null, pricePerDay: 0 }]),
    ).toMatch(/greater than 0/)
  })

  it('rejects inverted and invalid day ranges', () => {
    expect(
      validatePricingTiers([{ minDays: 10, maxDays: 5, pricePerDay: 50 }]),
    ).toMatch(/can't be less/)
    expect(
      validatePricingTiers([{ minDays: 0, maxDays: null, pricePerDay: 50 }]),
    ).toMatch(/at least 1/)
  })

  it('rejects overlapping ranges, including after an unbounded tier', () => {
    expect(
      validatePricingTiers([
        { minDays: 1, maxDays: 7, pricePerDay: 100 },
        { minDays: 7, maxDays: 14, pricePerDay: 90 },
      ]),
    ).toMatch(/Tiers 1 and 2 cover overlapping/)
    expect(
      validatePricingTiers([
        { minDays: 1, maxDays: null, pricePerDay: 100 },
        { minDays: 30, maxDays: null, pricePerDay: 80 },
      ]),
    ).toMatch(/overlapping/)
  })
})
