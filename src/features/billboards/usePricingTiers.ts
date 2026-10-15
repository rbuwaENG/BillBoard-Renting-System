import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { PricingTier } from '@/types'

interface PricingTierRow {
  id: string
  billboard_id: string
  min_days: number
  max_days: number | null
  price_per_day: number
}

function toPricingTier(row: PricingTierRow): PricingTier {
  return {
    id: row.id,
    billboardId: row.billboard_id,
    minDays: row.min_days,
    maxDays: row.max_days,
    pricePerDay: row.price_per_day,
  }
}

export function usePricingTiers(billboardId: string | null) {
  return useQuery({
    queryKey: ['pricing-tiers', billboardId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboard_pricing_tiers')
        .select('*')
        .eq('billboard_id', billboardId!)
        .order('min_days', { ascending: true })
      if (error) throw error
      return (data as PricingTierRow[]).map(toPricingTier)
    },
    enabled: !!billboardId,
  })
}

export interface PricingTierInput {
  minDays: number
  maxDays: number | null
  pricePerDay: number
}

// No multi-statement transactions from the client — replace-all is simple
// and safe here since tiers have no foreign references of their own.
export function useSavePricingTiers(billboardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tiers: PricingTierInput[]) => {
      const { error: deleteError } = await supabase
        .from('billboard_pricing_tiers')
        .delete()
        .eq('billboard_id', billboardId)
      if (deleteError) throw deleteError

      if (tiers.length === 0) return

      const { error: insertError } = await supabase
        .from('billboard_pricing_tiers')
        .insert(
          tiers.map((t) => ({
            billboard_id: billboardId,
            min_days: t.minDays,
            max_days: t.maxDays,
            price_per_day: t.pricePerDay,
          })),
        )
      if (insertError) throw insertError
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['pricing-tiers', billboardId] }),
  })
}
