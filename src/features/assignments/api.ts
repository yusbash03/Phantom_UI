import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/api/client'
import { unwrap } from '@/api/errors'
import type { AssignmentResponse } from '@/api/types'
import { incidentKeys } from '@/features/incidents/api'
import { responderKeys } from '@/features/responders/api'

export const assignmentKeys = {
  all: ['assignments'] as const,
  mine: () => [...assignmentKeys.all, 'mine'] as const,
  forIncident: (incidentId: string) => [...assignmentKeys.all, 'incident', incidentId] as const,
}

/** The signed-in responder's assignments, active first. Refreshed every 30 s so new ones appear. */
export function useMyAssignments() {
  return useQuery({
    queryKey: assignmentKeys.mine(),
    queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/assignments/mine', { signal })),
    refetchInterval: 30_000,
  })
}

export function useIncidentAssignments(incidentId: string) {
  return useQuery({
    queryKey: assignmentKeys.forIncident(incidentId),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/v1/incidents/{incidentId}/assignments', { signal, params: { path: { incidentId } } })),
  })
}

/** Assignment changes can move the incident and the responder, so all three views are refreshed. */
function useRefreshAfterAssignmentChange() {
  const queryClient = useQueryClient()
  return (assignment?: AssignmentResponse) => {
    void queryClient.invalidateQueries({ queryKey: assignmentKeys.all })
    void queryClient.invalidateQueries({ queryKey: responderKeys.all })
    void queryClient.invalidateQueries({ queryKey: incidentKeys.lists() })
    if (assignment) {
      void queryClient.invalidateQueries({ queryKey: incidentKeys.detail(assignment.incident.id) })
      void queryClient.invalidateQueries({ queryKey: incidentKeys.timeline(assignment.incident.id) })
    }
  }
}

export function useAssignResponder(incidentId: string) {
  const refresh = useRefreshAfterAssignmentChange()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: { responderId: string; overrideReason: string | null }) =>
      unwrap(await api.POST('/api/v1/incidents/{incidentId}/assignments', { params: { path: { incidentId } }, body })),
    onSettled: (assignment) => {
      refresh(assignment)
      void queryClient.invalidateQueries({ queryKey: incidentKeys.detail(incidentId) })
    },
  })
}

export type AssignmentCommand =
  | { action: 'Acknowledge' }
  | { action: 'Decline'; reason: string }
  | { action: 'EnRoute' }
  | { action: 'OnScene' }
  | { action: 'PostUpdate'; body: string }
  | { action: 'Complete'; notes: string }
  | { action: 'Cancel'; reason: string }

async function send(id: string, command: AssignmentCommand): Promise<AssignmentResponse> {
  const path = { params: { path: { id } } }
  switch (command.action) {
    case 'Acknowledge':
      return unwrap(await api.POST('/api/v1/assignments/{id}/acknowledge', path))
    case 'Decline':
      return unwrap(await api.POST('/api/v1/assignments/{id}/decline', { ...path, body: { reason: command.reason } }))
    case 'EnRoute':
      return unwrap(await api.POST('/api/v1/assignments/{id}/status', { ...path, body: { status: 'EnRoute' } }))
    case 'OnScene':
      return unwrap(await api.POST('/api/v1/assignments/{id}/status', { ...path, body: { status: 'OnScene' } }))
    case 'PostUpdate':
      return unwrap(await api.POST('/api/v1/assignments/{id}/updates', { ...path, body: { body: command.body } }))
    case 'Complete':
      return unwrap(await api.POST('/api/v1/assignments/{id}/complete', { ...path, body: { notes: command.notes } }))
    case 'Cancel':
      return unwrap(await api.POST('/api/v1/assignments/{id}/cancel', { ...path, body: { reason: command.reason } }))
  }
}

export function useAssignmentCommand(assignment: AssignmentResponse) {
  const refresh = useRefreshAfterAssignmentChange()
  return useMutation({
    mutationFn: (command: AssignmentCommand) => send(assignment.id, command),
    onSettled: () => refresh(assignment),
  })
}
