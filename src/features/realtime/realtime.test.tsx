import { act, render, renderHook, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { keysFor, reconnectDelay, secondsUntilExpiry, type RealtimeEvent } from './events'
import { LiveIndicator } from './LiveIndicator'
import { RealtimeContext, useFallbackInterval, type LiveStatus } from './realtime-context'
import { RealtimeProvider } from './RealtimeProvider'

// A controllable stand-in for the SignalR connection.
const hub = vi.hoisted(() => ({
  handlers: {} as Record<string, (e: unknown) => void>,
  onReconnecting: undefined as undefined | (() => void),
  onReconnected: undefined as undefined | (() => void),
  start: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  stop: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}))
vi.mock('@microsoft/signalr', () => {
  class HubConnectionBuilder {
    withUrl() { return this }
    withAutomaticReconnect() { return this }
    configureLogging() { return this }
    build() {
      return {
        state: 'Connected',
        on: (name: string, fn: (e: unknown) => void) => { hub.handlers[name] = fn },
        onreconnecting: (fn: () => void) => { hub.onReconnecting = fn },
        onreconnected: (fn: () => void) => { hub.onReconnected = fn },
        onclose: () => {},
        start: hub.start,
        stop: hub.stop,
      }
    }
  }
  return { HubConnectionBuilder, HubConnectionState: { Disconnected: 'Disconnected' }, LogLevel: { None: 6 } }
})

const event = (type: RealtimeEvent['type'], overrides: Partial<RealtimeEvent> = {}): RealtimeEvent => ({
  type, incidentId: 'i1', assignmentId: null, responderId: null, at: '2026-11-20T10:00:00Z', ...overrides,
})
const flat = (e: RealtimeEvent) => keysFor(e).map((k) => JSON.stringify(k))

describe('keysFor', () => {
  it('refreshes the analysis, the incident and the overviews when an analysis completes', () => {
    const keys = flat(event('AnalysisCompleted'))
    expect(keys).toEqual(expect.arrayContaining([
      JSON.stringify(['incidents', 'analyses', 'i1']),
      JSON.stringify(['incidents', 'detail', 'i1']),
      JSON.stringify(['incidents', 'timeline', 'i1']),
      JSON.stringify(['incidents', 'list']),
      JSON.stringify(['dashboard']),
    ]))
  })

  it('refreshes assignments and responders for assignment changes, and only notifications for a notification', () => {
    expect(flat(event('AssignmentAcknowledged', { assignmentId: 'a1' }))).toEqual(expect.arrayContaining([JSON.stringify(['assignments']), JSON.stringify(['responders'])]))
    expect(flat(event('NotificationCreated'))).toEqual([JSON.stringify(['notifications'])])
    expect(flat(event('ResponderAvailabilityChanged', { incidentId: null }))).toEqual([JSON.stringify(['responders']), JSON.stringify(['dashboard'])])
  })
})

describe('reconnection helpers', () => {
  it('backs off to at most about 30 s and keeps trying', () => {
    expect(reconnectDelay(0)).toBe(0)
    expect(reconnectDelay(1, () => 0.5)).toBe(2_000)
    expect(reconnectDelay(50, () => 1)).toBe(36_000)
    expect(reconnectDelay(50, () => 0)).toBe(24_000)
  })

  it('reads a token expiry so an expiring token is refreshed before reconnecting', () => {
    const token = `x.${btoa(JSON.stringify({ exp: 1_000 }))}.y`
    expect(secondsUntilExpiry(token, 940_000)).toBe(60)
    expect(secondsUntilExpiry('not-a-jwt')).toBeUndefined()
  })
})

function withStatus(status: LiveStatus) {
  return ({ children }: { children: ReactNode }) => <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>
}

describe('live status', () => {
  it('stops polling while live and falls back to the interval otherwise', () => {
    expect(renderHook(() => useFallbackInterval(60_000), { wrapper: withStatus('live') }).result.current).toBe(false)
    expect(renderHook(() => useFallbackInterval(60_000), { wrapper: withStatus('paused') }).result.current).toBe(60_000)
    expect(renderHook(() => useFallbackInterval(60_000), { wrapper: withStatus('off') }).result.current).toBe(60_000)
  })

  it('says when live updates are paused', () => {
    render(<LiveIndicator />, { wrapper: withStatus('paused') })
    expect(screen.getByText('Live updates paused')).toBeInTheDocument()
  })
})

describe('RealtimeProvider', () => {
  beforeEach(() => {
    hub.start.mockClear()
    hub.stop.mockClear()
  })

  it('invalidates the affected queries on an event, pauses while reconnecting, and refetches everything after', async () => {
    const qc = new QueryClient()
    const invalidate = vi.spyOn(qc, 'invalidateQueries')
    const { unmount } = render(
      <QueryClientProvider client={qc}>
        <RealtimeProvider>
          <LiveIndicator />
        </RealtimeProvider>
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('status', { name: 'Live updates on' })).toBeInTheDocument()

    act(() => hub.handlers.event!(event('NotificationCreated')))
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ['notifications'] })

    act(() => hub.onReconnecting!())
    expect(screen.getByText('Live updates paused')).toBeInTheDocument()

    invalidate.mockClear()
    act(() => hub.onReconnected!())
    expect(await screen.findByRole('status', { name: 'Live updates on' })).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledWith()

    unmount()
    expect(hub.stop).toHaveBeenCalled()
  })
})
