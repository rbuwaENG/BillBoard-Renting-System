import { useQuery } from '@tanstack/react-query'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import {
  BILLBOARD_SELECT,
  toBillboard,
  type BillboardRow,
} from './useBillboards'

// One billboard by id (shareable /billboards/:id page, deep links). Resolves
// to null when the row isn't visible — RLS only exposes active listings to
// non-owners, so null means "not found or no longer listed".
export function useBillboard(id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.billboard(id),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('billboards')
        .select(BILLBOARD_SELECT)
        .eq('id', id!)
        .maybeSingle()
      if (error) throw error
      return data ? toBillboard(data as unknown as BillboardRow) : null
    },
    enabled: !!id,
  })
}
