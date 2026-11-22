import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { ReportSummary } from '@/api/types'
import { formatDuration, formatRate, periodFromDays } from './format'
import { ReportsPage } from './ReportsPage'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const summary: ReportSummary = {
  from: '2026-10-24T00:00:00Z',
  to: '2026-11-23T00:00:00Z',
  totalIncidents: 12,
  byCategory: [
    { key: 'Fire', count: 7 },
    { key: 'Flood', count: 5 },
  ],
  bySeverity: [
    { key: 'High', count: 4 },
    { key: 'NotAssessed', count: 8 },
  ],
  byStatus: [
    { key: 'Reported', count: 8 },
    { key: 'Resolved', count: 4 },
  ],
  reportToVerification: { medianSeconds: 754, sampleSize: 4 },
  reportToFirstAcknowledgement: { medianSeconds: null, sampleSize: 0 },
  reportToResolution: { medianSeconds: 11_100, sampleSize: 4 },
  aiSeverityAgreement: { compared: 4, agreed: 3, aiHigher: 1, aiLower: 0, rate: 0.75 },
  generatedAt: '2026-11-22T10:00:00Z',
}

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <ReportsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('report formatting', () => {
  it('formats medians from seconds to days and rates as percentages', () => {
    expect(formatDuration(45)).toBe('45 s')
    expect(formatDuration(754)).toBe('13 min')
    expect(formatDuration(11_100)).toBe('3 h 5 min')
    expect(formatDuration(187_200)).toBe('2 d 4 h')
    expect(formatDuration(null)).toBe('—')
    expect(formatRate(0.75)).toBe('75%')
    expect(formatRate(null)).toBe('—')
  })

  it('turns inclusive local days into a half-open UTC period', () => {
    const period = periodFromDays('2026-11-01', '2026-11-07')!
    expect(new Date(period.from).getTime()).toBe(new Date('2026-11-01T00:00:00').getTime())
    expect(new Date(period.to).getTime()).toBe(new Date('2026-11-08T00:00:00').getTime())
    expect(periodFromDays('2026-11-08', '2026-11-01')).toBeNull()
  })
})

describe('ReportsPage', () => {
  it('shows every figure as the API computed it and asks for the last 30 days by default', async () => {
    let url: URL | undefined
    server.use(
      http.get('/api/v1/reports/summary', ({ request }) => {
        url = new URL(request.url)
        return HttpResponse.json(summary)
      }),
    )
    renderPage()

    const headline = await screen.findByRole('region', { name: 'Headline figures' })
    expect(within(headline).getByText('12')).toBeInTheDocument()
    expect(within(headline).getByText('13 min')).toBeInTheDocument()
    expect(within(headline).getAllByText('From 4 incidents.')).toHaveLength(2)
    expect(within(headline).getByText('No incidents reached this step.')).toBeInTheDocument()
    expect(within(headline).getByText('3 h 5 min')).toBeInTheDocument()
    expect(within(headline).getByText('75%')).toBeInTheDocument()
    expect(within(headline).getByText('3 of 4 matched the approved severity. AI higher 1, lower 0.')).toBeInTheDocument()

    const severity = screen.getByRole('table', { name: 'By approved severity' })
    expect(within(severity).getByRole('row', { name: /not yet assessed/i })).toHaveTextContent('8')
    expect(within(screen.getByRole('table', { name: 'By category' })).getByRole('row', { name: /flood/i })).toHaveTextContent('5')

    const days = (new Date(url!.searchParams.get('To')!).getTime() - new Date(url!.searchParams.get('From')!).getTime()) / 86_400_000
    expect(Math.round(days)).toBe(30)
  })

  it('refuses a period that ends before it starts, without asking the API', async () => {
    let calls = 0
    server.use(
      http.get('/api/v1/reports/summary', () => {
        calls += 1
        return HttpResponse.json(summary)
      }),
    )
    renderPage()
    await screen.findByRole('region', { name: 'Headline figures' })
    const before = calls

    const from = screen.getByLabelText('From')
    await userEvent.clear(from)
    await userEvent.type(from, '2030-01-01')

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a start date on or before the end date.')
    expect(screen.getByRole('button', { name: /download csv/i })).toBeDisabled()
    await waitFor(() => expect(calls).toBe(before))
  })

  it('explains when the report cannot be calculated', async () => {
    server.use(http.get('/api/v1/reports/summary', () => HttpResponse.json({ title: 'Boom' }, { status: 500 })))
    renderPage()
    expect(await screen.findByText('The report could not be calculated')).toBeInTheDocument()
  })
})
