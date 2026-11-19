import { MapPin, MapPinCheck, MapPinOff, type LucideIcon } from 'lucide-react'
import type { Schemas } from '@/api/types'
import { cn } from '@/lib/utils'

type Provenance = Schemas['LocationProvenance']

interface LocationBadgeProps {
  hasCoordinates: boolean
  isVerified: boolean
  provenance?: Provenance
  className?: string
}

const PROVENANCE_TEXT: Record<Provenance, string> = {
  Reported: 'Reporter-supplied, unverified',
  AiInferred: 'AI-inferred, approximate',
  Geocoded: 'Geocoded, approximate',
  ManuallyVerified: 'Verified location',
}

/**
 * Honest location labelling (product steering): coordinates are never presented as exact
 * unless a person has verified them.
 */
export function LocationBadge({ hasCoordinates, isVerified, provenance, className }: LocationBadgeProps) {
  let icon: LucideIcon = MapPinOff
  let text = 'No coordinates'
  let tone = 'border-border text-muted-foreground'
  if (isVerified) {
    icon = MapPinCheck
    text = 'Verified location'
    tone = 'border-success/40 text-success'
  } else if (hasCoordinates) {
    icon = MapPin
    text = provenance ? PROVENANCE_TEXT[provenance] : 'Unverified location'
    tone = 'border-warning/40 text-warning'
  }
  const Icon = icon
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border border-dashed px-2 py-0.5 text-xs whitespace-nowrap', tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {text}
    </span>
  )
}
