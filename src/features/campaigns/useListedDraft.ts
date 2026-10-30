import { useMemo } from 'react'
import {
  useBillboards,
  type BillboardWithDetails,
} from '@/features/billboards/useBillboards'
import { useCampaignStore } from './campaignStore'

// The cart resolved against the live (active-only) listing: billboards that
// were unlisted since being added are excluded from the badge count and the
// campaign, and reported as `staleIds` so the UI can offer to remove them.
export function useListedDraft() {
  const { data, isSuccess } = useBillboards()
  const draftIds = useCampaignStore((s) => s.draftIds)

  return useMemo(() => {
    const byId = new Map((data ?? []).map((b) => [b.id, b]))
    const draftBillboards = draftIds
      .map((id) => byId.get(id))
      .filter((b): b is BillboardWithDetails => Boolean(b))
    const staleIds = isSuccess ? draftIds.filter((id) => !byId.has(id)) : []
    return { draftBillboards, staleIds, count: draftBillboards.length }
  }, [data, isSuccess, draftIds])
}
