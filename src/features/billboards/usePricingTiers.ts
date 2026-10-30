import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
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
    queryKey: queryKeys.pricingTiers.billboard(billboardId),
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
  // Present for rows that already exist (or were given a client-generated id
  // when added), so a save is an idempotent upsert keyed on it.
  id?: string
  minDays: number
  maxDays: number | null
  pricePerDay: number
}

// No multi-statement transactions from the client, so the save is ordered to
// never lose data: first upsert every row (one statement — all or nothing),
// then delete only the rows the owner removed. A failed upsert leaves the
// previous tiers untouched; a failed delete leaves the removed rows in place.
// Rows are keyed on a stable id, so retrying after a partial failure never
// duplicates tiers.
export function useSavePricingTiers(billboardId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (tiers: PricingTierInput[]) => {
      const rows = tiers.map((t) => ({
        id: t.id ?? crypto.randomUUID(),
        billboard_id: billboardId,
        min_days: t.minDays,
        max_days: t.maxDays,
        price_per_day: t.pricePerDay,
      }))

      if (rows.length > 0) {
        const { error: upsertError } = await supabase
          .from('billboard_pricing_tiers')
          .upsert(rows, { onConflict: 'id' })
        if (upsertError) throw upsertError
      }

      let removeQuery = supabase
        .from('billboard_pricing_tiers')
        .delete()
        .eq('billboard_id', billboardId)
      if (rows.length > 0) {
        removeQuery = removeQuery.not(
          'id',
          'in',
          `(${rows.map((r) => r.id).join(',')})`,
        )
      }
      const { error: deleteError } = await removeQuery
      if (deleteError) throw deleteError
    },
    onSettled: () =>
      qc.invalidateQueries({
        queryKey: queryKeys.pricingTiers.billboard(billboardId),
      }),
  })
}
