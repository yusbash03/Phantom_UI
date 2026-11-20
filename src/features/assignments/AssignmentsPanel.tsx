import { Users } from 'lucide-react'
import type { IncidentDetail } from '@/api/types'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useIncidentAssignments } from './api'
import { AssignmentCard } from './AssignmentCard'

/** Who is assigned to the incident and how far they have got (Requirement 11). */
export function AssignmentsPanel({ incident }: { incident: IncidentDetail }) {
  const query = useIncidentAssignments(incident.id)
  return (
    <Card aria-labelledby="assignments-title">
      <CardHeader>
        <CardTitle id="assignments-title" className="flex items-center gap-2">
          <Users className="size-4" aria-hidden /> Assignments
        </CardTitle>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Spinner label="Loading assignments…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Assignments could not be loaded" />
        ) : query.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {incident.availableActions.includes('Assign')
              ? 'No responder is assigned yet. Use “Assign responder” above.'
              : incident.status === 'Reported' || incident.status === 'UnderReview'
                ? 'Responders can be assigned once the incident is verified.'
                : 'No responders were assigned.'}
          </p>
        ) : (
          <div className="space-y-3">
            {query.data.map((assignment) => (
              <AssignmentCard key={assignment.id} assignment={assignment} perspective="staff" />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
