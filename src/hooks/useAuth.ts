import { create } from 'zustand'
import { queryClient } from '@/lib/queryClient'
import { supabase } from '@/lib/supabase'
import type { UserProfile } from '@/types'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  // Set when a session exists but the profile couldn't be loaded (network,
  // RLS, missing row). `user` is null in that case, but the visitor is not
  // "logged out" — callers can show an error and offer `reloadProfile`.
  profileError: Error | null
  reloadProfile: () => Promise<void>
  // Throws on failure. `phone`/`photoURL` set to undefined clear the field.
  updateProfile: (
    patch: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'photoURL'>>,
  ) => Promise<void>
  signOut: () => Promise<void>
}

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

// email/phone are not readable through the table (0030 column grants), so
// the own profile comes from the get_my_profile RPC.
async function fetchProfile(): Promise<UserProfile> {
  const { data, error } = await supabase.rpc('get_my_profile')
  if (error) throw error
  if (!data) throw new Error('Profile not found')
  return toUserProfile(data as ProfileRow)
}

function toError(err: unknown): Error {
  if (err instanceof Error) return err
  if (err && typeof err === 'object' && 'message' in err)
    return new Error(String((err as { message: unknown }).message))
  return new Error('Could not load your profile')
}

// Guards against an older, slower fetch overwriting a newer auth state.
let loadSeq = 0

async function loadProfile() {
  const seq = ++loadSeq
  try {
    const profile = await fetchProfile()
    if (seq !== loadSeq) return
    useAuthStore.setState({
      user: profile,
      isLoading: false,
      profileError: null,
    })
  } catch (err) {
    if (seq !== loadSeq) return
    useAuthStore.setState({
      user: null,
      isLoading: false,
      profileError: toError(err),
    })
  }
}

export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isLoading: true,
  profileError: null,
  reloadProfile: async () => {
    set({ isLoading: true })
    await loadProfile()
  },
  updateProfile: async (patch) => {
    const user = get().user
    if (!user) throw new Error('Not signed in')
    const next = {
      displayName: patch.displayName ?? user.displayName,
      phone: 'phone' in patch ? patch.phone : user.phone,
      photoURL: 'photoURL' in patch ? patch.photoURL : user.photoURL,
    }
    // No `.select()`: RETURNING email/phone would be denied by the column
    // grants, and we already know the new values.
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: next.displayName,
        phone: next.phone ?? null,
        photo_url: next.photoURL ?? null,
      })
      .eq('id', user.uid)
    if (error) throw error
    set({ user: { ...user, ...next } })
  },
  signOut: async () => {
    loadSeq++
    await supabase.auth.signOut()
    set({ user: null, profileError: null })
    // Drop every cached query so the next account never sees this one's data.
    queryClient.clear()
  },
}))

supabase.auth.onAuthStateChange((_event, session) => {
  if (session?.user) {
    // Deferred: supabase-js holds its auth lock while this callback runs, and
    // the RPC needs the session.
    setTimeout(() => void loadProfile(), 0)
  } else {
    loadSeq++
    useAuthStore.setState({ user: null, isLoading: false, profileError: null })
  }
})

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  const profileError = useAuthStore((s) => s.profileError)
  return { user, isLoading, profileError, role: user?.role ?? null }
}
