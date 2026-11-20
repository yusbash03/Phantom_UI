import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import type { ReactNode } from 'react'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { AuditEntryResponse, IncidentDetail, TimelineEvent } from '@/api/types'
import { TestAuth } from '@/test/auth'
import { IncidentTimeline } from '@/features/incidents/components/IncidentTimeline'
import { AuditLogPage } from './AuditLogPage'

const server = setupServer(
  http.get('/api/v1/audit/facets', () => HttpResponse.json({ actions: ['incident.verified', 'report.submitted'], entityTypes: ['Incident', 'Report'] })),
  http.get('/api/v1/users', () =>
    HttpResponse.json({ items: [{ id: 'u-ada', displayName: 'Ada Admin', email: 'ada@phantom.test', roles: ['Administrator'], isActive: true }], page: 1, pageSize: 100, totalCount: 1 }),
  ),
)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ID = '0193a7a0-0000-7000-8000-0000000000c1'

function wrap(children: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TestAuth roles={['Administrator', 'IncidentCoordinator']}>
        <MemoryRouter>{children}</MemoryRouter>
      </TestAuth>
    </QueryClientProvider>,
  )
}

function event(overrides: Partial<TimelineEvent>): TimelineEvent {
  return {
    id: crypto.randomUUID(),
    occurredAt: '2026-11-20T08:00:00Z',
    kind: 'Decision',
    actorType: 'User',
    actor: { id: 'c1', displayName: 'Chidi Coordinator' },
    action: 'incident.verified',
    summary: 'Incident verified',
    detail: null,
    isAi: false,
    ...overrides,
  }
}

describe('IncidentTimeline', () => {
  it('lists events in order, marks AI and automatic entries, and shows decision details', async () => {
    server.use(
      http.get(`/api/v1/incidents/${ID}/timeline`, () =>
        HttpResponse.json([
          event({ kind: 'Report', actorType: 'Anonymous', actor: null, action: 'report.submitted', summary: 'Report PH-2026-000001 submitted' }),
          event({ kind: 'Ai', actorType: 'System', actor: null, action: 'analysis.succeeded', summary: 'AI analysis completed', detail: 'Recommended severity: High', isAi: true }),
          event({ summary: 'Incident verified', detail: 'Approved severity: High' }),
          event({ kind: 'System', actorType: 'System', actor: null, action: 'incident.status_changed', summary: 'Status changed automatically from Verified to Assigned', detail: 'Because a responder was assigned.' }),
        ]),
      ),
    )
    wrap(<IncidentTimeline incident={{ id: ID, updatedAt: '2026-11-20T08:05:00Z' } as IncidentDetail} />)

    const list = await screen.findByRole('list', { name: 'Incident history' })
    const [report, ai, verified, automatic] = within(list).getAllByRole('listitem') as [HTMLElement, HTMLElement, HTMLElement, HTMLElement]
    const items = [report, ai, verified, automatic]
    expect(items.map((li) => li.querySelector('.font-medium')?.textContent)).toEqual([
      'Report PH-2026-000001 submitted',
      'AI analysis completed',
      'Incident verified',
      'Status changed automatically from Verified to Assigned',
    ])
    expect(within(report).getByText(/member of the public/i)).toBeInTheDocument()
    expect(within(ai).getByText('AI')).toBeInTheDocument()
    expect(within(verified).queryByText('AI')).not.toBeInTheDocument()
    expect(within(verified).getByText('Approved severity: High')).toBeInTheDocument()
    expect(within(verified).getByText(/Chidi Coordinator/)).toBeInTheDocument()
    expect(within(automatic).getByText('System')).toBeInTheDocument()
    expect(within(automatic).getByText('Because a responder was assigned.')).toBeInTheDocument()
  })

  it('says when there is no history', async () => {
    server.use(http.get(`/api/v1/incidents/${ID}/timeline`, () => HttpResponse.json([])))
    wrap(<IncidentTimeline incident={{ id: ID, updatedAt: '2026-11-20T08:05:00Z' } as IncidentDetail} />)
    expect(await screen.findByText('No history recorded yet.')).toBeInTheDocument()
  })
})

function entry(overrides: Partial<AuditEntryResponse> = {}): AuditEntryResponse {
  return {
    id: 41,
    occurredAt: '2026-11-20T08:00:00Z',
    actorType: 'User',
    actor: { id: 'u-ada', displayName: 'Ada Admin' },
    action: 'incident.verified',
    entityType: 'Incident',
    entityId: ID,
    previousValue: '{"status":"UnderReview"}',
    newValue: '{"status":"Verified","approvedSeverity":"High"}',
    metadata: null,
    correlationId: 'corr-1',
    ...overrides,
  }
}

async function chooseOption(trigger: HTMLElement, option: string) {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('AuditLogPage', () => {
  it('shows records with actor and expandable before/after values', async () => {
    server.use(
      http.get('/api/v1/audit', () =>
        HttpResponse.json({ items: [entry(), entry({ id: 40, actorType: 'System', actor: null, action: 'analysis.succeeded' })], page: 1, pageSize: 50, totalCount: 2 }),
      ),
    )
    wrap(<AuditLogPage />)

    const row = (await screen.findByText('incident.verified', { selector: 'td' })).closest('tr')!
    expect(within(row).getByText('Ada Admin')).toBeInTheDocument()
    expect(within(row).getByRole('link')).toHaveAttribute('href', `/incidents/${ID}`)
    const systemRow = screen.getByText('analysis.succeeded', { selector: 'td' }).closest('tr')!
    expect(within(systemRow).getByText('System')).toBeInTheDocument()

    await userEvent.click(within(row).getByRole('button', { name: 'Show details of record 41' }))
    expect(screen.getByText(/"approvedSeverity": "High"/)).toBeInTheDocument()
    expect(screen.getByText(/"status": "UnderReview"/)).toBeInTheDocument()
    expect(screen.getByText('corr-1')).toBeInTheDocument()
    // Read-only: nothing on the page can change a record.
    expect(screen.queryByRole('button', { name: /delete|edit/i })).not.toBeInTheDocument()
  })

  it('sends the chosen filters as query parameters', async () => {
    const requests: URL[] = []
    server.use(
      http.get('/api/v1/audit', ({ request }) => {
        requests.push(new URL(request.url))
        return HttpResponse.json({ items: [], page: 1, pageSize: 50, totalCount: 0 })
      }),
    )
    wrap(<AuditLogPage />)
    await screen.findByText('No audit records yet')

    await chooseOption(screen.getByRole('combobox', { name: /filter by actor/i }), 'Ada Admin')
    await chooseOption(screen.getByRole('combobox', { name: /filter by action/i }), 'incident.verified')
    await chooseOption(screen.getByRole('combobox', { name: /filter by entity type/i }), 'Incident')
    await userEvent.type(screen.getByLabelText('Entity ID'), ID)
    await userEvent.type(screen.getByLabelText('From'), '2026-11-01')

    await screen.findByText('No records match these filters')
    await waitFor(() => {
      const last = requests.at(-1)!
      expect(last.searchParams.get('ActorUserId')).toBe('u-ada')
      expect(last.searchParams.get('Action')).toBe('incident.verified')
      expect(last.searchParams.get('EntityType')).toBe('Incident')
      expect(last.searchParams.get('EntityId')).toBe(ID)
      expect(last.searchParams.get('From')).toBe(new Date('2026-11-01T00:00:00').toISOString())
      expect(last.searchParams.get('Page')).toBe('1')
    })
  })

  it('rejects a date range that ends before it starts without querying', async () => {
    server.use(http.get('/api/v1/audit', () => HttpResponse.json({ items: [], page: 1, pageSize: 50, totalCount: 0 })))
    wrap(<AuditLogPage />)
    await screen.findByText('No audit records yet')

    await userEvent.type(screen.getByLabelText('From'), '2026-11-10')
    await userEvent.type(screen.getByLabelText('To'), '2026-11-01')
    expect(await screen.findByRole('alert')).toHaveTextContent(/on or after/)
  })
})
