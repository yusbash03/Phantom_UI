import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { EnvironmentResponse, IncidentDetail, WeatherReading } from '@/api/types'
import { keysFor } from '@/features/realtime/events'
import { formatField, orderedFields } from './weather'
import { WeatherPanel } from './WeatherPanel'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ID = '0193a7a0-0000-7000-8000-0000000000e1'
const reading: WeatherReading = {
  observedAt: '2026-11-20T20:45:00Z',
  temperatureC: 28.6,
  precipitationMm: 0,
  rainMm: 0,
  windSpeedKmh: 11.3,
  windDirectionDegrees: 216,
  windGustsKmh: 22.3,
  visibilityMetres: 21100,
}

function environment(overrides: Partial<EnvironmentResponse> = {}): EnvironmentResponse {
  return {
    status: 'Available',
    category: 'Fire',
    locationIsVerified: false,
    isForCurrentLocation: true,
    snapshot: { provider: 'Open-Meteo', retrievedAt: '2026-11-20T20:46:00Z', latitude: 6.46, longitude: 3.4, isFixture: false, reading },
    failure: null,
    alertsSupported: false,
    ...overrides,
  }
}

function renderPanel() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <WeatherPanel incident={{ id: ID } as IncidentDetail} />
    </QueryClientProvider>,
  )
}

const terms = () => within(screen.getByLabelText('Weather reading')).getAllByRole('term').map((t) => t.textContent)

describe('weather helpers', () => {
  it('puts the fields that matter for the incident type first (9.3)', () => {
    expect(orderedFields('Fire').slice(0, 3).map((f) => f.field)).toEqual(['windSpeedKmh', 'windDirectionDegrees', 'windGustsKmh'])
    expect(orderedFields('Flood').slice(0, 2).map((f) => f.field)).toEqual(['precipitationMm', 'rainMm'])
    expect(orderedFields('RoadAccident').slice(0, 2).map((f) => f.field)).toEqual(['precipitationMm', 'visibilityMetres'])
    expect(orderedFields('Security').every((f) => !f.relevant)).toBe(true)
  })

  it('formats values with units, a compass point, and says when a value was not reported', () => {
    expect(formatField('windDirectionDegrees', reading)).toBe('SW (216°)')
    expect(formatField('visibilityMetres', reading)).toBe('21.1 km')
    expect(formatField('temperatureC', reading)).toBe('28.6 °C')
    expect(formatField('windGustsKmh', { ...reading, windGustsKmh: null })).toBe('Not reported')
  })

  it('refreshes only the weather when a new snapshot is pushed', () => {
    expect(keysFor({ type: 'EnvironmentUpdated', incidentId: ID, assignmentId: null, responderId: null, at: '' })).toEqual([['incidents', 'environment', ID]])
  })
})

describe('WeatherPanel', () => {
  it('shows a Fire incident’s wind first, with source, retrieval time and the rounded coordinates used', async () => {
    server.use(http.get(`/api/v1/incidents/${ID}/environment`, () => HttpResponse.json(environment())))
    renderPanel()

    expect(await screen.findByText('SW (216°)')).toBeInTheDocument()
    expect(terms().slice(0, 3)).toEqual([
      'Wind speed (relevant to this incident type)',
      'Wind from (relevant to this incident type)',
      'Wind gusts (relevant to this incident type)',
    ])
    expect(screen.getByText(/Source: Open-Meteo · retrieved/)).toHaveTextContent('for 6.46, 3.40 (within about 1 km) · location not yet verified')
    expect(screen.getByText('Context only — not evidence of the emergency or a prediction.')).toBeInTheDocument()
    expect(screen.getByText('Weather alerts are not offered by this provider.')).toBeInTheDocument()
    expect(screen.queryByText(/recorded test fixture/i)).not.toBeInTheDocument()
  })

  it('emphasises precipitation for a flood and labels a recorded fixture', async () => {
    server.use(http.get(`/api/v1/incidents/${ID}/environment`, () =>
      HttpResponse.json(environment({ category: 'Flood', snapshot: { ...environment().snapshot!, isFixture: true, provider: 'Open-Meteo (recorded fixture)' } }))))
    renderPanel()

    expect(await screen.findByText('Recorded test fixture — not live weather')).toBeInTheDocument()
    expect(terms()[0]).toBe('Precipitation (relevant to this incident type)')
  })

  it('says “Weather unavailable” with the reason, keeps the last reading, and can retry', async () => {
    let refreshed = false
    server.use(
      http.get(`/api/v1/incidents/${ID}/environment`, () =>
        HttpResponse.json(environment({ status: 'Unavailable', failure: { reason: 'Timeout', message: 'The weather provider did not respond within 5 seconds.', at: '2026-11-20T21:00:00Z' } })),
      ),
      http.post(`/api/v1/incidents/${ID}/environment/refresh`, () => {
        refreshed = true
        return HttpResponse.json(environment())
      }),
    )
    renderPanel()

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Weather unavailable')
    expect(alert).toHaveTextContent('The weather provider timed out. The weather provider did not respond within 5 seconds.')
    expect(alert).toHaveTextContent('Nothing else about the incident is affected.')
    expect(screen.getByText('Last successful reading:')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: 'Refresh weather' }))
    expect(refreshed).toBe(true)
    expect(await screen.findByText(/Source: Open-Meteo/)).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('explains when there are no coordinates to look up', async () => {
    server.use(http.get(`/api/v1/incidents/${ID}/environment`, () => HttpResponse.json(environment({ status: 'NoCoordinates', snapshot: null }))))
    renderPanel()
    expect(await screen.findByText('No coordinates yet, so weather cannot be looked up.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Refresh weather' })).not.toBeInTheDocument()
  })
})
