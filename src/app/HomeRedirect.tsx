import { Navigate } from 'react-router'
import { useAuth } from '@/app/auth/auth-context'

/** Sends each role to the first screen it can use. Updated as Phase 3 screens arrive. */
export function HomeRedirect() {
  const { hasAnyRole } = useAuth()
  return <Navigate to={hasAnyRole('Administrator', 'IncidentCoordinator') ? '/incidents' : '/account'} replace />
}
