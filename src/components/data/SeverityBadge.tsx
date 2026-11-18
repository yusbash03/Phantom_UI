import { AlertOctagon, AlertTriangle, CircleAlert, Info, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Mirrors PHANTOM.Domain.Incidents.Severity. Replace with the generated contract type once incident endpoints exist.
export type Severity = 'Low' | 'Medium' | 'High' | 'Critical'

const STYLES: Record<Severity, { icon: LucideIcon; className: string }> = {
  Critical: { icon: AlertOctagon, className: 'border-severity-critical/40 bg-severity-critical/15 text-severity-critical' },
  High: { icon: AlertTriangle, className: 'border-severity-high/40 bg-severity-high/15 text-severity-high' },
  Medium: { icon: CircleAlert, className: 'border-severity-medium/40 bg-severity-medium/10 text-severity-medium' },
  Low: { icon: Info, className: 'border-severity-low/40 bg-severity-low/10 text-severity-low' },
}

interface SeverityBadgeProps {
  severity: Severity | null | undefined
  /** "AI" marks a recommendation rather than an approved value (product steering). */
  source?: 'approved' | 'ai'
  className?: string
}

/** Severity is always conveyed by icon and text, never colour alone (requirements.md 18.5). */
export function SeverityBadge({ severity, source = 'approved', className }: SeverityBadgeProps) {
  if (!severity) {
    return (
      <span className={cn('inline-flex items-center rounded-md border border-border px-2 py-0.5 text-xs text-muted-foreground', className)}>
        {source === 'ai' ? 'No AI recommendation' : 'Not yet assessed'}
      </span>
    )
  }

  const { icon: Icon, className: tone } = STYLES[severity]
  const label = source === 'ai' ? `AI recommends ${severity}` : `${severity} severity`
  return (
    <span
      aria-label={label}
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium',
        tone,
        source === 'ai' && 'border-dashed',
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {source === 'ai' && <span className="font-semibold">AI ·</span>}
      {severity}
    </span>
  )
}
