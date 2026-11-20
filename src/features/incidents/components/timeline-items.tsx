import { Cog, FileText, Gavel, GitMerge, MapPin, MessageSquare, Sparkles, Users, type LucideIcon } from 'lucide-react'
import type { TimelineEvent, TimelineEventKind } from '@/api/types'
import type { TimelineItem } from '@/components/data/Timeline'
import { Badge } from '@/components/ui/badge'

export const TIMELINE_ICONS: Record<TimelineEventKind, LucideIcon> = {
  Report: FileText,
  Ai: Sparkles,
  Decision: Gavel,
  Assignment: Users,
  Update: MessageSquare,
  Correlation: GitMerge,
  Location: MapPin,
  System: Cog,
}

const time = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

function who(event: TimelineEvent): string {
  if (event.actor) return event.actor.displayName
  if (event.actorType === 'Anonymous') return 'Member of the public'
  return 'PHANTOM (automatic)'
}

export function toTimelineItem(event: TimelineEvent): TimelineItem {
  const badge = event.isAi ? (
    <Badge variant="outline" className="border-dashed border-info/50 text-info">
      AI
    </Badge>
  ) : event.actorType === 'System' ? (
    <Badge variant="outline" className="text-muted-foreground">
      System
    </Badge>
  ) : null
  return {
    id: event.id,
    icon: TIMELINE_ICONS[event.kind],
    title: event.summary,
    meta: `${time.format(new Date(event.occurredAt))} · ${who(event)}`,
    detail: event.detail,
    badge,
    tone: event.isAi ? 'ai' : event.actorType === 'System' ? 'system' : 'default',
  }
}

