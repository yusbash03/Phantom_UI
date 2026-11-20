import { History } from 'lucide-react'
import type { IncidentDetail } from '@/api/types'
import { Timeline } from '@/components/data/Timeline'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIncidentTimeline } from '../api'
import { toTimelineItem } from './timeline-items'

/** Unified history of the incident (Requirement 15.4), readable after closure (15.5). */
export function IncidentTimeline({ incident }: { incident: IncidentDetail }) {
  const query = useIncidentTimeline(incident.id, incident.updatedAt)
  return (
    <Card aria-labelledby="timeline-title">
      <CardHeader>
        <CardTitle id="timeline-title" className="flex items-center gap-2">
          <History className="size-4" aria-hidden /> History
        </CardTitle>
        <p className="text-xs text-muted-foreground">Every report, AI analysis, decision and assignment, oldest first. AI entries are marked AI.</p>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Spinner label="Loading history…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="The history could not be loaded" />
        ) : query.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No history recorded yet.</p>
        ) : (
          <Timeline items={query.data.map(toTimelineItem)} label="Incident history" />
        )}
      </CardContent>
    </Card>
  )
}
