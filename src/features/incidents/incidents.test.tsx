import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { TestAuth } from '@/test/auth'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { IncidentDetail, IncidentListItem } from '@/api/types'
import { IncidentDetailPage } from './IncidentDetailPage'
import { IncidentListPage } from './IncidentListPage'

const server = setupServer(
  http.get('/api/v1/incidents/:id/relations', () => HttpResponse.json([])),
  http.get('/api/v1/incidents/:id/assignments', () => HttpResponse.json([])),
  http.get('/api/v1/incidents/:id/timeline', () => HttpResponse.json([])),
  http.get('/api/v1/incidents/:id/environment', () =>
    HttpResponse.json({ status: 'NoCoordinates', category: 'Fire', locationIsVerified: false, isForCurrentLocation: false, snapshot: null, failure: null, alertsSupported: false }),
  ),
)
// The detail page also loads AI analyses; these tests cover the rest of the page.
const noAnalyses = http.get('/api/v1/incidents/:id/analyses', () => HttpResponse.json([]))
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ID = '0193a7a0-0000-7000-8000-000000000001'

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TestAuth roles={['IncidentCoordinator']}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/incidents" element={<IncidentListPage />} />
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
        </Routes>
      </MemoryRouter>
      </TestAuth>
    </QueryClientProvider>,
  )
}

function listItem(overrides: Partial<IncidentListItem> = {}): IncidentListItem {
  return {
    id: ID,
    number: 'PH-2026-000042',
    title: 'Smoke from warehouse roof',
    category: 'Fire',
    status: 'Reported',
    approvedSeverity: null,
    aiRecommendedSeverity: 'High',
    locationText: 'Dock Road',
    hasCoordinates: true,
    locationIsVerified: false,
    locationNeedsVerification: false,
    reportCount: 1,
    possibleDuplicateCount: 0,
    isDemoData: false,
    createdAt: '2026-11-19T10:00:00Z',
    updatedAt: '2026-11-19T10:00:00Z',
    ...overrides,
  }
}

function detail(overrides: Partial<IncidentDetail> = {}): IncidentDetail {
  return {
    id: ID,
    number: 'PH-2026-000042',
    title: 'Smoke from warehouse roof',
    description: 'Thick black smoke.',
    category: 'Fire',
    aiRecommendedCategory: null,
    status: 'UnderReview',
    approvedSeverity: null,
    aiRecommendedSeverity: 'High',
    location: {
      text: 'Dock Road',
      latitude: 6.45,
      longitude: 3.39,
      provenance: 'Reported',
      precision: 'Exact',
      isVerified: false,
      verifiedBy: null,
      verifiedAt: null,
      geocoderPlaceName: null,
    },
    locationNeedsVerification: false,
    geocodingStatus: 'NotRequired',
    assignedCoordinator: { id: 'c1', displayName: 'Chidi Coordinator' },
    verifiedBy: null,
    verifiedAt: null,
    resolutionSummary: null,
    resolvedBy: null,
    resolvedAt: null,
    closureReason: null,
    closedAt: null,
    isDemoData: false,
    createdAt: '2026-11-19T10:00:00Z',
    updatedAt: '2026-11-19T10:05:00Z',
    version: 7,
    availableActions: ['Edit', 'Verify', 'Reject'],
    reports: [
      {
        id: 'r1',
        reference: 'PH-2026-000042',
        isOriginal: true,
        title: 'Smoke from warehouse roof',
        description: 'Thick black smoke.',
        category: 'Fire',
        locationText: 'Dock Road',
        reportedLatitude: 6.45,
        reportedLongitude: 3.39,
        reporterName: 'Ada Reporter',
        reporterPhone: '+234 800 000 0000',
        reporterEmail: null,
        submittedAt: '2026-11-19T10:00:00Z',
        attachments: [],
      },
    ],
    ...overrides,
  }
}

async function chooseOption(trigger: HTMLElement, option: string) {
  await userEvent.click(trigger)
  await userEvent.click(await screen.findByRole('option', { name: option }))
}

describe('IncidentListPage', () => {
  it('requests open incidents by default and shows severity, status and honest location labels', async () => {
    let url: URL | undefined
    server.use(
      http.get('/api/v1/incidents', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json({ items: [listItem()], page: 1, pageSize: 20, totalCount: 1 })
      }),
    )
    renderAt('/incidents')

    const row = (await screen.findByText('Smoke from warehouse roof')).closest('tr')!
    expect(url?.searchParams.getAll('Status')).toEqual(['Reported', 'UnderReview', 'Verified', 'Assigned', 'InProgress'])
    expect(url?.searchParams.get('Sort')).toBe('CreatedAt')
    expect(within(row).getByRole('link', { name: 'PH-2026-000042' })).toHaveAttribute('href', `/incidents/${ID}`)
    expect(within(row).getByText('Not yet assessed')).toBeInTheDocument()
    expect(within(row).getByLabelText('AI recommends High')).toBeInTheDocument()
    expect(within(row).getByText('Reported')).toBeInTheDocument()
    expect(within(row).getByText('Unverified location')).toBeInTheDocument()
  })

  it('sends the chosen filters to the API and offers to clear them when nothing matches', async () => {
    const requests: URL[] = []
    server.use(
      http.get('/api/v1/incidents', ({ request }) => {
        requests.push(new URL(request.url))
        return HttpResponse.json({ items: [], page: 1, pageSize: 20, totalCount: 0 })
      }),
    )
    renderAt('/incidents')
    await screen.findByText('No open incidents')

    await chooseOption(screen.getByRole('combobox', { name: /filter by category/i }), 'Flood')
    await chooseOption(screen.getByRole('combobox', { name: /filter by status/i }), 'Verified')

    await screen.findByText('No incidents match these filters')
    await waitFor(() => {
      const last = requests.at(-1)
      expect(last?.searchParams.get('Category')).toBe('Flood')
      expect(last?.searchParams.getAll('Status')).toEqual(['Verified'])
    })
    expect(screen.getByRole('button', { name: /clear filters/i })).toBeInTheDocument()
  })

  it('shows an error state with retry when the list fails', async () => {
    server.use(http.get('/api/v1/incidents', () => HttpResponse.json({ title: 'Boom' }, { status: 500 })))
    renderAt('/incidents')

    expect(await screen.findByText('Incidents could not be loaded')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument()
  })
})

describe('IncidentDetailPage', () => {
  it('shows only the actions the API allows, and reporter contact details', async () => {
    server.use(http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(detail())), noAnalyses)
    renderAt(`/incidents/${ID}`)

    expect(await screen.findByRole('heading', { name: 'Smoke from warehouse roof' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Verify' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Reject' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Edit details' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Resolve' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close' })).not.toBeInTheDocument()
    expect(screen.getByText('Ada Reporter')).toBeInTheDocument()
    expect(screen.getByText('Reporter-supplied, unverified')).toBeInTheDocument()
  })

  it('shows a voice recording’s automatic transcript, labelled as such, or says it was not transcribed', async () => {
    const audio = (transcript: string | null) => ({
      id: transcript ? 'a1' : 'a2',
      kind: 'Audio' as const,
      contentType: 'audio/webm',
      sizeBytes: 20480,
      originalFileName: 'voice-note.webm',
      createdAt: '2026-11-19T10:00:00Z',
      transcript,
      transcriptProvider: transcript ? 'Gemini (gemini-3.8-flash)' : null,
      transcribedAt: transcript ? '2026-11-19T10:00:30Z' : null,
    })
    const base = detail()
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () =>
        HttpResponse.json(
          detail({
            reports: [
              { ...base.reports[0]!, attachments: [audio('Fire at the market, people trapped upstairs.')] },
              { ...base.reports[0]!, id: 'r2', reference: 'PH-2026-000043', isOriginal: false, attachments: [audio(null)] },
            ],
          }),
        ),
      ),
      noAnalyses,
    )
    renderAt(`/incidents/${ID}`)

    expect(await screen.findByText('Fire at the market, people trapped upstairs.')).toBeInTheDocument()
    expect(screen.getByText(/Automatic transcript · Gemini \(gemini-3\.8-flash\) · may contain errors\. The original recording is kept unchanged\./)).toBeInTheDocument()
    expect(screen.getByText('Not transcribed. Listen to the original recording.')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: 'Play voice recording' })).toHaveLength(2)
  })

  it('shows no actions for a read-only viewer', async () => {
    server.use(http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(detail({ availableActions: [] }))), noAnalyses)
    renderAt(`/incidents/${ID}`)

    await screen.findByRole('heading', { name: 'Smoke from warehouse roof' })
    expect(screen.queryByRole('button', { name: 'Verify' })).not.toBeInTheDocument()
  })

  it('requires an explicit severity to verify and sends it with the version that was read', async () => {
    let body: unknown
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(detail())),
      noAnalyses,
      http.post(`/api/v1/incidents/${ID}/verify`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json(detail({ status: 'Verified', approvedSeverity: 'Critical', version: 8, availableActions: ['Edit', 'Resolve', 'ChangeSeverity'] }))
      }),
    )
    renderAt(`/incidents/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Verify' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Verify incident' }))
    expect(await within(dialog).findByText('Choose an approved severity.')).toBeInTheDocument()
    expect(body).toBeUndefined()

    await chooseOption(within(dialog).getByRole('combobox'), 'Critical')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Verify incident' }))

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(body).toEqual({ approvedSeverity: 'Critical', version: 7 })
    expect(await screen.findByLabelText('Critical severity')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Resolve' })).toBeInTheDocument()
  })

  it('explains a concurrency conflict and reloads the incident', async () => {
    let reads = 0
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => {
        reads += 1
        return HttpResponse.json(detail({ version: 6 + reads }))
      }),
      noAnalyses,
      http.post(`/api/v1/incidents/${ID}/reject`, () =>
        HttpResponse.json({ title: 'This incident was changed by someone else. Reload and try again.' }, { status: 409 }),
      ),
    )
    renderAt(`/incidents/${ID}`)

    await userEvent.click(await screen.findByRole('button', { name: 'Reject' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.type(within(dialog).getByLabelText('Reason for rejection'), 'Duplicate of an earlier call')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Reject incident' }))

    expect(await within(dialog).findByText(/someone else changed this incident/i)).toBeInTheDocument()
    await waitFor(() => expect(reads).toBe(2))
  })

  it('shows a not-found state for an unknown incident', async () => {
    server.use(http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json({ title: 'Incident not found.' }, { status: 404 })), noAnalyses)
    renderAt(`/incidents/${ID}`)

    expect(await screen.findByText('Incident not found')).toBeInTheDocument()
  })
})
