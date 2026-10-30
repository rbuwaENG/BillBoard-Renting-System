import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/hooks/useAuth'
import { invalidateBooking, queryKeys } from '@/lib/queryKeys'
import { supabase } from '@/lib/supabase'

export interface CampaignItem {
  billboardId: string
  bookingId: string | null
  status: 'pending' | 'booked' | 'failed'
  failureReason: string | null
  billboardTitle: string
}

export interface Campaign {
  id: string
  name: string
  startDate: string
  endDate: string
  createdAt: string
  items: CampaignItem[]
}

interface CampaignRow {
  id: string
  name: string
  start_date: string
  end_date: string
  created_at: string
  campaign_items: {
    billboard_id: string
    booking_id: string | null
    status: CampaignItem['status']
    failure_reason: string | null
    billboards: { title: string } | null
  }[]
}

function toCampaign(row: CampaignRow): Campaign {
  return {
    id: row.id,
    name: row.name,
    startDate: row.start_date,
    endDate: row.end_date,
    createdAt: row.created_at,
    items: row.campaign_items.map((item) => ({
      billboardId: item.billboard_id,
      bookingId: item.booking_id,
      status: item.status,
      failureReason: item.failure_reason,
      billboardTitle: item.billboards?.title ?? 'Billboard',
    })),
  }
}

export function useMyCampaigns() {
  const { user } = useAuth()
  return useQuery({
    queryKey: queryKeys.myCampaigns(user?.uid),
    queryFn: async () => {
      const { data, error } = await supabase
        .from('campaigns')
        .select(
          '*, campaign_items(billboard_id, booking_id, status, failure_reason, billboards(title))',
        )
        .eq('renter_id', user!.uid)
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as unknown as CampaignRow[]).map(toCampaign)
    },
    enabled: !!user,
  })
}

export function useCreateCampaign() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: {
      name: string
      startDate: string
      endDate: string
      billboardIds: string[]
    }) => {
      const { error } = await supabase.rpc('create_campaign', {
        p_name: input.name,
        p_start_date: input.startDate,
        p_end_date: input.endDate,
        p_billboard_ids: input.billboardIds,
      })
      if (error) throw error
    },
    onSuccess: () => {
      invalidateBooking(qc)
    },
  })
}
