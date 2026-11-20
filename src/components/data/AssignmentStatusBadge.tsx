import { Ban, Car, CheckCircle2, CircleDot, Hand, MapPinned, ThumbsUp, type LucideIcon } from 'lucide-react'
import type { AssignmentStatus } from '@/api/types'
import { cn } from '@/lib/utils'

const STYLES: Record<AssignmentStatus, { icon: LucideIcon; label: string; className: string }> = {
  Assigned: { icon: CircleDot, label: 'Assigned', className: 'border-info/40 text-info' },
  Acknowledged: { icon: ThumbsUp, label: 'Acknowledged', className: 'border-primary/40 text-primary' },
  EnRoute: { icon: Car, label: 'En route', className: 'border-warning/40 bg-warning/10 text-warning' },
  OnScene: { icon: MapPinned, label: 'On scene', className: 'border-warning/40 bg-warning/10 text-warning' },
  Completed: { icon: CheckCircle2, label: 'Completed', className: 'border-success/40 bg-success/10 text-success' },
  Declined: { icon: Hand, label: 'Declined', className: 'border-border text-muted-foreground' },
  Cancelled: { icon: Ban, label: 'Cancelled', className: 'border-border text-muted-foreground' },
}

/** Assignment status with icon and text, never colour alone. */
export function AssignmentStatusBadge({ status, className }: { status: AssignmentStatus; className?: string }) {
  const { icon: Icon, label, className: tone } = STYLES[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  )
}
