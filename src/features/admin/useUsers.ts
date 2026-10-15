import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

interface ProfileRow {
  id: string
  display_name: string
  email: string
  phone: string | null
  photo_url: string | null
  role: UserProfile['role']
  status: UserProfile['status']
  created_at: string
}

function toUserProfile(row: ProfileRow): UserProfile {
  return {
    uid: row.id,
    displayName: row.display_name,
    email: row.email,
    phone: row.phone ?? undefined,
    photoURL: row.photo_url ?? undefined,
    role: row.role,
    status: row.status,
    createdAt: row.created_at,
  }
}

export function useAllUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data as ProfileRow[]).map(toUserProfile)
    },
  })
}

export function useToggleUserStatus() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({
      uid,
      status,
    }: {
      uid: string
      status: UserProfile['status']
    }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ status })
        .eq('id', uid)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export function usePromoteToAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (uid: string) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role: 'admin' })
        .eq('id', uid)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export function useInviteAdmin() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: { email: string; name: string }) => {
      const { data, error } = await supabase.functions.invoke(
        'admin-invite-user',
        { body: input },
      )
      if (error) throw error
      if (data?.error) throw new Error(data.error)
      return data
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}
