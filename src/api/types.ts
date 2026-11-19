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
