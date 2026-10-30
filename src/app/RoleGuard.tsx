import { Navigate, Outlet, useLocation } from 'react-router-dom'
// Direct import (not the feature barrel) so the auth pages stay code-split.
import { currentPath, loginPath } from '@/features/auth/redirect'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

// Gate a route subtree on the Supabase session + profile role from
// `useAuth`. Renders nothing while the session is still being restored, so a
// signed-in user isn't bounced to /login on a hard refresh. (Role checks here
// are UX only — the database's RLS policies are the real access control.)
export function RoleGuard({ allow }: { allow: UserRole[] }) {
  const { user, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading) return null
  if (!user) return <Navigate to={loginPath(currentPath(location))} replace />
  if (!allow.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
