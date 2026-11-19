import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, authFetch } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'
import type {
  IncidentCategory,
  IncidentDetail,
  IncidentSortField,
  IncidentStatus,
  Schemas,
  Severity,
  SortDirection,
} from '@/api/types'

export interface IncidentFilters {
  status: IncidentStatus[]
  category?: IncidentCategory
  severity?: Severity
  from?: string
  to?: string
  search?: string
  sort: IncidentSortField
  direction: SortDirection
  page: number
  pageSize: number
}

export const incidentKeys = {
  all: ['incidents'] as const,
  lists: () => [...incidentKeys.all, 'list'] as const,
  list: (filters: IncidentFilters) => [...incidentKeys.lists(), filters] as const,
  detail: (id: string) => [...incidentKeys.all, 'detail', id] as const,
}

export function useIncidents(filters: IncidentFilters) {
  return useQuery({
    queryKey: incidentKeys.list(filters),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/v1/incidents', {
          signal,
          params: {
            query: {
              Status: filters.status.length > 0 ? filters.status : undefined,
              Category: filters.category,
              Severity: filters.severity,
              From: filters.from,
              To: filters.to,
              Search: filters.search || undefined,
              Sort: filters.sort,
              Direction: filters.direction,
              Page: filters.page,
              PageSize: filters.pageSize,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function useIncident(id: string) {
  return useQuery({
    queryKey: incidentKeys.detail(id),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/v1/incidents/{id}', { signal, params: { path: { id } } })),
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
  })
}

export type IncidentCommand =
  | { action: 'Edit'; body: Omit<Schemas['EditIncidentRequest'], 'version'> }
  | { action: 'BeginReview' }
  | { action: 'Verify'; body: { approvedSeverity: Severity } }
  | { action: 'Reject'; body: { reason: string } }
  | { action: 'Resolve'; body: { resolutionSummary: string } }
  | { action: 'Reopen'; body: { reason: string } }
  | { action: 'Close' }
  | { action: 'ChangeSeverity'; body: { severity: Severity } }

async function send(incident: IncidentDetail, command: IncidentCommand): Promise<IncidentDetail> {
  const path = { params: { path: { id: incident.id } } }
  const version = incident.version
  switch (command.action) {
    case 'Edit':
      return unwrap(await api.PATCH('/api/v1/incidents/{id}', { ...path, body: { ...command.body, version } }))
    case 'BeginReview':
      return unwrap(await api.POST('/api/v1/incidents/{id}/review', { ...path, body: { version } }))
    case 'Verify':
      return unwrap(await api.POST('/api/v1/incidents/{id}/verify', { ...path, body: { ...command.body, version } }))
    case 'Reject':
      return unwrap(await api.POST('/api/v1/incidents/{id}/reject', { ...path, body: { ...command.body, version } }))
    case 'Resolve':
      return unwrap(await api.POST('/api/v1/incidents/{id}/resolve', { ...path, body: { ...command.body, version } }))
    case 'Reopen':
      return unwrap(await api.POST('/api/v1/incidents/{id}/reopen', { ...path, body: { ...command.body, version } }))
    case 'Close':
      return unwrap(await api.POST('/api/v1/incidents/{id}/close', { ...path, body: { version } }))
    case 'ChangeSeverity':
      return unwrap(await api.PUT('/api/v1/incidents/{id}/severity', { ...path, body: { ...command.body, version } }))
  }
}

/** Runs a coordinator command against the version the caller last saw. A 409 refreshes the record. */
export function useIncidentCommand(incident: IncidentDetail) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (command: IncidentCommand) => send(incident, command),
    onSuccess: (updated) => {
      queryClient.setQueryData(incidentKeys.detail(updated.id), updated)
      void queryClient.invalidateQueries({ queryKey: incidentKeys.lists() })
    },
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) {
        void queryClient.invalidateQueries({ queryKey: incidentKeys.detail(incident.id) })
      }
    },
  })
}

/** Attachments require the bearer token, so they are fetched and saved rather than linked. */
export async function downloadAttachment(id: string, fileName: string) {
  const response = await authFetch(new Request(new URL(`/api/v1/attachments/${id}/content`, window.location.origin)))
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => null))
  const url = URL.createObjectURL(await response.blob())
  try {
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    link.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}
