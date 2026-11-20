import type { ReactNode } from 'react'
import type { RoleName } from '@/api/types'
import { AuthContext, type AuthContextValue } from '@/app/auth/auth-context'

/** Signed-in auth context for component tests; the API still enforces every permission. */
export function TestAuth({ roles, children }: { roles: RoleName[]; children: ReactNode }) {
  const value: AuthContextValue = {
    status: 'authenticated',
    user: { id: 'u-test', email: 'test@phantom.test', displayName: 'Test User', roles },
    login: () => Promise.resolve(),
    logout: () => Promise.resolve(),
    hasAnyRole: (...wanted) => wanted.some((r) => roles.includes(r)),
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
