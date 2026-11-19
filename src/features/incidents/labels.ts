import type { IncidentCategory, IncidentStatus, Severity } from '@/api/types'

export const CATEGORY_LABELS: Record<IncidentCategory, string> = {
  Fire: 'Fire',
  MedicalEmergency: 'Medical emergency',
  RoadAccident: 'Road accident',
  Security: 'Security',
  Flood: 'Flood',
  Infrastructure: 'Infrastructure',
  Other: 'Other',
}

export const STATUS_LABELS: Record<IncidentStatus, string> = {
  Reported: 'Reported',
  UnderReview: 'Under review',
  Verified: 'Verified',
  Assigned: 'Assigned',
  InProgress: 'In progress',
  Resolved: 'Resolved',
  Closed: 'Closed',
  Rejected: 'Rejected',
}

export const CATEGORIES = Object.keys(CATEGORY_LABELS) as IncidentCategory[]
export const STATUSES = Object.keys(STATUS_LABELS) as IncidentStatus[]
export const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low']

/** Statuses that still need attention; the list defaults to these. */
export const OPEN_STATUSES: IncidentStatus[] = ['Reported', 'UnderReview', 'Verified', 'Assigned', 'InProgress']

export function isCategory(value: string): value is IncidentCategory {
  return value in CATEGORY_LABELS
}

export function isStatus(value: string): value is IncidentStatus {
  return value in STATUS_LABELS
}

export function isSeverity(value: string): value is Severity {
  return (SEVERITIES as string[]).includes(value)
}
