import { useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import type { UserProfile, UserRole } from '@/types'

// Role/status changes from the Users panel. `profiles_update_own` lets an
// admin update any profile, and the `protect_profile_role_status` trigger
// only lets admins change these two columns. Kept apart from useUsers.ts,
// whose read path is being reworked for the profile-privacy contract.

export function useSetUserRole() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ uid, role }: { uid: string; role: UserRole }) => {
      const { error } = await supabase
        .from('profiles')
        .update({ role })
        .eq('id', uid)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin-users'] }),
  })
}

export function useSetUserStatus() {
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
