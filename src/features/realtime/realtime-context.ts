import { createContext, useContext } from 'react'

/** live: events are arriving. paused: connection lost, polling fallback active. off: not signed in / no provider. */
export type LiveStatus = 'connecting' | 'live' | 'paused' | 'off'

export const RealtimeContext = createContext<LiveStatus>('off')

export function useLiveStatus(): LiveStatus {
  return useContext(RealtimeContext)
}

/**
 * Polling interval for a query that real-time events keep fresh: none while live, `fallbackMs` otherwise
 * (Requirement 13.3: refetch on focus and on an interval until reconnected).
 */
export function useFallbackInterval(fallbackMs: number): number | false {
  return useLiveStatus() === 'live' ? false : fallbackMs
}
