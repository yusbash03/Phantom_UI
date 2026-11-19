import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { PublicReportPage } from './PublicReportPage'
import { PublicStatusPage } from './PublicStatusPage'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function renderAt(path: string) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/report" element={<PublicReportPage />} />
          <Route path="/report/status" element={<PublicStatusPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

async function fillRequiredFields() {
  await userEvent.type(screen.getByLabelText(/title/i), 'Fire on Main St')
  await userEvent.type(screen.getByLabelText(/description/i), 'Thick smoke visible from the highway overpass.')
  await userEvent.type(screen.getByLabelText(/^location/i), 'Main Street near the bridge')
  await userEvent.selectOptions(screen.getByRole('combobox', { name: /category/i }), 'Fire')
}

const submitButton = () => screen.getByRole('button', { name: /submit report/i })

describe('PublicReportPage', () => {
  it('shows the form heading', () => {
    renderAt('/report')
    expect(screen.getByRole('heading', { name: /report an incident/i })).toBeInTheDocument()
  })

  it('shows validation errors when required fields are empty on submit', async () => {
    renderAt('/report')
    await userEvent.click(submitButton())
    expect(await screen.findByText(/title must be at least/i)).toBeInTheDocument()
  })

  it('shows the confirmation screen with the reference on success', async () => {
    server.use(
      http.post('/api/v1/public/reports', () =>
        HttpResponse.json({ reference: 'PH-2026-000042', submittedAt: new Date().toISOString() }, { status: 201 }),
      ),
    )
    renderAt('/report')

    await fillRequiredFields()
    await userEvent.click(submitButton())

    expect(await screen.findByText('PH-2026-000042')).toBeInTheDocument()
    expect(screen.getByText(/report submitted/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /check status/i })).toHaveAttribute('href', '/report/status?ref=PH-2026-000042')
  })

  it('reuses the same Idempotency-Key when the reporter retries after a failure', async () => {
    const keys: (string | null)[] = []
    let calls = 0
    server.use(
      http.post('/api/v1/public/reports', ({ request }) => {
        keys.push(request.headers.get('Idempotency-Key'))
        calls += 1
        return calls === 1
          ? HttpResponse.json({ title: 'Server error' }, { status: 503 })
          : HttpResponse.json({ reference: 'PH-2026-000050', submittedAt: new Date().toISOString() }, { status: 201 })
      }),
    )
    renderAt('/report')

    await fillRequiredFields()
    await userEvent.click(submitButton())
    await screen.findByText('Server error')
    await userEvent.click(submitButton())

    expect(await screen.findByText('PH-2026-000050')).toBeInTheDocument()
    expect(keys).toHaveLength(2)
    expect(keys[0]).toMatch(/^[0-9a-f-]{36}$/)
    expect(keys[1]).toBe(keys[0])
  })

  it('shows a server field error next to the field it belongs to', async () => {
    server.use(
      http.post('/api/v1/public/reports', () =>
        HttpResponse.json(
          {
            title: 'One or more fields are invalid.',
            errors: { locationText: ['Location description must be at most 500 characters.'] },
          },
          { status: 400 },
        ),
      ),
    )
    renderAt('/report')

    await fillRequiredFields()
    await userEvent.click(submitButton())

    expect(await screen.findByText('Location description must be at most 500 characters.')).toBeInTheDocument()
    expect(screen.getByLabelText(/^location/i)).toHaveAttribute('aria-invalid', 'true')
  })

  it('shows a rate-limit message when the API returns 429', async () => {
    server.use(http.post('/api/v1/public/reports', () => new HttpResponse(null, { status: 429 })))
    renderAt('/report')

    await fillRequiredFields()
    await userEvent.click(submitButton())

    expect(await screen.findByRole('alert')).toHaveTextContent(/too many requests/i)
  })

  it('resets to a fresh form when "Report another incident" is clicked', async () => {
    server.use(
      http.post('/api/v1/public/reports', () =>
        HttpResponse.json({ reference: 'PH-2026-000043', submittedAt: new Date().toISOString() }, { status: 201 }),
      ),
    )
    renderAt('/report')

    await fillRequiredFields()
    await userEvent.click(submitButton())
    await screen.findByText('PH-2026-000043')
    await userEvent.click(screen.getByRole('button', { name: /report another/i }))

    expect(screen.getByRole('heading', { name: /report an incident/i })).toBeInTheDocument()
    expect(screen.getByLabelText(/title/i)).toHaveValue('')
  })
})

describe('PublicStatusPage', () => {
  it('shows the coarse status label for the reference in the URL', async () => {
    server.use(
      http.get('/api/v1/public/reports/:reference/status', ({ params }) =>
        HttpResponse.json({ reference: params.reference, status: 'BeingHandled' }),
      ),
    )
    renderAt('/report/status?ref=PH-2026-000042')

    expect(await screen.findByText('Being handled')).toBeInTheDocument()
    expect(screen.getByText('PH-2026-000042')).toBeInTheDocument()
  })

  it('explains when a reference does not exist', async () => {
    server.use(
      http.get('/api/v1/public/reports/:reference/status', () =>
        HttpResponse.json({ title: 'Reference not found.' }, { status: 404 }),
      ),
    )
    renderAt('/report/status')

    await userEvent.type(screen.getByLabelText(/reference number/i), 'ph-2026-999999')
    await userEvent.click(screen.getByRole('button', { name: /check status/i }))

    expect(await screen.findByText(/no report found for PH-2026-999999/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /try again/i })).not.toBeInTheDocument()
  })
})
