import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { IncidentDetail } from '@/api/types'
import { IncidentActions } from './IncidentActions'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const ID = '0193a7a0-0000-7000-8000-0000000000c1'

const incident = {
  id: ID,
  number: 'PH-2026-000300',
  version: 4,
  availableActions: ['VerifyLocation'],
  location: {
    text: 'Allen Avenue',
    latitude: 6.603149,
    longitude: 3.351186,
    provenance: 'Geocoded',
    precision: 'Street',
    isVerified: false,
    verifiedBy: null,
    verifiedAt: null,
    geocoderPlaceName: 'Allen Avenue, Lagos',
  },
} as unknown as IncidentDetail

function renderActions() {
  const qc = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <IncidentActions incident={incident} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('Verify location', () => {
  it('prefills the approximate coordinates, validates them, and sends the read version', async () => {
    let body: unknown
    server.use(
      http.put(`/api/v1/incidents/${ID}/location`, async ({ request }) => {
        body = await request.json()
        return HttpResponse.json({ ...incident, version: 5 })
      }),
    )
    renderActions()

    await userEvent.click(screen.getByRole('button', { name: 'Verify location' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/approximate coordinates \(Allen Avenue, Lagos\)/)).toBeInTheDocument()
    const latitude = within(dialog).getByLabelText('Latitude')
    expect(latitude).toHaveValue('6.603149')

    await userEvent.clear(latitude)
    await userEvent.type(latitude, '95')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Verify location' }))
    expect(await within(dialog).findByText('Latitude must be a number between -90 and 90.')).toBeInTheDocument()
    expect(body).toBeUndefined()

    await userEvent.clear(latitude)
    await userEvent.type(latitude, '6.60201')
    await userEvent.clear(within(dialog).getByLabelText('Location description'))
    await userEvent.type(within(dialog).getByLabelText('Location description'), '12 Allen Avenue, by the filling station')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Verify location' }))

    await waitFor(() =>
      expect(body).toEqual({ text: '12 Allen Avenue, by the filling station', latitude: 6.60201, longitude: 3.351186, version: 4 }),
    )
  })
})
