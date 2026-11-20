import type { components } from './generated/schema'

export type Schemas = components['schemas']
export type CurrentUser = Schemas['CurrentUserResponse']
export type LoginResponse = Schemas['LoginResponse']
export type UserResponse = Schemas['UserResponse']
export type PagedUsers = Schemas['PagedResultOfUserResponse']
export type SubmitReportResponse = Schemas['SubmitReportResponse']
export type PublicStatusResponse = Schemas['PublicStatusResponse']
export type PublicReportStatus = Schemas['PublicReportStatus']
export type IncidentCategory = Schemas['IncidentCategory']

export const ROLES = ['Administrator', 'IncidentCoordinator', 'Responder'] as const
export type RoleName = (typeof ROLES)[number]

export const ROLE_LABELS: Record<RoleName, string> = {
  Administrator: 'Administrator',
  IncidentCoordinator: 'Incident Coordinator',
  Responder: 'Responder',
}

export function isRoleName(value: string): value is RoleName {
  return (ROLES as readonly string[]).includes(value)
}

export type Severity = Schemas['Severity']
export type IncidentStatus = Schemas['IncidentStatus']
export type IncidentAction = Schemas['IncidentAction']
export type IncidentListItem = Schemas['IncidentListItem']
export type IncidentDetail = Schemas['IncidentDetailResponse']
export type IncidentReport = Schemas['IncidentReportResponse']
export type IncidentAttachment = Schemas['AttachmentResponse']
export type IncidentLocation = Schemas['LocationResponse']
export type IncidentSortField = Schemas['IncidentSortField']
export type SortDirection = Schemas['SortDirection']
export type AnalysisResponse = Schemas['AnalysisResponse']
export type AnalysisStatus = Schemas['AnalysisStatus']
export type AnalysisFailureCode = Schemas['AnalysisFailureCode']
export type IntelligenceResult = Schemas['IntelligenceResultV1']
export type Indication = Schemas['Indication']
export type EntityType = Schemas['EntityType']
export type RelationResponse = Schemas['RelationResponse']
export type RelationDecision = Schemas['RelationDecision']
export type RelationType = Schemas['RelationType']
export type MapIncident = Schemas['MapIncident']
export type IncidentMapResponse = Schemas['IncidentMapResponse']
export type LocationProvenance = Schemas['LocationProvenance']
export type ResponderResponse = Schemas['ResponderResponse']
export type ResponderAvailability = Schemas['ResponderAvailability']
