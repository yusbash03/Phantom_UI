import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly: boolean, page: number, pageSize: number) => [...notificationKeys.all, 'list', { unreadOnly, page, pageSize }] as const,
}

/** Polled every 30 s; SignalR push arrives with task 29. */
export function useNotifications(unreadOnly: boolean, page: number, pageSize: number) {
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly, page, pageSize),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/v1/notifications', { signal, params: { query: { UnreadOnly: unreadOnly, Page: page, PageSize: pageSize } } })),
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
  })
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => unwrap(await api.POST('/api/v1/notifications/{id}/read', { params: { path: { id } } })),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => unwrap(await api.POST('/api/v1/notifications/read-all')),
    onSettled: () => queryClient.invalidateQueries({ queryKey: notificationKeys.all }),
  })
}
