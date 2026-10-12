import { create } from 'zustand'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  updateProfile: (
    patch: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'photoURL'>>,
  ) => Promise<void>
  signOut: () => Promise<void>
}

function toUserProfile(row: {
  id: string
  display_name: string
  email: string
  phone: string | null
  photo_url: string | null
  role: UserProfile['role']
  status: UserProfile['status']
  created_at: string
}): UserProfile {
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

async function fetchProfile(userId: string): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error || !data) return null
  return toUserProfile(data)
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: true,
  updateProfile: async (patch) => {
    const user = get().user
    if (!user) return
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: patch.displayName ?? user.displayName,
        phone: patch.phone,
        photo_url: patch.photoURL,
      })
      .eq('id', user.uid)
    if (!error) set({ user: { ...user, ...patch } })
  },
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
}))

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    fetchProfile(session.user.id).then((profile) =>
      useAuthStore.setState({ user: profile, isLoading: false }),
    )
  } else {
    useAuthStore.setState({ user: null, isLoading: false })
  }
})

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  return { user, isLoading, role: user?.role ?? null }
}
