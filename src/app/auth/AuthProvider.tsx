import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import { invalidateSession, onSessionExpired, refreshSession, setAccessToken } from '@/api/session'
import type { CurrentUser, RoleName } from '@/api/types'
import { AuthContext, type AuthContextValue, type AuthStatus } from './auth-context'

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<AuthStatus>('restoring')
  const [user, setUser] = useState<CurrentUser | null>(null)

  const clear = useCallback(() => {
    invalidateSession()
    setUser(null)
    setStatus('anonymous')
    void queryClient.cancelQueries()
    queryClient.clear()
  }, [queryClient])

  // Restore the session from the HttpOnly refresh cookie on first load.
  useEffect(() => {
    let cancelled = false
    refreshSession()
      .then((session) => {
        if (cancelled) return
        setUser(session?.user ?? null)
        setStatus(session ? 'authenticated' : 'anonymous')
      })
      .catch(() => {
        if (!cancelled) setStatus('anonymous')
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => onSessionExpired(clear), [clear])

  const login = useCallback(async (email: string, password: string) => {
    const session = unwrap(await api.POST('/api/v1/auth/login', { body: { email, password } }))
    setAccessToken(session.accessToken)
    setUser(session.user)
    setStatus('authenticated')
  }, [])

  const logout = useCallback(async () => {
    try {
      await api.POST('/api/v1/auth/logout')
    } finally {
      clear()
    }
  }, [clear])

  const value = useMemo<AuthContextValue>(
    () => ({
      status,
      user,
      login,
      logout,
      hasAnyRole: (...roles: RoleName[]) => roles.some((role) => user?.roles.includes(role) ?? false),
    }),
    [status, user, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
