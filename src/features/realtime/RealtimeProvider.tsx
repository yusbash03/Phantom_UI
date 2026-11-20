import { HubConnectionBuilder, HubConnectionState, LogLevel, type HubConnection } from '@microsoft/signalr'
import { useQueryClient } from '@tanstack/react-query'
import { useEffect, useState, type ReactNode } from 'react'
import { getAccessToken, refreshSession } from '@/api/session'
import { reconnectDelay, keysFor, secondsUntilExpiry, type RealtimeEvent } from './events'
import { RealtimeContext, type LiveStatus } from './realtime-context'

const HUB_PATH = '/hubs/operations'

/** A token that is about to expire is refreshed first; the hub closes connections when their token expires. */
async function freshToken(): Promise<string> {
  const token = getAccessToken()
  const remaining = token ? secondsUntilExpiry(token) : undefined
  if (token && (remaining === undefined || remaining > 30)) return token
  return (await refreshSession())?.accessToken ?? ''
}

/**
 * One SignalR connection per signed-in session (Requirement 13). Events invalidate TanStack Query caches;
 * after any gap the whole cache is invalidated, because events may have been missed. Reconnects forever
 * with backoff and reports "paused" meanwhile so screens fall back to polling.
 */
export function RealtimeProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<LiveStatus>('connecting')

  useEffect(() => {
    let disposed = false
    let restartTimer: ReturnType<typeof setTimeout> | undefined
    let attempts = 0
    const connection: HubConnection = new HubConnectionBuilder()
      .withUrl(HUB_PATH, { accessTokenFactory: freshToken })
      .withAutomaticReconnect({ nextRetryDelayInMilliseconds: ({ previousRetryCount }) => reconnectDelay(previousRetryCount) })
      .configureLogging(LogLevel.None)
      .build()

    connection.on('event', (event: RealtimeEvent) => {
      for (const queryKey of keysFor(event)) void queryClient.invalidateQueries({ queryKey })
    })
    connection.onreconnecting(() => setStatus('paused'))
    connection.onreconnected(() => {
      setStatus('live')
      void queryClient.invalidateQueries()
    })
    // Automatic reconnect only covers drops after a successful start; a closed connection is restarted here.
    connection.onclose(() => {
      if (disposed) return
      setStatus('paused')
      schedule()
    })

    async function start() {
      try {
        await connection.start()
        if (disposed) return
        if (attempts > 0) void queryClient.invalidateQueries()
        attempts = 0
        setStatus('live')
      } catch {
        if (disposed) return
        setStatus('paused')
        schedule()
      }
    }

    function schedule() {
      clearTimeout(restartTimer)
      restartTimer = setTimeout(() => {
        if (!disposed && connection.state === HubConnectionState.Disconnected) void start()
      }, reconnectDelay(++attempts))
    }

    void start()
    return () => {
      disposed = true
      clearTimeout(restartTimer)
      void connection.stop()
    }
  }, [queryClient])

  return <RealtimeContext.Provider value={status}>{children}</RealtimeContext.Provider>
}
