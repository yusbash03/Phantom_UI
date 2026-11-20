import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'

export interface AuditFilters {
  actorUserId?: string
  entityType?: string
  entityId?: string
  action?: string
  from?: string
  to?: string
  page: number
  pageSize: number
}

export const auditKeys = {
  all: ['audit'] as const,
  search: (filters: AuditFilters) => [...auditKeys.all, 'search', filters] as const,
  facets: () => [...auditKeys.all, 'facets'] as const,
}

export function useAuditSearch(filters: AuditFilters) {
  return useQuery({
    queryKey: auditKeys.search(filters),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/v1/audit', {
          signal,
          params: {
            query: {
              ActorUserId: filters.actorUserId,
              EntityType: filters.entityType,
              EntityId: filters.entityId || undefined,
              Action: filters.action,
              From: filters.from,
              To: filters.to,
              Page: filters.page,
              PageSize: filters.pageSize,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function useAuditFacets() {
  return useQuery({
    queryKey: auditKeys.facets(),
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/audit/facets', { signal })),
    staleTime: 5 * 60_000,
  })
}
