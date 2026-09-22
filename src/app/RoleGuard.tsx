import { Navigate, Outlet } from 'react-router-dom'
import { useAuth } from '@/hooks/useAuth'
import type { UserRole } from '@/types'

// Phase 2 ("Auth & roles") wires `useAuth` to real Firebase state; until
// then this correctly redirects to /login since no session exists yet.
export function RoleGuard({ allow }: { allow: UserRole[] }) {
  const { user, isLoading } = useAuth()

  if (isLoading) return null
  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.role)) return <Navigate to="/" replace />

  return <Outlet />
}
