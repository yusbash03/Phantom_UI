import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, authFetch } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'
import { useEffect, useRef } from 'react'
import type {
  AnalysisResponse,
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
  analyses: (id: string) => [...incidentKeys.all, 'analyses', id] as const,
  relations: (id: string) => [...incidentKeys.all, 'relations', id] as const,
  map: (filters: MapFilters) => [...incidentKeys.all, 'map', filters] as const,
}

export interface MapFilters {
  status: IncidentStatus[]
  category?: IncidentCategory
  severity?: Severity
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
  | { action: 'VerifyLocation'; body: { text: string; latitude: number; longitude: number } }

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
    case 'VerifyLocation':
      return unwrap(await api.PUT('/api/v1/incidents/{id}/location', { ...path, body: { ...command.body, version } }))
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

const ANALYSIS_POLL_MS = 3000

function isRunning(analyses: AnalysisResponse[] | undefined) {
  const latest = analyses?.[0]
  return latest?.status === 'Pending' || latest?.status === 'Processing'
}

/**
 * AI analysis attempts, newest first. Polls while the latest attempt is queued or running and, when it
 * finishes, refreshes the incident so its AI-recommended fields match.
 */
export function useAnalyses(incidentId: string) {
  const queryClient = useQueryClient()
  const query = useQuery({
    queryKey: incidentKeys.analyses(incidentId),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/v1/incidents/{incidentId}/analyses', { signal, params: { path: { incidentId } } })),
    refetchInterval: (q) => (isRunning(q.state.data) ? ANALYSIS_POLL_MS : false),
  })

  const running = isRunning(query.data)
  const wasRunning = useRef(running)
  useEffect(() => {
    if (wasRunning.current && !running) {
      void queryClient.invalidateQueries({ queryKey: incidentKeys.detail(incidentId) })
    }
    wasRunning.current = running
  }, [running, incidentId, queryClient])

  return query
}

export function useRetryAnalysis(incidentId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () =>
      unwrap(await api.POST('/api/v1/incidents/{incidentId}/analyses/retry', { params: { path: { incidentId } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: incidentKeys.analyses(incidentId) }),
  })
}

export function useRelations(incidentId: string) {
  return useQuery({
    queryKey: incidentKeys.relations(incidentId),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/v1/incidents/{incidentId}/relations', { signal, params: { path: { incidentId } } })),
  })
}

/** A decision can close one incident and move its reports, so both incidents and the lists are refreshed. */
function useRefreshAfterRelationChange(incidentId: string) {
  const queryClient = useQueryClient()
  return (otherIncidentId?: string) => {
    void queryClient.invalidateQueries({ queryKey: incidentKeys.relations(incidentId) })
    void queryClient.invalidateQueries({ queryKey: incidentKeys.detail(incidentId) })
    void queryClient.invalidateQueries({ queryKey: incidentKeys.lists() })
    if (otherIncidentId) {
      void queryClient.invalidateQueries({ queryKey: incidentKeys.relations(otherIncidentId) })
      void queryClient.invalidateQueries({ queryKey: incidentKeys.detail(otherIncidentId) })
    }
  }
}

export function useDecideRelation(incidentId: string) {
  const refresh = useRefreshAfterRelationChange(incidentId)
  return useMutation({
    mutationFn: async (vars: { relationId: string; otherIncidentId: string; decision: Schemas['RelationDecision']; primaryIncidentId?: string }) =>
      unwrap(
        await api.PUT('/api/v1/relations/{id}', {
          params: { path: { id: vars.relationId } },
          body: { decision: vars.decision, primaryIncidentId: vars.primaryIncidentId ?? null },
        }),
      ),
    onSettled: (_data, _error, vars) => refresh(vars.otherIncidentId),
  })
}

export function useLinkIncident(incidentId: string) {
  const refresh = useRefreshAfterRelationChange(incidentId)
  return useMutation({
    mutationFn: async (otherIncidentNumber: string) =>
      unwrap(
        await api.POST('/api/v1/incidents/{incidentId}/relations', {
          params: { path: { incidentId } },
          body: { otherIncidentNumber },
        }),
      ),
    onSuccess: (relation) => refresh(relation.other.id),
  })
}

/** Incidents for the operations map; refreshed every 30 s so the picture stays current. */
export function useIncidentMap(filters: MapFilters) {
  return useQuery({
    queryKey: incidentKeys.map(filters),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/v1/incidents/map', {
          signal,
          params: {
            query: {
              Status: filters.status.length > 0 ? filters.status : undefined,
              Category: filters.category,
              Severity: filters.severity,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  })
}
