export interface PricedBillboard {
  pricePerDay: number
  salePricePerDay: number | null
  adminPriceOverridePerDay: number | null
}

export interface PricingTierLike {
  minDays: number
  maxDays: number | null
  pricePerDay: number
}

function bestMatchingTier(
  tiers: PricingTierLike[],
  days: number,
): PricingTierLike | null {
  const matching = tiers.filter(
    (t) => t.minDays <= days && (t.maxDays === null || days <= t.maxDays),
  )
  if (matching.length === 0) return null
  return matching.reduce((best, t) => (t.minDays > best.minDays ? t : best))
}

// Mirrors the precedence in request_booking (supabase/migrations/0019_pricing.sql)
// exactly: admin override > best-matching duration tier > sale price (if lower
// than base) > base price. Omit `days`/`tiers` for a browse-time estimate
// (map/card), where tier matching isn't meaningful yet.
export function resolveEffectivePricePerDay(
  billboard: PricedBillboard,
  days?: number,
  tiers?: PricingTierLike[],
): number {
  if (billboard.adminPriceOverridePerDay !== null) {
    return billboard.adminPriceOverridePerDay
  }

  if (days !== undefined && tiers && tiers.length > 0) {
    const tier = bestMatchingTier(tiers, days)
    if (tier) return tier.pricePerDay
  }

  if (
    billboard.salePricePerDay !== null &&
    billboard.salePricePerDay < billboard.pricePerDay
  ) {
    return billboard.salePricePerDay
  }

  return billboard.pricePerDay
}

export interface DisplayPrice {
  price: number
  strikethroughFrom: number | null
}

// Browse-time display price (no date range yet) — used by cards/markers.
export function getDisplayPrice(billboard: PricedBillboard): DisplayPrice {
  const price = resolveEffectivePricePerDay(billboard)
  return {
    price,
    strikethroughFrom: price < billboard.pricePerDay ? billboard.pricePerDay : null,
  }
}

// What request_booking will quote for `days` days (rate × days).
export function estimateBookingTotal(
  billboard: PricedBillboard,
  days: number,
  tiers?: PricingTierLike[],
): number {
  if (days <= 0) return 0
  return resolveEffectivePricePerDay(billboard, days, tiers) * days
}

// Cart / campaign estimate: each billboard priced with its own tiers for the
// shared date range, exactly as create_campaign → request_booking will.
export function estimateCartTotal(
  billboards: (PricedBillboard & { id: string })[],
  days: number,
  tiersByBillboard: Record<string, PricingTierLike[] | undefined>,
): number {
  return billboards.reduce(
    (sum, b) => sum + estimateBookingTotal(b, days, tiersByBillboard[b.id]),
    0,
  )
}
