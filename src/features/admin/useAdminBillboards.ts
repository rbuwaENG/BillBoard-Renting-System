import { useQuery } from '@tanstack/react-query'
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
