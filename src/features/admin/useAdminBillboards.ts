import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BILLBOARD_SELECT,
  toBillboard,
  type BillboardRow,
} from '@/features/billboards/useBillboards'
import { supabase } from '@/lib/supabase'

// Admin moderation view over the full platform catalog, regardless of
// status — RLS (billboards_select_public) allows an admin to see every
// billboard, not just status = 'active' ones.
export function useAdminBillboards() {
  return useQuery({
    queryKey: ['admin-billboards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select(BILLBOARD_SELECT)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as BillboardRow[]).map(toBillboard)
    },
  })
}

// Moderation-style power to reduce/clear a specific listing's price — the
// `billboards_update_owner` RLS policy already allows admins to update any
// billboard row, so this is a plain update, no RPC needed.
export function useSetAdminPriceOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      price,
    }: {
      id: string
      price: number | null
    }) => {
      const { error } = await supabase
        .from('billboards')
        .update({ admin_price_override_per_day: price })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-billboards'] })
      qc.invalidateQueries({ queryKey: ['billboards'] })
      qc.invalidateQueries({ queryKey: ['billboards-near'] })
      qc.invalidateQueries({ queryKey: ['rentor-billboards'] })
    },
  })
}
