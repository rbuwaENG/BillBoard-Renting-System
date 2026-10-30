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

// admin_list_users caps a page at 1000 rows.
const ADMIN_USERS_PAGE = 1000

// email/phone aren't readable through the profiles table (0030 column
// grants), so admins list users via the admin_list_users RPC. Fetches every
// page so the panel's client-side search/paging sees all users, newest first.
export function useAllUsers() {
  return useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const rows: ProfileRow[] = []
      for (;;) {
        const { data, error } = await supabase.rpc('admin_list_users', {
          p_limit: ADMIN_USERS_PAGE,
          p_offset: rows.length,
        })
        if (error) throw error
        const page = (data ?? []) as ProfileRow[]
        rows.push(...page)
        if (page.length < ADMIN_USERS_PAGE) break
      }
      return rows.map(toUserProfile)
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
