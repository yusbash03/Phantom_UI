import { ApiError } from './errors'
import type { LoginResponse } from './types'

/*
 * Access token lives in memory only (security steering): never localStorage/sessionStorage.
 * The refresh token is an HttpOnly cookie scoped to /api/v1/auth that script cannot read.
 */
let accessToken: string | null = null
let refreshInFlight: Promise<LoginResponse | null> | null = null
const expiredListeners = new Set<() => void>()

export function getAccessToken(): string | null {
  return accessToken
}

export function setAccessToken(token: string | null): void {
  accessToken = token
}

export function onSessionExpired(listener: () => void): () => void {
  expiredListeners.add(listener)
  return () => expiredListeners.delete(listener)
}

export function notifySessionExpired(): void {
  accessToken = null
  expiredListeners.forEach((listener) => listener())
}

/**
 * Exchanges the refresh cookie for a new access token. Concurrent callers share one request
 * (single flight) because the server treats reuse of a rotated refresh token as theft.
 */
export function refreshSession(): Promise<LoginResponse | null> {
  refreshInFlight ??= (async () => {
    try {
      const response = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      if (response.status === 401) {
        accessToken = null
        return null
      }
      if (!response.ok) throw new ApiError(response.status, await safeJson(response))
      const session = (await response.json()) as LoginResponse
      accessToken = session.accessToken
      return session
    } finally {
      refreshInFlight = null
    }
  })()
  return refreshInFlight
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}
