import type { ResponderResponse } from '@/api/types'

/** Why a responder needs an override to be assigned (Requirement 11.2), or null when they can simply be assigned. */
export function overrideNeededFor(responder: ResponderResponse): string | null {
  if (!responder.isActive) return 'deactivated'
  if (responder.availability === 'Assigned') return 'already on another active assignment'
  if (responder.availability === 'Unavailable') return 'marked unavailable'
  return null
}
