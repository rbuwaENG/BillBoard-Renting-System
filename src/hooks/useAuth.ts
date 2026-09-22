import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, UserRole } from '@/types'

interface AuthState {
  user: UserProfile | null
  isLoading: boolean
  setUser: (user: UserProfile | null) => void
  mockLogin: (role: UserRole, displayName?: string) => void
  updateProfile: (
    patch: Partial<Pick<UserProfile, 'displayName' | 'phone' | 'photoURL'>>,
  ) => void
}

const MOCK_DISPLAY_NAMES: Record<UserRole, string> = {
  renter: 'Dev Renter',
  rentor: 'Dev Rentor',
  admin: 'Dev Admin',
}

// Stub session store for the scaffold phase. Phase 2 ("Auth & roles")
// replaces `mockLogin` with a real `onAuthStateChanged` + Firestore profile
// sync — `setUser`/`user`/`isLoading` stay the same shape so nothing else
// (RoleGuard, RootLayout) needs to change when that lands.
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      mockLogin: (role, displayName) =>
        set({
          user: {
            uid: `mock-${role}`,
            displayName: displayName || MOCK_DISPLAY_NAMES[role],
            email: `${role}@example.com`,
            role,
            status: 'active',
            createdAt: new Date().toISOString(),
          },
        }),
      updateProfile: (patch) =>
        set((s) => (s.user ? { user: { ...s.user, ...patch } } : s)),
    }),
    { name: 'billboard-auth-preview' },
  ),
)

export function useAuth() {
  const user = useAuthStore((s) => s.user)
  const isLoading = useAuthStore((s) => s.isLoading)
  return { user, isLoading, role: user?.role ?? null }
}
