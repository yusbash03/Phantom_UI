import createClient from 'openapi-fetch'
import type { paths } from './generated/schema'
import { currentSessionGeneration, getAccessToken, notifySessionExpired, refreshSession } from './session'

const AUTH_PATHS = ['/api/v1/auth/login', '/api/v1/auth/refresh', '/api/v1/auth/logout']

function withToken(request: Request, token: string | null): Request {
  const next = new Request(request)
  if (token) next.headers.set('Authorization', `Bearer ${token}`)
  return next
}

/** Adds the bearer token; on 401 refreshes once and retries the original request. */
export async function authFetch(request: Request): Promise<Response> {
  const retryable = request.clone()
  const generation = currentSessionGeneration()
  const response = await fetch(withToken(request, getAccessToken()))
  const path = new URL(request.url, window.location.origin).pathname
  if (response.status !== 401 || AUTH_PATHS.includes(path)) return response

  const session = await refreshSession().catch(() => null)
  if (!session) {
    // Only end the session if it is still the one this request belonged to.
    if (generation === currentSessionGeneration()) notifySessionExpired()
    return response
  }
  return fetch(withToken(retryable, session.accessToken))
}

export const api = createClient<paths>({ baseUrl: window.location.origin, fetch: authFetch })
