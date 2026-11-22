import { ApiError } from './errors'
import type { LoginResponse } from './types'

/*
 * Access token lives in memory only (security steering): never localStorage/sessionStorage.
 * The refresh token is an HttpOnly cookie scoped to /api/v1/auth that script cannot read.
 */
let accessToken: string | null = null
let refreshInFlight: Promise<LoginResponse | null> | null = null
/** Bumped on sign-out so a refresh that was already running cannot bring a token back afterwards. */
let sessionGeneration = 0
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
  const generation = sessionGeneration
  if (refreshInFlight) return refreshInFlight
  let flight: Promise<LoginResponse | null> | null = null
  const run = async (): Promise<LoginResponse | null> => {
    try {
      const response = await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'same-origin' })
      if (response.status === 401) {
        if (generation === sessionGeneration) accessToken = null
        return null
      }
      if (!response.ok) throw new ApiError(response.status, await safeJson(response))
      const session = (await response.json()) as LoginResponse
      // Signed out while this was running: discard the token rather than reviving the session.
      if (generation !== sessionGeneration) return null
      accessToken = session.accessToken
      return session
    } finally {
      // Only clear the slot if it still holds this request (sign-out may have replaced it).
      if (refreshInFlight === flight) refreshInFlight = null
    }
  }
  flight = run()
  refreshInFlight = flight
  return flight
}

/** Ends the session in this tab: forgets the token and disowns any refresh still in flight. */
export function invalidateSession(): void {
  sessionGeneration += 1
  accessToken = null
  refreshInFlight = null
}

/** Lets callers drop results that belong to a session that has since ended. */
export function currentSessionGeneration(): number {
  return sessionGeneration
}

async function safeJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    return undefined
  }
}
