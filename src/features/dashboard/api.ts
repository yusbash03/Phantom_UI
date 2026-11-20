import { useFallbackInterval } from '@/features/realtime/realtime-context'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'

/** Requirement 13.3: while live updates are paused the dashboard refetches on this interval. */
export const DASHBOARD_FALLBACK_MS = 60_000

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  activity: (limit: number) => [...dashboardKeys.all, 'activity', limit] as const,
}

/** Headline counts, computed by the API from the database on every request (Requirement 12.2). */
export function useDashboardSummary() {
  const refetchInterval = useFallbackInterval(DASHBOARD_FALLBACK_MS)
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/dashboard/summary', { signal })),
    refetchInterval,
  })
}

export function useDashboardActivity(limit = 15) {
  const refetchInterval = useFallbackInterval(DASHBOARD_FALLBACK_MS)
  return useQuery({
    queryKey: dashboardKeys.activity(limit),
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/dashboard/activity', { signal, params: { query: { limit } } })),
    refetchInterval,
  })
}
