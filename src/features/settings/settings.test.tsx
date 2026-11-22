import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { OperationalSettings, SettingsResponse } from '@/api/types'
import { SettingsPage } from './SettingsPage'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const defaults: OperationalSettings = {
  geoWeight: 0.35,
  timeWeight: 0.15,
  categoryWeight: 0.15,
  textWeight: 0.2,
  locationWeight: 0.15,
  geoRadiusMeters: 1500,
  windowHours: 6,
  suggestThreshold: 0.55,
  weatherCacheMinutes: 15,
}

function response(overrides: Partial<SettingsResponse> = {}): SettingsResponse {
  return { values: defaults, defaults, isCustomised: false, updatedBy: null, updatedAt: null, ...overrides }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('SettingsPage', () => {
  it('shows each value with its default and saves the change against the version that was read', async () => {
    let body: unknown
    server.use(
      http.get('/api/v1/settings', () => HttpResponse.json(response())),
      http.put('/api/v1/settings', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(
          response({ values: { ...defaults, suggestThreshold: 0.7 }, isCustomised: true, updatedAt: '2026-11-22T10:00:00Z', updatedBy: { id: 'a1', displayName: 'Ada Admin' } }),
        )
      }),
    )
    renderPage()

    const threshold = await screen.findByLabelText('Suggestion threshold')
    expect(threshold).toHaveValue(0.55)
    expect(screen.getByText(/Default 1500 m\./)).toBeInTheDocument()
    expect(screen.getByText('Using the configured defaults.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    await userEvent.clear(threshold)
    await userEvent.type(threshold, '0.7')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(body).toEqual({ values: { ...defaults, suggestThreshold: 0.7 }, expectedUpdatedAt: null }))
    expect(await screen.findByText(/Some values differ from the configured defaults\. Last changed by Ada Admin on/)).toBeInTheDocument()
    expect(screen.getByLabelText('Suggestion threshold')).toHaveValue(0.7)
  })

  it('catches out-of-range values before saving', async () => {
    let saved = false
    server.use(
      http.get('/api/v1/settings', () => HttpResponse.json(response())),
      http.put('/api/v1/settings', () => {
        saved = true
        return HttpResponse.json(response())
      }),
    )
    renderPage()

    const radius = await screen.findByLabelText(/Distance radius/)
    await userEvent.clear(radius)
    await userEvent.type(radius, '10')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Must be between 50 and 100000 m.')
    expect(saved).toBe(false)
  })

  it('explains a conflicting change and loads the latest values', async () => {
    let reads = 0
    server.use(
      http.get('/api/v1/settings', () => {
        reads += 1
        return HttpResponse.json(reads === 1 ? response() : response({ values: { ...defaults, windowHours: 12 }, isCustomised: true, updatedAt: '2026-11-22T11:00:00Z' }))
      }),
      http.put('/api/v1/settings', () => HttpResponse.json({ title: 'These settings were changed by someone else.' }, { status: 409 })),
    )
    renderPage()

    const cache = await screen.findByLabelText(/Weather cache/)
    await userEvent.clear(cache)
    await userEvent.type(cache, '30')
    await userEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(reads).toBe(2))
    expect(await screen.findByLabelText(/Time window/)).toHaveValue(12)
    expect(screen.getByRole('alert')).toHaveTextContent('Someone else changed these settings while you were editing.')
  })

  it('fills in the defaults on request', async () => {
    server.use(http.get('/api/v1/settings', () => HttpResponse.json(response({ values: { ...defaults, textWeight: 0.6 }, isCustomised: true, updatedAt: '2026-11-22T10:00:00Z' }))))
    renderPage()

    expect(await screen.findByLabelText('Text weight')).toHaveValue(0.6)
    await userEvent.click(screen.getByRole('button', { name: /use defaults/i }))
    expect(screen.getByLabelText('Text weight')).toHaveValue(0.2)
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeEnabled()
  })
})
