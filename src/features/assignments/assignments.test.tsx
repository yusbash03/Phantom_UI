import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { AssignmentResponse, IncidentDetail, ResponderResponse, RoleName } from '@/api/types'
import { TestAuth } from '@/test/auth'
import { AssignDialog } from './AssignDialog'
import { AssignmentCard } from './AssignmentCard'
import { MyAssignmentsPage } from './MyAssignmentsPage'
import { overrideNeededFor } from './rules'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const incident = { id: 'inc-1', number: 'PH-2026-000900', title: 'Warehouse fire', status: 'Verified', availableActions: ['Assign'] } as unknown as IncidentDetail

function responder(overrides: Partial<ResponderResponse>): ResponderResponse {
  return {
    id: 'r1', callSign: 'MED-01', fullName: 'Amina Bello', team: 'Medical Response', phone: null, email: null, skills: ['first aid'],
    availability: 'Available', isActive: true, linkedUser: { id: 'u1', displayName: 'Amina' }, lastStatusAt: '2026-11-20T08:00:00Z',
    isDemoData: false, createdAt: '2026-11-20T08:00:00Z', version: 1, ...overrides,
  }
}

function assignment(overrides: Partial<AssignmentResponse> = {}): AssignmentResponse {
  return {
    id: 'a1',
    status: 'Assigned',
    responder: { id: 'r1', callSign: 'MED-01', fullName: 'Amina Bello', team: 'Medical Response', hasLinkedAccount: true },
    incident: {
      id: 'inc-1', number: 'PH-2026-000900', title: 'Warehouse fire', description: 'Thick smoke from the roof.', category: 'Fire', status: 'Assigned',
      approvedSeverity: 'High', locationText: 'Dock Road', latitude: 6.45, longitude: 3.39, locationProvenance: 'Reported', locationIsVerified: false,
    },
    assignedBy: { id: 'c1', displayName: 'Demo Coordinator' },
    assignedAt: '2026-11-20T09:00:00Z',
    acknowledgedAt: null, enRouteAt: null, onSceneAt: null, completedAt: null, endedAt: null,
    endedReason: null, overrideReason: null, completionNotes: null,
    updates: [],
    availableActions: ['Acknowledge', 'Decline'],
    ...overrides,
  }
}

function renderWith(ui: React.ReactNode, roles: RoleName[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TestAuth roles={roles}>
        <MemoryRouter>{ui}</MemoryRouter>
      </TestAuth>
    </QueryClientProvider>,
  )
}

describe('overrideNeededFor', () => {
  it('explains why a responder needs an override', () => {
    expect(overrideNeededFor(responder({}))).toBeNull()
    expect(overrideNeededFor(responder({ availability: 'Assigned' }))).toBe('already on another active assignment')
    expect(overrideNeededFor(responder({ availability: 'Unavailable' }))).toBe('marked unavailable')
    expect(overrideNeededFor(responder({ isActive: false }))).toBe('deactivated')
  })
})

describe('AssignDialog', () => {
  it('requires an override reason for a busy responder and sends it', async () => {
    let body: unknown
    server.use(
      http.get('/api/v1/responders', () =>
        HttpResponse.json({ items: [responder({}), responder({ id: 'r2', callSign: 'FIRE-02', availability: 'Assigned' })], page: 1, pageSize: 100, totalCount: 2 }),
      ),
      http.post('/api/v1/incidents/inc-1/assignments', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(assignment({ responder: { id: 'r2', callSign: 'FIRE-02', fullName: 'x', team: 't', hasLinkedAccount: true } }), { status: 201 })
      }),
    )
    renderWith(<AssignDialog incident={incident} onClose={() => {}} />, ['IncidentCoordinator'])

    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('radio', { name: /FIRE-02/ }))
    expect(within(dialog).getByLabelText(/override reason/i)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))
    expect(await within(dialog).findByText(/give a reason to assign FIRE-02/i)).toBeInTheDocument()
    expect(body).toBeUndefined()

    await userEvent.type(within(dialog).getByLabelText(/override reason/i), 'Only crew with breathing apparatus.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))
    await waitFor(() => expect(body).toEqual({ responderId: 'r2', overrideReason: 'Only crew with breathing apparatus.' }))
  })

  it('assigns an available responder without an override', async () => {
    let body: unknown
    server.use(
      http.get('/api/v1/responders', () => HttpResponse.json({ items: [responder({})], page: 1, pageSize: 100, totalCount: 1 })),
      http.post('/api/v1/incidents/inc-1/assignments', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(assignment(), { status: 201 })
      }),
    )
    renderWith(<AssignDialog incident={incident} onClose={() => {}} />, ['IncidentCoordinator'])

    const dialog = await screen.findByRole('dialog')
    await userEvent.click(await within(dialog).findByRole('radio', { name: /MED-01/ }))
    expect(within(dialog).queryByLabelText(/override reason/i)).not.toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Assign' }))
    await waitFor(() => expect(body).toEqual({ responderId: 'r1', overrideReason: null }))
  })

  it('says the responder list failed to load, rather than that there are no responders', async () => {
    server.use(http.get('/api/v1/responders', () => HttpResponse.json({ title: 'Boom' }, { status: 500 })))
    renderWith(<AssignDialog incident={incident} onClose={() => {}} />, ['IncidentCoordinator'])

    const dialog = await screen.findByRole('dialog')
    expect(await within(dialog).findByText('Responders could not be loaded')).toBeInTheDocument()
    expect(within(dialog).getByRole('button', { name: /try again/i })).toBeInTheDocument()
    expect(within(dialog).queryByText(/there are no active responders/i)).not.toBeInTheDocument()
  })
})

describe('AssignmentCard', () => {
  it('lets the responder acknowledge immediately and decline only with a reason', async () => {
    const calls: { path: string; body: unknown }[] = []
    server.use(
      http.post('/api/v1/assignments/a1/:action', async ({ request, params }) => {
        calls.push({ path: String(params.action), body: await request.json().catch(() => null) })
        return HttpResponse.json(assignment({ status: 'Acknowledged' }))
      }),
    )
    renderWith(<AssignmentCard assignment={assignment()} perspective="responder" />, ['Responder'])

    expect(screen.getByText('Thick smoke from the roof.')).toBeInTheDocument()
    expect(screen.getByText(/\(unverified\)/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Acknowledge' }))
    await waitFor(() => expect(calls.map((c) => c.path)).toEqual(['acknowledge']))

    await userEvent.click(screen.getByRole('button', { name: 'Decline' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline assignment' }))
    expect(await within(dialog).findByText('Reason is required.')).toBeInTheDocument()
    await userEvent.type(within(dialog).getByLabelText('Reason'), 'Vehicle broke down.')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Decline assignment' }))
    await waitFor(() => expect(calls.at(-1)).toEqual({ path: 'decline', body: { reason: 'Vehicle broke down.' } }))
  })

  it('shows coordinators who is assigned, the updates, and a cancel action', async () => {
    renderWith(
      <AssignmentCard
        assignment={assignment({
          status: 'EnRoute',
          enRouteAt: '2026-11-20T09:10:00Z',
          availableActions: ['Cancel'],
          updates: [{ id: 'u1', kind: 'ProgressUpdate', body: 'Five minutes out.', author: { id: 'u', displayName: 'Amina' }, createdAt: '2026-11-20T09:12:00Z' }],
        })}
        perspective="staff"
      />,
      ['IncidentCoordinator'],
    )

    expect(screen.getByText('MED-01')).toBeInTheDocument()
    expect(screen.getByText('En route')).toBeInTheDocument()
    expect(screen.getByText('Five minutes out.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel assignment' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Acknowledge' })).not.toBeInTheDocument()
  })
})

describe('MyAssignmentsPage', () => {
  it('separates active from earlier assignments', async () => {
    server.use(
      http.get('/api/v1/assignments/mine', () =>
        HttpResponse.json([assignment(), assignment({ id: 'a2', status: 'Completed', availableActions: [], completionNotes: 'Handed over.' })]),
      ),
    )
    renderWith(<MyAssignmentsPage />, ['Responder'])

    expect(await screen.findByRole('heading', { name: 'Active (1)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Earlier (1)' })).toBeInTheDocument()
    expect(screen.getByText('Resolution notes: Handed over.')).toBeInTheDocument()
  })

  it('has an empty state', async () => {
    server.use(http.get('/api/v1/assignments/mine', () => HttpResponse.json([])))
    renderWith(<MyAssignmentsPage />, ['Responder'])
    expect(await screen.findByText('No assignments')).toBeInTheDocument()
  })
})
