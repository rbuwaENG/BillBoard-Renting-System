import { Navigate, Outlet, useLocation } from 'react-router-dom'
// Direct import (not the feature barrel) so the auth pages stay code-split.
import { currentPath, loginPath } from '@/features/auth/redirect'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'
import { ProfileErrorScreen } from './ProfileError'

// Gate a route subtree on the Supabase session + profile role from
// `useAuth`. Renders nothing while the session is still being restored, so a
// signed-in user isn't bounced to /login on a hard refresh. (Role checks here
// are UX only — the database's RLS policies are the real access control.)
// A session whose profile failed to load gets a retry state, not /login.
export function RoleGuard({ allow }: { allow: UserRole[] }) {
  const { user, isLoading, profileError } = useAuth()
  const location = useLocation()

  // Checked before isLoading so the retry card stays up while retrying.
  if (!user && profileError) return <ProfileErrorScreen />
  if (isLoading) return null
  if (!user) return <Navigate to={loginPath(currentPath(location))} replace />
  if (!allow.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
