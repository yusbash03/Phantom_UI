import { CircleCheck, CircleMinus, Siren, type LucideIcon } from 'lucide-react'
import type { ResponderAvailability } from '@/api/types'
import { cn } from '@/lib/utils'

const STYLES: Record<ResponderAvailability, { icon: LucideIcon; label: string; className: string }> = {
  Available: { icon: CircleCheck, label: 'Available', className: 'border-success/40 bg-success/10 text-success' },
  Assigned: { icon: Siren, label: 'Assigned', className: 'border-warning/40 bg-warning/10 text-warning' },
  Unavailable: { icon: CircleMinus, label: 'Unavailable', className: 'border-border text-muted-foreground' },
}

/** Responder availability with icon and text, never colour alone. */
export function AvailabilityBadge({ availability, inactive, className }: { availability: ResponderAvailability; inactive?: boolean; className?: string }) {
  if (inactive) {
    return <span className={cn('inline-flex items-center rounded-md border border-dashed border-border px-2 py-0.5 text-xs text-muted-foreground', className)}>Deactivated</span>
  }
  const { icon: Icon, label, className: tone } = STYLES[availability]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}
