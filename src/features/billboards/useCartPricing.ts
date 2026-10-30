import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import type { PricingTierLike } from './pricing'

interface TierRow {
  billboard_id: string
  min_days: number
  max_days: number | null
  price_per_day: number
}

export function groupTiersByBillboard(
  rows: TierRow[],
): Record<string, PricingTierLike[]> {
  const grouped: Record<string, PricingTierLike[]> = {}
  for (const row of rows) {
    if (!grouped[row.billboard_id]) grouped[row.billboard_id] = []
    grouped[row.billboard_id].push({
      minDays: row.min_days,
      maxDays: row.max_days,
      pricePerDay: row.price_per_day,
    })
  }
  return grouped
}

// Pricing tiers for every billboard in the cart in one round-trip, grouped
// by billboard id, for estimateCartTotal.
export function useCartPricingTiers(billboardIds: string[]) {
  const ids = [...billboardIds].sort()
  return useQuery({
    queryKey: queryKeys.pricingTiers.cart(ids),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_pricing_tiers')
        .select('billboard_id, min_days, max_days, price_per_day')
        .in('billboard_id', ids)
      if (error) throw error
      return groupTiersByBillboard((data ?? []) as TierRow[])
    },
    enabled: ids.length > 0,
  })
}
