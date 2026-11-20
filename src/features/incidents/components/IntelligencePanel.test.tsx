import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { TestAuth } from '@/test/auth'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { AnalysisResponse, IncidentDetail, IntelligenceResult } from '@/api/types'
import { IncidentDetailPage } from '../IncidentDetailPage'

const server = setupServer(http.get('/api/v1/incidents/:id/relations', () => HttpResponse.json([])))
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ID = '0193a7a0-0000-7000-8000-0000000000a1'

const incident: IncidentDetail = {
  id: ID,
  number: 'PH-2026-000077',
  title: 'Fire at depot',
  description: 'Smoke from the depot roof.',
  category: 'Fire',
  aiRecommendedCategory: 'Infrastructure',
  status: 'Verified',
  approvedSeverity: 'Medium',
  aiRecommendedSeverity: 'Critical',
  location: { text: 'Depot Road', latitude: null, longitude: null, provenance: 'Reported', precision: 'Unknown', isVerified: false, verifiedBy: null, verifiedAt: null },
  locationNeedsVerification: true,
  assignedCoordinator: null,
  verifiedBy: null,
  verifiedAt: null,
  resolutionSummary: null,
  resolvedBy: null,
  resolvedAt: null,
  closureReason: null,
  closedAt: null,
  isDemoData: false,
  createdAt: '2026-11-20T08:00:00Z',
  updatedAt: '2026-11-20T08:05:00Z',
  version: 2,
  availableActions: [],
  reports: [],
}

const result: IntelligenceResult = {
  category: 'Infrastructure',
  summary: 'Smoke reported from the depot roof; possible people inside.',
  severity: 'Critical',
  severityRationale: 'Caller reports shouting from inside the building.',
  namedLocations: ['Depot Road'],
  potentialCasualties: 'Possible',
  possibleTrappedPersons: 'Reported',
  hazards: ['smoke', 'fuel tanks'],
  missingInformation: ['Exact building number'],
  recommendedNextActions: ['Call the reporter back', 'Confirm the building number'],
  extractedEntities: [{ type: 'Landmark', value: 'Depot 4' }],
  confidenceExplanation: 'Single first-hand report.',
}

function analysis(overrides: Partial<AnalysisResponse> = {}): AnalysisResponse {
  return {
    id: crypto.randomUUID(),
    attempt: 1,
    reportReference: 'PH-2026-000077',
    status: 'Succeeded',
    provider: 'Gemini',
    model: 'gemini-3.8-flash',
    isSimulated: false,
    schemaVersion: 'phantom.intel.v1',
    requestedAt: '2026-11-20T08:00:01Z',
    completedAt: '2026-11-20T08:00:04Z',
    latencyMs: 2600,
    recommendedSeverity: 'Critical',
    recommendedCategory: 'Infrastructure',
    result,
    failureCode: null,
    failureMessage: null,
    requestedBy: null,
    ...overrides,
  }
}

const failed = (overrides: Partial<AnalysisResponse> = {}) =>
  analysis({
    status: 'Failed',
    result: null,
    recommendedSeverity: null,
    recommendedCategory: null,
    failureCode: 'Timeout',
    failureMessage: 'The AI provider did not respond within 30 seconds.',
    ...overrides,
  })

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <TestAuth roles={['IncidentCoordinator']}>
      <MemoryRouter initialEntries={[`/incidents/${ID}`]}>
        <Routes>
          <Route path="/incidents/:id" element={<IncidentDetailPage />} />
        </Routes>
      </MemoryRouter>
      </TestAuth>
    </QueryClientProvider>,
  )
}

const panel = async () => within((await screen.findByText('AI recommendation')).closest('[aria-labelledby="ai-panel-title"]') as HTMLElement)

describe('IntelligencePanel', () => {
  it('labels the AI output as advisory and shows it side by side with the approved values', async () => {
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(incident)),
      http.get(`/api/v1/incidents/${ID}/analyses`, () => HttpResponse.json([analysis()])),
    )
    renderPage()
    const p = await panel()

    expect(p.getByText('Advisory only')).toBeInTheDocument()
    const table = await p.findByRole('table', { name: /ai recommendation compared with approved values/i })
    const severityRow = within(table).getByRole('row', { name: /severity/i })
    expect(within(severityRow).getByLabelText('AI recommends Critical')).toBeInTheDocument()
    expect(within(severityRow).getByLabelText('Medium severity')).toBeInTheDocument()
    expect(within(severityRow).getByText('differs')).toBeInTheDocument()
    const categoryRow = within(table).getByRole('row', { name: /category/i })
    expect(within(categoryRow).getByText('AI · Infrastructure')).toBeInTheDocument()
    expect(within(categoryRow).getByText('Fire')).toBeInTheDocument()

    expect(p.getByText(result.summary)).toBeInTheDocument()
    expect(p.getByText('Reported by caller')).toBeInTheDocument()
    expect(p.getByText('Call the reporter back')).toBeInTheDocument()
    expect(p.getByText('fuel tanks')).toBeInTheDocument()
    expect(p.getByText(/gemini-3\.8-flash/)).toBeInTheDocument()
    expect(p.getByText(/from report PH-2026-000077/)).toBeInTheDocument()
    expect(p.queryByText(/simulated/i)).not.toBeInTheDocument()
  })

  it('renders model text as plain text, never as HTML', async () => {
    const hostile = '<img src=x onerror="alert(1)"> <b>bold</b>'
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(incident)),
      http.get(`/api/v1/incidents/${ID}/analyses`, () => HttpResponse.json([analysis({ result: { ...result, summary: hostile } })])),
    )
    const { container } = renderPage()
    const p = await panel()

    expect(await p.findByText(hostile)).toBeInTheDocument()
    expect(container.querySelector('img')).toBeNull()
    expect(container.querySelector('b')).toBeNull()
  })

  it('marks simulated output clearly', async () => {
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(incident)),
      http.get(`/api/v1/incidents/${ID}/analyses`, () =>
        HttpResponse.json([analysis({ isSimulated: true, provider: 'Simulated', model: 'simulated-keywords-v1' })]),
      ),
    )
    renderPage()

    expect(await (await panel()).findByText('Simulated — not a real AI result')).toBeInTheDocument()
  })

  it('explains a failure and lets staff retry it', async () => {
    let retried = false
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(incident)),
      http.get(`/api/v1/incidents/${ID}/analyses`, () =>
        HttpResponse.json(retried ? [analysis({ attempt: 2, status: 'Pending', result: null, completedAt: null }), failed()] : [failed()]),
      ),
      http.post(`/api/v1/incidents/${ID}/analyses/retry`, () => {
        retried = true
        return HttpResponse.json(analysis({ attempt: 2, status: 'Pending', result: null }), { status: 202 })
      }),
    )
    renderPage()
    const p = await panel()

    const alert = await p.findByRole('alert')
    expect(alert).toHaveTextContent('The AI provider timed out')
    expect(alert).toHaveTextContent('The AI provider did not respond within 30 seconds.')
    expect(alert).toHaveTextContent('The report and incident are unchanged')

    await userEvent.click(within(alert).getByRole('button', { name: /retry analysis/i }))

    expect(await p.findByText(/analysis queued/i)).toBeInTheDocument()
    expect(retried).toBe(true)
    expect(p.queryByRole('alert')).not.toBeInTheDocument()
    expect(p.getByText(/earlier attempts \(1\)/i)).toBeInTheDocument()
  })

  it('keeps the last successful result visible when a later attempt failed', async () => {
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(incident)),
      http.get(`/api/v1/incidents/${ID}/analyses`, () => HttpResponse.json([failed({ attempt: 2 }), analysis()])),
    )
    renderPage()
    const p = await panel()

    expect(await p.findByRole('alert')).toHaveTextContent('(attempt 2)')
    expect(p.getByText('Showing the last successful result (attempt 1).')).toBeInTheDocument()
    expect(p.getByText(result.summary)).toBeInTheDocument()
  })

  it('polls while the analysis runs and refreshes the incident when it finishes', async () => {
    let analysisCalls = 0
    let incidentCalls = 0
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => {
        incidentCalls += 1
        return HttpResponse.json(incident)
      }),
      http.get(`/api/v1/incidents/${ID}/analyses`, () => {
        analysisCalls += 1
        return HttpResponse.json(analysisCalls === 1 ? [analysis({ status: 'Processing', result: null, completedAt: null })] : [analysis()])
      }),
    )
    renderPage()
    const p = await panel()

    expect(await p.findByText(/analysing the report/i)).toBeInTheDocument()
    expect(await p.findByText(result.summary, undefined, { timeout: 6000 })).toBeInTheDocument()
    await waitFor(() => expect(incidentCalls).toBeGreaterThanOrEqual(2))
  }, 10_000)

  it('says when no analysis exists', async () => {
    server.use(
      http.get(`/api/v1/incidents/${ID}`, () => HttpResponse.json(incident)),
      http.get(`/api/v1/incidents/${ID}/analyses`, () => HttpResponse.json([])),
    )
    renderPage()

    expect(await (await panel()).findByText('No AI analysis has been requested for this incident.')).toBeInTheDocument()
  })
})
