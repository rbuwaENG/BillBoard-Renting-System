import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { useAuth } from '@/hooks/useAuth'
import { uniqueChannelName } from '@/lib/realtime'
import { supabase } from '@/lib/supabase'
import type { Notification } from '@/types'

interface NotificationRow {
  id: string
  user_id: string
  type: string
  message: string
  read: boolean
  ref_id: string | null
  created_at: string
}

function toNotification(row: NotificationRow): Notification {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    message: row.message,
    read: row.read,
    refId: row.ref_id ?? undefined,
    createdAt: row.created_at,
  }
}

export function useMyNotifications() {
  const { user } = useAuth()
  // Depend on the id, not the profile object — the object is replaced on
  // every auth state change (e.g. token refresh), which would otherwise tear
  // the subscription down and rebuild it.
  const uid = user?.uid
  const qc = useQueryClient()

  useEffect(() => {
    if (!uid) return
    const channel = supabase
      .channel(uniqueChannelName(`notifications:${uid}`))
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${uid}`,
        },
        () => qc.invalidateQueries({ queryKey: ['notifications', uid] }),
      )
      .subscribe()
    return () => {
      supabase.removeChannel(channel)
    }
  }, [uid, qc])

  return useQuery({
    queryKey: ['notifications', uid],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30)
      if (error) throw error
      return (data as NotificationRow[]).map(toNotification)
    },
    enabled: !!uid,
  })
}

export function useMarkNotificationsRead() {
  const { user } = useAuth()
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (ids: string[]) => {
      if (ids.length === 0) return
      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .in('id', ids)
      if (error) throw error
    },
    onSuccess: () =>
      qc.invalidateQueries({ queryKey: ['notifications', user?.uid] }),
  })
}
