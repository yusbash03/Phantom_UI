import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import type { ActivityEvent, DashboardSummary, MapIncident } from '@/api/types'
import { TestAuth } from '@/test/auth'
import { DashboardPage } from './DashboardPage'

// Mapbox GL needs WebGL, which jsdom lacks; Playwright covers the real map.
vi.mock('@/features/map/IncidentMap', () => ({
  default: ({ items }: { items: MapIncident[] }) => <div aria-label="Mini map">{items.length} markers</div>,
}))

const server = setupServer(
  http.get('/api/v1/incidents/map', () => HttpResponse.json({ items: [], withoutCoordinates: 2, truncated: false })),
)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const summary: DashboardSummary = {
  totalIncidents: 128,
  activeIncidents: 17,
  highPriorityActiveIncidents: 3,
  awaitingReview: 0,
  unassignedVerified: 4,
  assignmentsAwaitingAcknowledgement: 2,
  availableResponders: 9,
  generatedAt: '2026-11-20T09:00:00Z',
}

const incident = { id: 'i1', number: 'PH-2026-000123', title: 'Flooded underpass' }

function activity(overrides: Partial<ActivityEvent>): ActivityEvent {
  return {
    id: crypto.randomUUID(),
    occurredAt: new Date().toISOString(),
    kind: 'Decision',
    actorType: 'User',
    actor: { id: 'c1', displayName: 'Chidi Coordinator' },
    action: 'incident.status_changed',
    summary: 'Status changed from Under review to Verified',
    isAi: false,
    incident,
    ...overrides,
  }
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TestAuth roles={['IncidentCoordinator']}>
        <MemoryRouter>
          <DashboardPage />
        </MemoryRouter>
      </TestAuth>
    </QueryClientProvider>,
  )
}

describe('DashboardPage', () => {
  it('shows every figure exactly as the API counted it, with links to the matching lists', async () => {
    server.use(
      http.get('/api/v1/dashboard/summary', () => HttpResponse.json(summary)),
      http.get('/api/v1/dashboard/activity', () => HttpResponse.json([])),
    )
    renderPage()

    const figures = await screen.findByRole('region', { name: 'Key figures' })
    expect(await within(figures).findByRole('link', { name: /^Active incidents\s*17\b/ })).toHaveAttribute('href', '/incidents')
    expect(within(figures).getByRole('link', { name: /^Total incidents\s*128\b/ })).toHaveAttribute('href', '/incidents?status=all')
    expect(within(figures).getByRole('link', { name: /^Verified, unassigned\s*4\b/ })).toHaveAttribute('href', '/incidents?status=Verified')
    expect(within(figures).getByRole('link', { name: /^Available responders\s*9\b/ })).toHaveAttribute('href', '/responders')
    const tiles: [string, string][] = [
      ['High priority', '3'],
      ['Awaiting review', '0'],
      ['Awaiting acknowledgement', '2'],
    ]
    for (const [label, value] of tiles) {
      const tile = within(figures).getByText(label).closest('li')!
      expect(within(tile).getByText(value)).toBeInTheDocument()
    }
    expect(screen.getByText(/counted from live records at/i)).toBeInTheDocument()
  })

  it('lists recent activity with the incident, who acted, and AI marked as AI', async () => {
    server.use(
      http.get('/api/v1/dashboard/summary', () => HttpResponse.json(summary)),
      http.get('/api/v1/dashboard/activity', () =>
        HttpResponse.json([
          activity({}),
          activity({ kind: 'Ai', actorType: 'System', actor: null, action: 'ai_analysis.completed', summary: 'AI recommended High severity and category Flood', isAi: true }),
        ]),
      ),
    )
    renderPage()

    const list = await screen.findByRole('list', { name: 'Recent activity' })
    const [decision, ai] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement]
    expect(within(decision).getByRole('link', { name: 'PH-2026-000123' })).toHaveAttribute('href', '/incidents/i1')
    expect(within(decision).getByText(/Chidi Coordinator/)).toBeInTheDocument()
    expect(within(decision).queryByText('AI')).not.toBeInTheDocument()
    expect(within(ai).getByText('AI')).toBeInTheDocument()
    expect(within(ai).getByText(/PHANTOM \(automatic\)/)).toBeInTheDocument()
  })

  it('says how many open incidents cannot be plotted', async () => {
    server.use(
      http.get('/api/v1/dashboard/summary', () => HttpResponse.json(summary)),
      http.get('/api/v1/dashboard/activity', () => HttpResponse.json([])),
    )
    renderPage()

    expect(await screen.findByText(/2 without coordinates \(not shown\)/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /full map/i })).toHaveAttribute('href', '/map')
    expect(await screen.findByText('Nothing has happened yet.')).toBeInTheDocument()
  })

  it('shows an error with retry when the figures cannot be loaded, rather than any placeholder numbers', async () => {
    server.use(
      http.get('/api/v1/dashboard/summary', () => HttpResponse.json({ title: 'Boom' }, { status: 500 })),
      http.get('/api/v1/dashboard/activity', () => HttpResponse.json([])),
    )
    renderPage()

    expect(await screen.findByText('The figures could not be loaded')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(screen.queryByText('Active incidents')).not.toBeInTheDocument()
  })
})
