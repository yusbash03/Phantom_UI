import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { MapIncident } from '@/api/types'
import { OperationsMapPage } from './OperationsMapPage'

// Mapbox GL needs WebGL, which jsdom lacks; Playwright covers the real map.
vi.mock('./IncidentMap', () => ({
  default: ({ items, onSelect }: { items: MapIncident[]; onSelect: (id: string) => void }) => (
    <div aria-label="Operations map">
      {items.map((i) => (
        <button key={i.id} type="button" onClick={() => onSelect(i.id)}>
          marker {i.number}
        </button>
      ))}
    </div>
  ),
}))

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const geocoded: MapIncident = {
  id: 'a',
  number: 'PH-2026-000601',
  title: 'Transformer fire',
  category: 'Fire',
  status: 'Reported',
  approvedSeverity: null,
  aiRecommendedSeverity: 'High',
  latitude: 6.603149,
  longitude: 3.351186,
  provenance: 'Geocoded',
  precision: 'Street',
  isVerified: false,
  locationText: 'Allen Avenue roundabout',
  geocoderPlaceName: 'Allen Avenue, Ikeja, Lagos',
  createdAt: '2026-11-20T08:00:00Z',
  isDemoData: false,
}

const verified: MapIncident = {
  ...geocoded,
  id: 'b',
  number: 'PH-2026-000602',
  title: 'Flooded underpass',
  category: 'Flood',
  status: 'Verified',
  approvedSeverity: 'Critical',
  provenance: 'ManuallyVerified',
  precision: 'Exact',
  isVerified: true,
  geocoderPlaceName: null,
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/map']}>
        <OperationsMapPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('OperationsMapPage', () => {
  it('loads open incidents and is honest about what it cannot plot', async () => {
    let url: URL | undefined
    server.use(
      http.get('/api/v1/incidents/map', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ items: [geocoded, verified], withoutCoordinates: 3, truncated: true })
      }),
    )
    renderPage()

    expect(await screen.findByText('(2)')).toBeInTheDocument()
    expect(url?.searchParams.getAll('Status')).toEqual(['Reported', 'UnderReview', 'Verified', 'Assigned', 'InProgress'])
    expect(screen.getByText(/3 matching incidents have no coordinates and are not shown/)).toBeInTheDocument()
    expect(screen.getByText(/only the 1,000 most recent incidents are shown/i)).toBeInTheDocument()
    const list = screen.getByRole('list', { name: 'Incidents on the map' })
    expect(within(list).getAllByText('Unverified')).toHaveLength(1)
  })

  it('shows provenance and the geocoder match for the selected incident', async () => {
    server.use(http.get('/api/v1/incidents/map', () => HttpResponse.json({ items: [geocoded, verified], withoutCoordinates: 0, truncated: false })))
    renderPage()

    await userEvent.click(await screen.findByRole('button', { name: 'marker PH-2026-000601' }))
    const card = await screen.findByRole('heading', { name: 'Transformer fire' })
    const details = card.closest('[aria-labelledby="selected-incident-title"]') as HTMLElement
    expect(within(details).getByText('Geocoded, approximate')).toBeInTheDocument()
    expect(within(details).getByText('Matched as “Allen Avenue, Ikeja, Lagos”')).toBeInTheDocument()
    expect(within(details).getByText(/street precision/)).toBeInTheDocument()
    expect(within(details).getByText('Not yet assessed')).toBeInTheDocument()
    expect(within(details).getByRole('link', { name: 'Open incident' })).toHaveAttribute('href', '/incidents/a')

    await userEvent.click(within(screen.getByRole('list', { name: 'Incidents on the map' })).getByRole('button', { name: /PH-2026-000602/ }))
    const second = (await screen.findByRole('heading', { name: 'Flooded underpass' })).closest('[aria-labelledby="selected-incident-title"]') as HTMLElement
    expect(within(second).getByText('Verified by a coordinator')).toBeInTheDocument()
    expect(within(second).queryByText(/Matched as/)).not.toBeInTheDocument()
  })

  it('labels demonstration incidents as demo data in the list and the details', async () => {
    const demo = { ...geocoded, id: 'demo', number: 'PH-2026-000900', title: 'Demo: Smoke from a market stall', isDemoData: true }
    server.use(http.get('/api/v1/incidents/map', () => HttpResponse.json({ items: [demo, verified], withoutCoordinates: 0, truncated: false })))
    renderPage()

    const list = await screen.findByRole('list', { name: 'Incidents on the map' })
    expect(within(list).getAllByText('Demo data')).toHaveLength(1)
    await userEvent.click(within(list).getByRole('button', { name: /PH-2026-000900/ }))
    const details = screen.getByRole('heading', { name: 'Demo: Smoke from a market stall' }).closest('[aria-labelledby]') as HTMLElement
    expect(within(details).getByText('Demo data')).toBeInTheDocument()
  })

  it('sends filter choices to the API', async () => {
    const requests: URL[] = []
    server.use(
      http.get('/api/v1/incidents/map', ({ request }) => {
        requests.push(new URL(request.url))
        return HttpResponse.json({ items: [], withoutCoordinates: 0, truncated: false })
      }),
    )
    renderPage()
    expect(await screen.findByText('Nothing to plot')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('combobox', { name: /filter by category/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Flood' }))
    await userEvent.click(screen.getByRole('combobox', { name: /filter by approved severity/i }))
    await userEvent.click(await screen.findByRole('option', { name: 'Critical' }))

    await waitFor(() => {
      const last = requests.at(-1)
      expect(last?.searchParams.get('Category')).toBe('Flood')
      expect(last?.searchParams.get('Severity')).toBe('Critical')
    })
  })

  it('shows an error with retry when the map data fails', async () => {
    server.use(http.get('/api/v1/incidents/map', () => HttpResponse.json({ title: 'Boom' }, { status: 500 })))
    renderPage()

    expect(await screen.findByText('Map data could not be loaded')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})
