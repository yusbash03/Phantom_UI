import { useFallbackInterval } from '@/features/realtime/realtime-context'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: (unreadOnly: boolean, page: number, pageSize: number) => [...notificationKeys.all, 'list', { unreadOnly, page, pageSize }] as const,
}

/** Pushed over SignalR; polled every 30 s only while live updates are paused. */
export function useNotifications(unreadOnly: boolean, page: number, pageSize: number) {
  const refetchInterval = useFallbackInterval(30_000)
  return useQuery({
    queryKey: notificationKeys.list(unreadOnly, page, pageSize),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/v1/notifications', { signal, params: { query: { UnreadOnly: unreadOnly, Page: page, PageSize: pageSize } } })),
    refetchInterval,
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
