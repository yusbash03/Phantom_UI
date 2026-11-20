import { useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'

/** Until real-time updates arrive (task 29) the dashboard refreshes itself on this interval. */
export const DASHBOARD_REFRESH_MS = 30_000

export const dashboardKeys = {
  all: ['dashboard'] as const,
  summary: () => [...dashboardKeys.all, 'summary'] as const,
  activity: (limit: number) => [...dashboardKeys.all, 'activity', limit] as const,
}

/** Headline counts, computed by the API from the database on every request (Requirement 12.2). */
export function useDashboardSummary() {
  return useQuery({
    queryKey: dashboardKeys.summary(),
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/dashboard/summary', { signal })),
    refetchInterval: DASHBOARD_REFRESH_MS,
  })
}

export function useDashboardActivity(limit = 15) {
  return useQuery({
    queryKey: dashboardKeys.activity(limit),
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/dashboard/activity', { signal, params: { query: { limit } } })),
    refetchInterval: DASHBOARD_REFRESH_MS,
  })
}
