import type { QueryKey } from '@tanstack/react-query'
import { assignmentKeys } from '@/features/assignments/api'
import { dashboardKeys } from '@/features/dashboard/api'
import { incidentKeys } from '@/features/incidents/api'
import { notificationKeys } from '@/features/notifications/api'
import { responderKeys } from '@/features/responders/api'

export type RealtimeEventType =
  | 'IncidentCreated'
  | 'IncidentUpdated'
  | 'IncidentStatusChanged'
  | 'IncidentResolved'
  | 'AnalysisCompleted'
  | 'AssignmentCreated'
  | 'AssignmentAcknowledged'
  | 'AssignmentStatusChanged'
  | 'AssignmentUpdated'
  | 'ResponderAvailabilityChanged'
  | 'NotificationCreated'

/** Identifiers only (Requirement 13.4); data is always refetched through the API. */
export interface RealtimeEvent {
  type: RealtimeEventType
  incidentId: string | null
  assignmentId: string | null
  responderId: string | null
  at: string
}

/**
 * The cached queries an event makes stale (Requirement 13.2: invalidate, never patch from the payload).
 * Prefix keys, so every filter/page of a list is covered.
 */
export function keysFor(event: RealtimeEvent): QueryKey[] {
  const incident = event.incidentId
  const aboutIncident = incident ? [incidentKeys.detail(incident), incidentKeys.timeline(incident)] : []
  const overview = [incidentKeys.lists(), [...incidentKeys.all, 'map'], dashboardKeys.all]

  switch (event.type) {
    case 'IncidentCreated':
      return overview
    case 'IncidentUpdated':
    case 'IncidentStatusChanged':
    case 'IncidentResolved':
      return [...aboutIncident, ...(incident ? [incidentKeys.relations(incident)] : []), ...overview, assignmentKeys.all]
    case 'AnalysisCompleted':
      return [...aboutIncident, ...(incident ? [incidentKeys.analyses(incident)] : []), ...overview]
    case 'AssignmentCreated':
    case 'AssignmentAcknowledged':
    case 'AssignmentStatusChanged':
      return [assignmentKeys.all, responderKeys.all, ...aboutIncident, ...overview]
    case 'AssignmentUpdated':
      return [assignmentKeys.all, ...(incident ? [incidentKeys.timeline(incident)] : [])]
    case 'ResponderAvailabilityChanged':
      return [responderKeys.all, dashboardKeys.all]
    case 'NotificationCreated':
      return [notificationKeys.all]
    default:
      return []
  }
}

/** Reconnect delays: quick at first, then every 30 s at most, forever, with jitter so clients spread out. */
export function reconnectDelay(previousRetryCount: number, random: () => number = Math.random): number {
  const base = [0, 2_000, 5_000, 10_000, 20_000][previousRetryCount] ?? 30_000
  return base === 0 ? 0 : Math.round(base * (0.8 + random() * 0.4))
}

/** Seconds until a JWT expires (undefined when it cannot be read). Used to refresh before reconnecting. */
export function secondsUntilExpiry(token: string, nowMs: number = Date.now()): number | undefined {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]!.replace(/-/g, '+').replace(/_/g, '/'))) as { exp?: number }
    return typeof payload.exp === 'number' ? payload.exp - nowMs / 1000 : undefined
  } catch {
    return undefined
  }
}
