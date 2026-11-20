import type { LocationProvenance, MapIncident, Severity } from '@/api/types'
import { CATEGORY_LABELS, STATUS_LABELS } from '@/features/incidents/labels'

export const PROVENANCE_LABELS: Record<LocationProvenance, string> = {
  Reported: 'Reporter-supplied, unverified',
  Geocoded: 'Geocoded, approximate',
  AiInferred: 'AI-inferred, approximate',
  ManuallyVerified: 'Verified by a coordinator',
}

const SEVERITY_TOKENS: Record<Severity, string> = {
  Critical: 'var(--severity-critical)',
  High: 'var(--severity-high)',
  Medium: 'var(--severity-medium)',
  Low: 'var(--severity-low)',
}

export interface MarkerAppearance {
  /** CSS colour for the marker fill: the approved severity, or neutral until a coordinator assesses it. */
  color: string
  /** Unverified locations get a dashed ring and an "Unverified" tag (design §7, requirement 8.8). */
  dashed: boolean
  tag: string | null
  /** Full spoken description: severity and verification are never conveyed by colour alone. */
  label: string
}

export function markerAppearance(item: MapIncident): MarkerAppearance {
  const severity = item.approvedSeverity ? `${item.approvedSeverity} severity` : 'severity not yet assessed'
  const location = item.isVerified ? 'verified location' : `unverified location (${PROVENANCE_LABELS[item.provenance].toLowerCase()})`
  return {
    color: item.approvedSeverity ? SEVERITY_TOKENS[item.approvedSeverity] : 'var(--muted-foreground)',
    dashed: !item.isVerified,
    tag: item.isVerified ? null : 'Unverified',
    label: `${item.number}, ${CATEGORY_LABELS[item.category]}, ${severity}, ${STATUS_LABELS[item.status]}, ${location}`,
  }
}

/** [west, south, east, north] around the items, or null when there is nothing to frame. */
export function boundsOf(items: MapIncident[]): [number, number, number, number] | null {
  if (items.length === 0) return null
  let west = Infinity
  let south = Infinity
  let east = -Infinity
  let north = -Infinity
  for (const { latitude, longitude } of items) {
    west = Math.min(west, longitude)
    east = Math.max(east, longitude)
    south = Math.min(south, latitude)
    north = Math.max(north, latitude)
  }
  return [west, south, east, north]
}
