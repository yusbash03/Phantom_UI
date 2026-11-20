import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { IncidentDetail, RelationResponse, RoleName } from '@/api/types'
import { TestAuth } from '@/test/auth'
import { RelationsPanel } from './RelationsPanel'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const SELF = '0193a7a0-0000-7000-8000-0000000000b1'
const OTHER = '0193a7a0-0000-7000-8000-0000000000b2'

const incident = {
  id: SELF,
  number: 'PH-2026-000200',
  title: 'Smoke at the yard gate',
  createdAt: '2026-11-20T09:10:00Z',
} as IncidentDetail

function relation(overrides: Partial<RelationResponse> = {}): RelationResponse {
  return {
    id: 'rel-1',
    type: 'PossibleDuplicate',
    score: 0.82,
    explanation: 'Reported 140 m apart, 12 min apart, same category, 54% word overlap',
    signals: null,
    other: {
      id: OTHER,
      number: 'PH-2026-000199',
      title: 'Fire at the yard',
      status: 'Reported',
      category: 'Fire',
      approvedSeverity: null,
      locationText: 'Yard gate, Dock Road',
      createdAt: '2026-11-20T08:58:00Z',
    },
    primaryIncidentId: null,
    createdBy: null,
    createdAt: '2026-11-20T09:10:01Z',
    decidedBy: null,
    decidedAt: null,
    availableDecisions: ['ConfirmDuplicate', 'Related', 'Unrelated'],
    confirmablePrimaryIds: [SELF, OTHER],
    ...overrides,
  }
}

function renderPanel(roles: RoleName[] = ['IncidentCoordinator']) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TestAuth roles={roles}>
        <MemoryRouter>
          <RelationsPanel incident={incident} />
        </MemoryRouter>
      </TestAuth>
    </QueryClientProvider>,
  )
}

describe('RelationsPanel', () => {
  it('shows a suggestion with its score, explanation and the other incident, flagged for review', async () => {
    server.use(http.get(`/api/v1/incidents/${SELF}/relations`, () => HttpResponse.json([relation()])))
    renderPanel()

    expect(await screen.findByText('Possible duplicate · 82% match')).toBeInTheDocument()
    expect(screen.getByText('1 to review')).toBeInTheDocument()
    expect(screen.getByText(/140 m apart/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'PH-2026-000199' })).toHaveAttribute('href', `/incidents/${OTHER}`)
    expect(screen.getByText('Suggested automatically')).toBeInTheDocument()
  })

  it('confirms a duplicate keeping the earlier incident open by default', async () => {
    let body: unknown
    server.use(
      http.get(`/api/v1/incidents/${SELF}/relations`, () => HttpResponse.json([relation()])),
      http.put('/api/v1/relations/rel-1', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'rel-1', type: 'ConfirmedDuplicate', primaryIncidentId: OTHER, decidedAt: '2026-11-20T09:20:00Z' })
      }),
    )
    renderPanel()

    await userEvent.click(await screen.findByRole('button', { name: /confirm duplicate/i }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByRole('radio', { name: /PH-2026-000199/ })).toBeChecked()
    expect(within(dialog).getByText(/no report is deleted/i)).toBeInTheDocument()

    await userEvent.click(within(dialog).getByRole('button', { name: 'Close PH-2026-000200 as duplicate' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({ decision: 'ConfirmDuplicate', primaryIncidentId: OTHER })
  })

  it('offers only the valid primary when one incident can no longer be closed as a duplicate', async () => {
    server.use(http.get(`/api/v1/incidents/${SELF}/relations`, () => HttpResponse.json([relation({ confirmablePrimaryIds: [SELF] })])))
    renderPanel()

    await userEvent.click(await screen.findByRole('button', { name: /confirm duplicate/i }))
    const dialog = await screen.findByRole('dialog')

    expect(within(dialog).getAllByRole('radio')).toHaveLength(1)
    expect(within(dialog).getByRole('radio', { name: /this incident/ })).toBeChecked()
    expect(within(dialog).getByText(/only one choice is possible/i)).toBeInTheDocument()
  })

  it('marks a suggestion as not related', async () => {
    let body: unknown
    server.use(
      http.get(`/api/v1/incidents/${SELF}/relations`, () => HttpResponse.json([relation()])),
      http.put('/api/v1/relations/rel-1', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ id: 'rel-1', type: 'Unrelated', primaryIncidentId: null, decidedAt: '2026-11-20T09:20:00Z' })
      }),
    )
    renderPanel()

    await userEvent.click(await screen.findByRole('button', { name: /not related/i }))

    await waitFor(() => expect(body).toEqual({ decision: 'Unrelated', primaryIncidentId: null }))
  })

  it('links another incident by number', async () => {
    let body: unknown
    server.use(
      http.get(`/api/v1/incidents/${SELF}/relations`, () => HttpResponse.json([])),
      http.post(`/api/v1/incidents/${SELF}/relations`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(relation({ type: 'Related', score: null, createdBy: { id: 'u', displayName: 'C' } }), { status: 201 })
      }),
    )
    renderPanel()

    expect(await screen.findByText('No possible duplicates or linked incidents.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /link incident/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Incident number'), 'ph-2026-000199')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Link incident' }))

    await waitFor(() => expect(body).toEqual({ otherIncidentNumber: 'PH-2026-000199' }))
  })

  it('shows a read-only view to administrators', async () => {
    server.use(
      http.get(`/api/v1/incidents/${SELF}/relations`, () =>
        HttpResponse.json([relation({ availableDecisions: [], confirmablePrimaryIds: [] })]),
      ),
    )
    renderPanel(['Administrator'])

    expect(await screen.findByText('Possible duplicate · 82% match')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /confirm duplicate/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /link incident/i })).not.toBeInTheDocument()
  })

  it('explains a confirmed duplicate from the closed side', async () => {
    server.use(
      http.get(`/api/v1/incidents/${SELF}/relations`, () =>
        HttpResponse.json([relation({ type: 'ConfirmedDuplicate', primaryIncidentId: OTHER, availableDecisions: [], confirmablePrimaryIds: [] })]),
      ),
    )
    renderPanel()

    expect(await screen.findByText(/this incident was closed as a duplicate of PH-2026-000199/i)).toBeInTheDocument()
  })
})
