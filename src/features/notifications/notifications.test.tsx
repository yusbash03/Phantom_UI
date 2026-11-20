import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import type { NotificationResponse } from '@/api/types'
import { NotificationBell } from './NotificationBell'
import { NotificationsPage } from './NotificationsPage'
import { notificationLink, timeAgo } from './links'

const server = setupServer()
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

function notification(overrides: Partial<NotificationResponse> = {}): NotificationResponse {
  return {
    id: 'n1',
    type: 'AssignmentDeclined',
    title: 'MED-01 declined PH-2026-000900',
    body: 'Reason: vehicle in repair.',
    incidentId: 'inc-1',
    assignmentId: 'a1',
    createdAt: new Date(Date.now() - 5 * 60_000).toISOString(),
    readAt: null,
    ...overrides,
  }
}

const list = (items: NotificationResponse[], unreadCount = items.filter((n) => !n.readAt).length) =>
  HttpResponse.json({ items, page: 1, pageSize: 20, totalCount: items.length, unreadCount })

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>
}

function renderAt(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        {ui}
        <Routes>
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

describe('notification helpers', () => {
  it('sends assignment notices to My assignments and the rest to the incident', () => {
    expect(notificationLink(notification({ type: 'AssignmentCreated' }))).toBe('/assignments')
    expect(notificationLink(notification({ type: 'AssignmentCancelled' }))).toBe('/assignments')
    expect(notificationLink(notification({ type: 'CriticalAiRecommendation', incidentId: 'x' }))).toBe('/incidents/x')
    expect(notificationLink(notification({ type: 'PossibleDuplicate', incidentId: null }))).toBeNull()
  })

  it('describes times relatively', () => {
    const now = new Date('2026-11-20T10:00:00Z')
    expect(timeAgo('2026-11-20T09:55:00Z', now)).toMatch(/5 minutes ago/)
    expect(timeAgo('2026-11-20T08:00:00Z', now)).toMatch(/2 hours ago/)
  })
})

describe('NotificationBell', () => {
  it('announces the unread count, and opening a notification marks it read and goes to the incident', async () => {
    const read: string[] = []
    server.use(
      http.get('/api/v1/notifications', () => list([notification(), notification({ id: 'n2', readAt: new Date().toISOString(), title: 'Older' })])),
      http.post('/api/v1/notifications/:id/read', ({ params }) => {
        read.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderAt(<NotificationBell />)

    const bell = await screen.findByRole('button', { name: 'Notifications, 1 unread' })
    await userEvent.click(bell)
    await userEvent.click(await screen.findByRole('menuitem', { name: /MED-01 declined/ }))

    await waitFor(() => expect(read).toEqual(['n1']))
    expect(screen.getByTestId('where')).toHaveTextContent('/incidents/inc-1')
  })

  it('marks everything read', async () => {
    let readAll = false
    server.use(
      http.get('/api/v1/notifications', () => list(readAll ? [] : [notification()], readAll ? 0 : 1)),
      http.post('/api/v1/notifications/read-all', () => {
        readAll = true
        return HttpResponse.json({ updated: 1 })
      }),
    )
    renderAt(<NotificationBell />)

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications, 1 unread' }))
    await userEvent.click(await screen.findByRole('button', { name: /mark all read/i }))

    expect(await screen.findByText('You are all caught up.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /mark all read/i })).not.toBeInTheDocument()
  })
})

describe('NotificationsPage', () => {
  it('filters to unread and marks single notifications read', async () => {
    const requests: URL[] = []
    const read: string[] = []
    server.use(
      http.get('/api/v1/notifications', ({ request }) => {
        requests.push(new URL(request.url))
        return list([notification()])
      }),
      http.post('/api/v1/notifications/:id/read', ({ params }) => {
        read.push(String(params.id))
        return new HttpResponse(null, { status: 204 })
      }),
    )
    renderAt(<NotificationsPage />)

    expect(await screen.findByText('Unread')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Unread only' }))
    await waitFor(() => expect(requests.at(-1)?.searchParams.get('UnreadOnly')).toBe('true'))

    await userEvent.click(screen.getByRole('button', { name: 'Mark “MED-01 declined PH-2026-000900” as read' }))
    await waitFor(() => expect(read).toEqual(['n1']))
  })

  it('has an empty state', async () => {
    server.use(http.get('/api/v1/notifications', () => list([])))
    renderAt(<NotificationsPage />)
    expect(await screen.findByText('No notifications yet')).toBeInTheDocument()
  })
})
