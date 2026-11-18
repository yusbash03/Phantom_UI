import { createContext, useContext } from 'react'
import type { CurrentUser, RoleName } from '@/api/types'

export type AuthStatus = 'restoring' | 'authenticated' | 'anonymous'

export interface AuthContextValue {
  status: AuthStatus
  user: CurrentUser | null
  login: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  hasAnyRole: (...roles: RoleName[]) => boolean
}

export const AuthContext = createContext<AuthContextValue | null>(null)

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error('useAuth must be used inside <AuthProvider>')
  return value
}
