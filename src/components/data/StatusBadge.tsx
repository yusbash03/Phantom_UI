import { Ban, CheckCircle2, CircleDot, Eye, Loader, Lock, ShieldCheck, Users, type LucideIcon } from 'lucide-react'
import type { IncidentStatus } from '@/api/types'
import { STATUS_LABELS } from '@/features/incidents/labels'
import { cn } from '@/lib/utils'

const STYLES: Record<IncidentStatus, { icon: LucideIcon; className: string }> = {
  Reported: { icon: CircleDot, className: 'border-info/40 text-info' },
  UnderReview: { icon: Eye, className: 'border-warning/40 text-warning' },
  Verified: { icon: ShieldCheck, className: 'border-primary/40 text-primary' },
  Assigned: { icon: Users, className: 'border-primary/40 text-primary' },
  InProgress: { icon: Loader, className: 'border-warning/40 bg-warning/10 text-warning' },
  Resolved: { icon: CheckCircle2, className: 'border-success/40 bg-success/10 text-success' },
  Closed: { icon: Lock, className: 'border-border text-muted-foreground' },
  Rejected: { icon: Ban, className: 'border-border text-muted-foreground' },
}

/** Incident status with icon and text, never colour alone (requirements.md 18.5). */
export function StatusBadge({ status, className }: { status: IncidentStatus; className?: string }) {
  const { icon: Icon, className: tone } = STYLES[status]
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium whitespace-nowrap', tone, className)}>
      <Icon className="size-3.5" aria-hidden />
      {STATUS_LABELS[status]}
    </span>
  )
}
