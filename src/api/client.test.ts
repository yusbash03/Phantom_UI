import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { api } from './client'
import { getAccessToken, onSessionExpired, setAccessToken } from './session'

const session = (token: string) => ({
  accessToken: token,
  accessTokenExpiresAt: new Date(Date.now() + 900_000).toISOString(),
  user: { id: '1', email: 'a@b.c', displayName: 'A', roles: ['Administrator'] },
})
const page = { items: [], page: 1, pageSize: 20, totalCount: 0 }

let refreshCalls = 0
let refreshSucceeds = true
const server = setupServer(
  http.post('*/api/v1/auth/refresh', () => {
    refreshCalls++
    return refreshSucceeds ? HttpResponse.json(session('fresh-token')) : HttpResponse.json({ title: 'expired' }, { status: 401 })
  }),
  http.get('*/api/v1/users', ({ request }) =>
    request.headers.get('Authorization') === 'Bearer fresh-token' ? HttpResponse.json(page) : HttpResponse.json({ title: 'Unauthorized' }, { status: 401 }),
  ),
)

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterAll(() => server.close())
beforeEach(() => {
  refreshCalls = 0
  refreshSucceeds = true
  setAccessToken('stale-token')
})

describe('authFetch', () => {
  it('refreshes once for concurrent 401s and retries every request with the new token', async () => {
    const results = await Promise.all([api.GET('/api/v1/users'), api.GET('/api/v1/users'), api.GET('/api/v1/users')])

    expect(results.every((r) => r.response.status === 200)).toBe(true)
    // Single flight matters: the server treats reuse of a rotated refresh token as theft.
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBe('fresh-token')
  })

  it('ends the session when the refresh token is rejected', async () => {
    refreshSucceeds = false
    const expired = vi.fn()
    const unsubscribe = onSessionExpired(expired)

    const result = await api.GET('/api/v1/users')

    expect(result.response.status).toBe(401)
    expect(expired).toHaveBeenCalledOnce()
    expect(getAccessToken()).toBeNull()
    unsubscribe()
  })
})
