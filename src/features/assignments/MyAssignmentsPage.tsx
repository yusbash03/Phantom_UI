import { ClipboardList } from 'lucide-react'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/layout/AppShell'
import { useMyAssignments } from './api'
import { AssignmentCard } from './AssignmentCard'

const ACTIVE = new Set(['Assigned', 'Acknowledged', 'EnRoute', 'OnScene'])

/** A responder's own assignments (Requirement 11). Only their linked account sees them. */
export function MyAssignmentsPage() {
  const query = useMyAssignments()
  const active = query.data?.filter((a) => ACTIVE.has(a.status)) ?? []
  const past = query.data?.filter((a) => !ACTIVE.has(a.status)) ?? []

  return (
    <>
      <PageHeader title="My assignments" description="Incidents you have been assigned to. Acknowledge new ones, then keep the coordinator updated." />
      {query.isPending ? (
        <Spinner label="Loading your assignments…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Your assignments could not be loaded" />
      ) : query.data.length === 0 ? (
        <EmptyState icon={ClipboardList} title="No assignments" description="When a coordinator assigns you to an incident it appears here." />
      ) : (
        <div className="max-w-3xl space-y-6">
          <section aria-labelledby="active-assignments" className="space-y-3">
            <h2 id="active-assignments" className="text-base font-semibold">
              Active ({active.length})
            </h2>
            {active.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nothing active right now.</p>
            ) : (
              active.map((a) => <AssignmentCard key={a.id} assignment={a} perspective="responder" />)
            )}
          </section>
          {past.length > 0 && (
            <section aria-labelledby="past-assignments" className="space-y-3">
              <h2 id="past-assignments" className="text-base font-semibold text-muted-foreground">
                Earlier ({past.length})
              </h2>
              {past.map((a) => (
                <AssignmentCard key={a.id} assignment={a} perspective="responder" />
              ))}
            </section>
          )}
        </div>
      )}
    </>
  )
}
