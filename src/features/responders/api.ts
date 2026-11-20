import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'
import type { ResponderAvailability, ResponderResponse, Schemas } from '@/api/types'

export interface ResponderFilters {
  team?: string
  skill?: string
  availability?: ResponderAvailability
  isActive?: boolean
  search?: string
  page: number
  pageSize: number
}

export const responderKeys = {
  all: ['responders'] as const,
  list: (filters: ResponderFilters) => [...responderKeys.all, 'list', filters] as const,
  facets: () => [...responderKeys.all, 'facets'] as const,
  mine: () => [...responderKeys.all, 'mine'] as const,
}

export function useResponders(filters: ResponderFilters) {
  return useQuery({
    queryKey: responderKeys.list(filters),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/v1/responders', {
          signal,
          params: {
            query: {
              Team: filters.team,
              Skill: filters.skill,
              Availability: filters.availability,
              IsActive: filters.isActive,
              Search: filters.search || undefined,
              Page: filters.page,
              PageSize: filters.pageSize,
            },
          },
        }),
      ),
    placeholderData: keepPreviousData,
  })
}

export function useResponderFacets() {
  return useQuery({
    queryKey: responderKeys.facets(),
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/responders/facets', { signal })),
    staleTime: 60_000,
  })
}

function useResponderMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<ResponderResponse>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSettled: () => queryClient.invalidateQueries({ queryKey: responderKeys.all }),
  })
}

export function useCreateResponder() {
  return useResponderMutation(async (body: Schemas['CreateResponderRequest']) => unwrap(await api.POST('/api/v1/responders', { body })))
}

export function useUpdateResponder() {
  return useResponderMutation(async ({ id, body }: { id: string; body: Schemas['UpdateResponderRequest'] }) =>
    unwrap(await api.PUT('/api/v1/responders/{id}', { params: { path: { id } }, body })),
  )
}

export function useSetResponderActive() {
  return useResponderMutation(async ({ responder, active }: { responder: ResponderResponse; active: boolean }) => {
    const options = { params: { path: { id: responder.id } }, body: { version: responder.version } }
    return active
      ? unwrap(await api.POST('/api/v1/responders/{id}/activate', options))
      : unwrap(await api.POST('/api/v1/responders/{id}/deactivate', options))
  })
}

export function useSetResponderAvailability() {
  return useResponderMutation(async ({ responder, availability }: { responder: ResponderResponse; availability: ResponderAvailability }) =>
    unwrap(
      await api.PUT('/api/v1/responders/{id}/availability', {
        params: { path: { id: responder.id } },
        body: { availability, version: responder.version },
      }),
    ),
  )
}

/** The signed-in responder's own profile; `null` when the account is not linked to one. */
export function useMyResponder(enabled: boolean) {
  return useQuery({
    queryKey: responderKeys.mine(),
    queryFn: async ({ signal }) => {
      try {
        return unwrap(await api.GET('/api/v1/responders/me', { signal }))
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) return null
        throw error
      }
    },
    enabled,
  })
}

export function useSetMyAvailability() {
  return useResponderMutation(async (availability: ResponderAvailability) =>
    unwrap(await api.PUT('/api/v1/responders/me/availability', { body: { availability, version: null } })),
  )
}
