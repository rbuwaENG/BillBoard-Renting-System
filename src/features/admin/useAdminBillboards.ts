import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BILLBOARD_SELECT,
  toBillboard,
  type BillboardRow,
} from '@/features/billboards/useBillboards'
import { queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'
import { isMissingFunctionError } from './adminUtils'
import { usePagedQuery } from './usePagedQuery'

// Statuses an admin can filter/moderate by. 'archived' arrives with the
// billboards contract (owner-archived listings); kept as plain strings so
// this compiles both before and after `BillboardStatus` gains it.
export const MODERATION_FILTERS = [
  'all',
  'flagged',
  'active',
  'inactive',
  'archived',
] as const
export type ModerationFilter = (typeof MODERATION_FILTERS)[number]
export type AdminBillboardStatus = 'active' | 'inactive' | 'flagged'

function invalidateBillboardLists(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: queryKeys.adminBillboards.all })
  qc.invalidateQueries({ queryKey: queryKeys.billboards })
  qc.invalidateQueries({ queryKey: queryKeys.billboardsNear.all })
  qc.invalidateQueries({ queryKey: queryKeys.rentorBillboards.all })
}

// Admin view over the full platform catalog, regardless of status — RLS
// (billboards_select_public) allows an admin to see every billboard. Used by
// the analytics counts; the moderation list pages with
// `useAdminBillboardsPaged` instead.
export function useAdminBillboards() {
  return useQuery({
    queryKey: queryKeys.adminBillboards.all,
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

// Paged moderation list ("Load more", PAGE_SIZE at a time); the status
// filter is applied server-side so paging stays meaningful.
export function useAdminBillboardsPaged(filter: ModerationFilter) {
  return usePagedQuery(
    queryKeys.adminBillboards.paged(filter),
    async (from, to) => {
      let query = supabase
        .from('billboards')
        .select(BILLBOARD_SELECT)
        .order('created_at', { ascending: false })
      if (filter !== 'all') query = query.eq('status', filter)
      const { data, error } = await query.range(from, to)
      if (error) throw error
      return (data as unknown as BillboardRow[]).map(toBillboard)
    },
  )
}

export function useFlaggedBillboardCount() {
  return useQuery({
    queryKey: queryKeys.adminBillboards.flaggedCount,
    queryFn: async () => {
      const { count, error } = await supabase
        .from('billboards')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'flagged')
      if (error) throw error
      return count ?? 0
    },
  })
}

// Admin status change. Prefers the `admin_set_billboard_status` RPC, which
// also stores the reason and notifies the owner (admins can't insert into
// `notifications` directly — RLS only allows reading/updating one's own).
// Until that migration is applied PostgREST reports the RPC as missing, so
// fall back to the plain update `billboards_update_owner` allows for admins
// (no owner notification in that case).
export async function setBillboardStatusAsAdmin(input: {
  id: string
  status: AdminBillboardStatus
  reason?: string | null
}): Promise<void> {
  const { error } = await supabase.rpc('admin_set_billboard_status', {
    p_billboard_id: input.id,
    p_status: input.status,
    p_reason: input.reason?.trim() || null,
  })
  if (!error) return
  if (!isMissingFunctionError(error)) throw error
  const { error: updateError } = await supabase
    .from('billboards')
    .update({ status: input.status })
    .eq('id', input.id)
  if (updateError) throw updateError
}

export function useAdminSetBillboardStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      id: string
      status: AdminBillboardStatus
      reason?: string | null
    }) => {
      if (input.status === 'flagged' && !input.reason?.trim()) {
        throw new Error('A reason is required to flag a listing')
      }
      await setBillboardStatusAsAdmin(input)
    },
    onSuccess: () => invalidateBillboardLists(qc),
  })
}

// Moderation-style power to reduce/clear a specific listing's price — the
// `billboards_update_owner` RLS policy already allows admins to update any
// billboard row, so this is a plain update, no RPC needed.
export function useSetAdminPriceOverride() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, price }: { id: string; price: number | null }) => {
      const { error } = await supabase
        .from('billboards')
        .update({ admin_price_override_per_day: price })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => invalidateBillboardLists(qc),
  })
}
