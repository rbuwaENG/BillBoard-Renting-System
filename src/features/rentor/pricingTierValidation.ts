import type { PricingTierInput } from '@/features/billboards/usePricingTiers'

// Returns a human-readable problem with the tier list, or null when it can be
// saved. Mirrors the DB checks (min_days >= 1, max_days >= min_days) and adds
// the ones the DB doesn't enforce: positive prices and no overlapping ranges
// (an overlap would make the "matching tier" for a booking length ambiguous).
export function validatePricingTiers(tiers: PricingTierInput[]): string | null {
  for (const [i, t] of tiers.entries()) {
    const label = `Tier ${i + 1}`
    if (!Number.isInteger(t.minDays) || t.minDays < 1) {
      return `${label}: minimum days must be a whole number of at least 1`
    }
    if (t.maxDays !== null) {
      if (!Number.isInteger(t.maxDays)) {
        return `${label}: maximum days must be a whole number`
      }
      if (t.maxDays < t.minDays) {
        return `${label}: maximum days can't be less than minimum days`
      }
    }
    if (!Number.isFinite(t.pricePerDay) || t.pricePerDay <= 0) {
      return `${label}: price per day must be greater than 0`
    }
  }

  const sorted = tiers
    .map((t, i) => ({ ...t, index: i }))
    .sort((a, b) => a.minDays - b.minDays)
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1]
    const curr = sorted[i]
    if (prev.maxDays === null || curr.minDays <= prev.maxDays) {
      return `Tiers ${prev.index + 1} and ${curr.index + 1} cover overlapping day ranges`
    }
  }
  return null
}
