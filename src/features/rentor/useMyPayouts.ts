import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
import type { Payout } from '@/types'

interface PayoutRow {
  id: string
  owner_id: string
  amount: number
  currency: string
  status: Payout['status']
  scheduled_release_date: string
  approved_by: string
  approved_at: string
  released_at: string | null
  created_at: string
}

function toPayout(row: PayoutRow): Payout {
  return {
    id: row.id,
    ownerId: row.owner_id,
    amount: row.amount,
    currency: row.currency,
    status: row.status,
    scheduledReleaseDate: row.scheduled_release_date,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    releasedAt: row.released_at ?? undefined,
    createdAt: row.created_at,
  }
}

export function useMyPayouts() {
  const { user } = useAuth()
  return useQuery({
    queryKey: ['my-payouts', user?.uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('payouts')
        .select('*')
        .eq('owner_id', user!.uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as PayoutRow[]).map(toPayout)
    },
    enabled: !!user,
  })
}
