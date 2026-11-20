import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ResponderResponse, RoleName } from '@/api/types'
import { TestAuth } from '@/test/auth'
import { MyAvailabilityCard } from './MyAvailabilityCard'
import { RespondersPage } from './RespondersPage'
import { parseSkills } from './skills'

const server = setupServer(
  http.get('/api/v1/responders/facets', () => HttpResponse.json({ teams: ['Fire & Rescue', 'Medical Response'], skills: ['first aid', 'water rescue'] })),
  http.get('/api/v1/users', () => HttpResponse.json({ items: [], page: 1, pageSize: 100, totalCount: 0 })),
)
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function responder(overrides: Partial<ResponderResponse> = {}): ResponderResponse {
  return {
    id: 'r1',
    callSign: 'MED-01',
    fullName: 'Amina Bello (demo)',
    team: 'Medical Response',
    phone: '+234 800 000 0000',
    email: null,
    skills: ['first aid', 'paramedic'],
    availability: 'Available',
    isActive: true,
    linkedUser: { id: 'u1', displayName: 'Demo Responder' },
    lastStatusAt: '2026-11-20T08:00:00Z',
    isDemoData: true,
    createdAt: '2026-11-20T08:00:00Z',
    version: 3,
    ...overrides,
  }
}

const page = (items: ResponderResponse[]) => HttpResponse.json({ items, page: 1, pageSize: 20, totalCount: items.length })

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

async function choose(name: RegExp, option: string) {
  await userEvent.click(screen.getByRole('combobox', { name }))
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('RespondersPage', () => {
  it('lists responders with availability, skills and demo labels, and sends filters to the API', async () => {
    const requests: URL[] = []
    server.use(
      http.get('/api/v1/responders', ({ request }) => {
        requests.push(new URL(request.url))
        return page([responder(), responder({ id: 'r2', callSign: 'FLD-05', availability: 'Unavailable', isDemoData: false, linkedUser: null })])
      }),
    )
    renderWith(<RespondersPage />, ['IncidentCoordinator'])

    const row = (await screen.findByText('MED-01')).closest('tr')!
    expect(within(row).getByText('Available')).toBeInTheDocument()
    expect(within(row).getByText('Demo data')).toBeInTheDocument()
    expect(within(row).getByText('paramedic')).toBeInTheDocument()
    expect(within(screen.getByText('FLD-05').closest('tr')!).getByText('Unavailable')).toBeInTheDocument()
    expect(requests[0]?.searchParams.get('IsActive')).toBe('true')

    await choose(/filter by team/i, 'Fire & Rescue')
    await choose(/filter by skill/i, 'water rescue')
    await choose(/filter by availability/i, 'Unavailable')
    await waitFor(() => {
      const last = requests.at(-1)
      expect(last?.searchParams.get('Team')).toBe('Fire & Rescue')
      expect(last?.searchParams.get('Skill')).toBe('water rescue')
      expect(last?.searchParams.get('Availability')).toBe('Unavailable')
    })
  })

  it('gives coordinators a read-only view', async () => {
    server.use(http.get('/api/v1/responders', () => page([responder()])))
    renderWith(<RespondersPage />, ['IncidentCoordinator'])

    await screen.findByText('MED-01')
    expect(screen.queryByRole('button', { name: /add responder/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /actions for MED-01/i })).not.toBeInTheDocument()
  })

  it('lets administrators deactivate after confirming, sending the version they read', async () => {
    let body: unknown
    server.use(
      http.get('/api/v1/responders', () => page([responder()])),
      http.post('/api/v1/responders/r1/deactivate', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(responder({ isActive: false, availability: 'Unavailable', version: 4 }))
      }),
    )
    renderWith(<RespondersPage />, ['Administrator'])

    await userEvent.click(await screen.findByRole('button', { name: 'Actions for MED-01' }))
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Deactivate' }))
    const dialog = await screen.findByRole('alertdialog')
    expect(within(dialog).getByText(/history is kept/i)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole('button', { name: 'Deactivate' }))

    await waitFor(() => expect(body).toEqual({ version: 3 }))
  })

  it('creates a responder with parsed skills and shows server conflicts', async () => {
    let body: unknown
    server.use(
      http.get('/api/v1/responders', () => page([])),
      http.post('/api/v1/responders', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ title: 'Call sign RD-09 is already in use.', code: 'responder.call_sign_taken' }, { status: 409 })
      }),
    )
    renderWith(<RespondersPage />, ['Administrator'])

    await userEvent.click(await screen.findByRole('button', { name: /add responder/i }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Call sign'), 'x')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add responder' }))
    expect(await within(dialog).findByText(/use 2-20 letters/i)).toBeInTheDocument()
    expect(body).toBeUndefined()

    await userEvent.clear(within(dialog).getByLabelText('Call sign'))
    await userEvent.type(within(dialog).getByLabelText('Call sign'), 'rd-09')
    await userEvent.type(within(dialog).getByLabelText('Full name'), 'Kelechi Musa')
    await userEvent.type(within(dialog).getByLabelText('Team'), 'Road Safety')
    await userEvent.type(within(dialog).getByLabelText('Skills'), 'Traffic control, first aid, ')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Add responder' }))

    expect(await within(dialog).findByText('Call sign RD-09 is already in use.')).toBeInTheDocument()
    expect(body).toEqual({
      callSign: 'rd-09',
      fullName: 'Kelechi Musa',
      team: 'Road Safety',
      phone: null,
      email: null,
      skills: ['Traffic control', 'first aid'],
      userId: null,
    })
  })
})

describe('MyAvailabilityCard', () => {
  it('lets a linked responder change their own availability', async () => {
    let body: unknown
    server.use(
      http.get('/api/v1/responders/me', () => HttpResponse.json(responder())),
      http.put('/api/v1/responders/me/availability', async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(responder({ availability: 'Unavailable' }))
      }),
    )
    renderWith(<MyAvailabilityCard />, ['Responder'])

    expect(await screen.findByText('MED-01')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Available' })).toHaveAttribute('aria-pressed', 'true')
    await userEvent.click(screen.getByRole('button', { name: 'Unavailable' }))

    await waitFor(() => expect(body).toEqual({ availability: 'Unavailable', version: null }))
  })

  it('explains when the account is not linked or an assignment is active', async () => {
    server.use(http.get('/api/v1/responders/me', () => HttpResponse.json({ title: 'Not linked' }, { status: 404 })))
    const { unmount } = renderWith(<MyAvailabilityCard />, ['Responder'])
    expect(await screen.findByText(/not linked to a responder profile/i)).toBeInTheDocument()
    unmount()

    server.use(http.get('/api/v1/responders/me', () => HttpResponse.json(responder({ availability: 'Assigned' }))))
    renderWith(<MyAvailabilityCard />, ['Responder'])
    expect(await screen.findByText(/active assignment/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Unavailable' })).not.toBeInTheDocument()
  })
})

describe('parseSkills', () => {
  it('splits on commas and drops blanks', () => {
    expect(parseSkills(' first aid, ,Water Rescue ,')).toEqual(['first aid', 'Water Rescue'])
  })
})
