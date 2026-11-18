import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { RoleName, Schemas } from '@/api/types'

export interface UserFilters {
  role?: RoleName
  isActive?: boolean
  search?: string
  page: number
  pageSize: number
}

export const userKeys = {
  all: ['users'] as const,
  list: (filters: UserFilters) => [...userKeys.all, 'list', filters] as const,
}

export function useUsers(filters: UserFilters) {
  return useQuery({
    queryKey: userKeys.list(filters),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET('/api/v1/users', {
          signal,
          params: {
            query: {
              Role: filters.role,
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

function useUserMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<Schemas['UserResponse']>) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: userKeys.all }),
  })
}

export function useCreateUser() {
  return useUserMutation(async (body: Schemas['CreateUserRequest']) => unwrap(await api.POST('/api/v1/users', { body })))
}

export function useSetUserRoles() {
  return useUserMutation(async ({ id, roles }: { id: string; roles: RoleName[] }) =>
    unwrap(await api.PUT('/api/v1/users/{id}/roles', { params: { path: { id } }, body: { roles } })),
  )
}

export function useSetUserActive() {
  return useUserMutation(async ({ id, active }: { id: string; active: boolean }) =>
    active
      ? unwrap(await api.POST('/api/v1/users/{id}/activate', { params: { path: { id } } }))
      : unwrap(await api.POST('/api/v1/users/{id}/deactivate', { params: { path: { id } } })),
  )
}
