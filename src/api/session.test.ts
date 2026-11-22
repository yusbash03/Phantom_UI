import { afterEach, describe, expect, it, vi } from 'vitest'
import { currentSessionGeneration, getAccessToken, invalidateSession, refreshSession } from './session'

afterEach(() => vi.unstubAllGlobals())

describe('session', () => {
  it('discards a refresh that finishes after sign-out, so no token survives logout', async () => {
    let respond!: (r: Response) => void
    vi.stubGlobal('fetch', vi.fn<() => Promise<Response>>(() => new Promise((resolve) => (respond = resolve))))

    const pending = refreshSession()
    const before = currentSessionGeneration()
    invalidateSession()
    respond(new Response(JSON.stringify({ accessToken: 'late-token', user: {} }), { status: 200 }))

    expect(await pending).toBeNull()
    expect(getAccessToken()).toBeNull()
    expect(currentSessionGeneration()).toBe(before + 1)
  })

  it('shares one refresh between concurrent callers and keeps the new token', async () => {
    const fetch = vi.fn<() => Promise<Response>>(() => Promise.resolve(new Response(JSON.stringify({ accessToken: 'fresh', user: {} }), { status: 200 })))
    vi.stubGlobal('fetch', fetch)

    const [a, b] = await Promise.all([refreshSession(), refreshSession()])
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(a?.accessToken).toBe('fresh')
    expect(b).toBe(a)
    expect(getAccessToken()).toBe('fresh')
    invalidateSession()
  })
})
