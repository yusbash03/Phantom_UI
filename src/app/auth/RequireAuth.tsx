import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router'
import type { RoleName } from '@/api/types'
import { FullPageLoader } from '@/components/feedback/LoadingState'
import { ForbiddenState } from '@/components/feedback/ErrorState'
import { useAuth } from './auth-context'

/**
 * Hides routes the user cannot use. This is a convenience only — the API enforces every
 * permission (security steering).
 */
export function RequireAuth({ roles, children }: { roles?: RoleName[]; children: ReactNode }) {
  const { status, hasAnyRole } = useAuth()
  const location = useLocation()

  if (status === 'restoring') return <FullPageLoader label="Restoring your session" />
  if (status === 'anonymous') {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />
  }
  if (roles && !hasAnyRole(...roles)) return <ForbiddenState />
  return <>{children}</>
}
