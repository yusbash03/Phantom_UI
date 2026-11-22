import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'
import type { OperationalSettings } from '@/api/types'

export const settingsKeys = { all: ['settings'] as const }

export function useSettings() {
  return useQuery({
    queryKey: settingsKeys.all,
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/settings', { signal })),
  })
}

/** Saves against the version that was read; a 409 reloads the latest values. */
export function useSaveSettings() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { values: OperationalSettings; expectedUpdatedAt: string | null }) =>
      unwrap(await api.PUT('/api/v1/settings', { body: vars })),
    onSuccess: (data) => queryClient.setQueryData(settingsKeys.all, data),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 409) void queryClient.invalidateQueries({ queryKey: settingsKeys.all })
    },
  })
}
