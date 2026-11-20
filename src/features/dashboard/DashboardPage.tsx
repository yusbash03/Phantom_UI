import { Suspense, lazy } from 'react'
import { Link, useNavigate } from 'react-router'
import { Activity, AlertTriangle, ClipboardCheck, Clock, HardHat, Map as MapIcon, Siren, UserCheck, type LucideIcon } from 'lucide-react'
import type { ActivityEvent, DashboardSummary } from '@/api/types'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useIncidentMap } from '@/features/incidents/api'
import { TIMELINE_ICONS } from '@/features/incidents/components/timeline-items'
import { OPEN_STATUSES } from '@/features/incidents/labels'
import { timeAgo } from '@/features/notifications/links'
import { cn } from '@/lib/utils'
import { useDashboardActivity, useDashboardSummary } from './api'

// Mapbox GL is large; load it only when the map is on screen.
const IncidentMap = lazy(() => import('@/features/map/IncidentMap'))

const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'medium' })

interface Metric {
  key: keyof Omit<DashboardSummary, 'generatedAt'>
  label: string
  hint: string
  icon: LucideIcon
  to?: string
  /** Highlighted when non-zero: these need someone's attention. */
  attention?: 'danger' | 'warning'
}

const METRICS: Metric[] = [
  { key: 'activeIncidents', label: 'Active incidents', hint: 'Not resolved, closed or rejected', icon: Siren, to: '/incidents' },
  { key: 'highPriorityActiveIncidents', label: 'High priority', hint: 'Active, approved High or Critical', icon: AlertTriangle, attention: 'danger' },
  { key: 'awaitingReview', label: 'Awaiting review', hint: 'Reported or under review', icon: Clock, attention: 'warning' },
  { key: 'unassignedVerified', label: 'Verified, unassigned', hint: 'Verified with no responder yet', icon: ClipboardCheck, to: '/incidents?status=Verified', attention: 'warning' },
  { key: 'assignmentsAwaitingAcknowledgement', label: 'Awaiting acknowledgement', hint: 'Assignments not yet acknowledged', icon: HardHat, attention: 'warning' },
  { key: 'availableResponders', label: 'Available responders', hint: 'Active and available now', icon: UserCheck, to: '/responders' },
  { key: 'totalIncidents', label: 'Total incidents', hint: 'All time, every status', icon: Activity, to: '/incidents?status=all' },
]

/** The command view (Requirement 12): live counts, recent activity and where incidents are. */
export function DashboardPage() {
  const summary = useDashboardSummary()
  return (
    <>
      <PageHeader
        title="Command dashboard"
        description={summary.data ? `Counted from live records at ${time.format(new Date(summary.data.generatedAt))}.` : 'Counted from live records.'}
      />
      <section aria-label="Key figures" className="mb-6">
        {summary.isError ? (
          <Card>
            <ErrorState error={summary.error} onRetry={() => void summary.refetch()} title="The figures could not be loaded" />
          </Card>
        ) : (
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
            {METRICS.map((metric) => (
              <li key={metric.key}>
                <MetricTile metric={metric} value={summary.data?.[metric.key]} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-5">
        <RecentActivity />
        <MiniMap />
      </div>
    </>
  )
}

function MetricTile({ metric, value }: { metric: Metric; value: number | undefined }) {
  const Icon = metric.icon
  const highlighted = metric.attention && value !== undefined && value > 0
  const body = (
    <Card
      className={cn(
        'h-full gap-1 px-4 py-3',
        metric.to && 'transition-colors hover:bg-muted/50',
        highlighted && metric.attention === 'danger' && 'border-destructive/50',
        highlighted && metric.attention === 'warning' && 'border-warning/50',
      )}
    >
      <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Icon className={cn('size-3.5', highlighted && (metric.attention === 'danger' ? 'text-destructive' : 'text-warning'))} aria-hidden />
        {metric.label}
      </p>
      {value === undefined ? <Skeleton className="h-8 w-12" /> : <p className="text-2xl font-semibold tabular-nums">{value.toLocaleString()}</p>}
      <p className="text-[11px] text-muted-foreground">{metric.hint}</p>
    </Card>
  )
  const name = value === undefined ? metric.label : `${metric.label}: ${value}`
  return metric.to ? (
    <Link to={metric.to} aria-label={name} className="block h-full rounded-xl focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  )
}

function RecentActivity() {
  const query = useDashboardActivity()
  return (
    <Card className="lg:col-span-3" aria-labelledby="activity-title">
      <CardHeader>
        <CardTitle id="activity-title">Recent activity</CardTitle>
        <p className="text-xs text-muted-foreground">The latest changes to incidents, from the audit log. AI entries are marked AI.</p>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <Spinner label="Loading activity…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Activity could not be loaded" />
        ) : query.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nothing has happened yet.</p>
        ) : (
          <ul className="divide-y divide-border" aria-label="Recent activity">
            {query.data.map((event) => (
              <ActivityRow key={event.id} event={event} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityRow({ event }: { event: ActivityEvent }) {
  const Icon = TIMELINE_ICONS[event.kind]
  const who = event.actor?.displayName ?? (event.actorType === 'Anonymous' ? 'Member of the public' : 'PHANTOM (automatic)')
  return (
    <li className="flex gap-3 py-2.5">
      <Icon className={cn('mt-0.5 size-4 shrink-0', event.isAi ? 'text-info' : 'text-muted-foreground')} aria-hidden />
      <div className="min-w-0 flex-1 text-sm">
        <p className="flex flex-wrap items-center gap-x-2">
          <Link to={`/incidents/${event.incident.id}`} className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline">
            {event.incident.number}
          </Link>
          <span className="min-w-0 truncate">{event.summary}</span>
          {event.isAi && (
            <Badge variant="outline" className="border-dashed border-info/50 text-info">
              AI
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {event.incident.title} · {who} · <time dateTime={event.occurredAt}>{timeAgo(event.occurredAt)}</time>
        </p>
      </div>
    </li>
  )
}

function MiniMap() {
  const navigate = useNavigate()
  const query = useIncidentMap({ status: OPEN_STATUSES })
  const items = query.data?.items ?? []
  return (
    <Card className="gap-0 overflow-hidden py-0 lg:col-span-2" aria-labelledby="minimap-title">
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <h2 id="minimap-title" className="font-semibold">
          Where open incidents are
        </h2>
        <Button asChild size="sm" variant="ghost">
          <Link to="/map">
            <MapIcon aria-hidden /> Full map
          </Link>
        </Button>
      </div>
      <div className="h-80">
        {query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Map data could not be loaded" />
        ) : (
          <Suspense
            fallback={
              <div className="grid h-full place-items-center">
                <Spinner label="Loading map…" />
              </div>
            }
          >
            <IncidentMap items={items} selectedId={null} onSelect={(id) => void navigate(`/incidents/${id}`)} />
          </Suspense>
        )}
      </div>
      {query.data && (
        <p className="border-t border-border px-4 py-2 text-xs text-muted-foreground">
          {items.length} plotted
          {query.data.withoutCoordinates > 0 && ` · ${query.data.withoutCoordinates} without coordinates (not shown)`}. Dashed markers are unverified locations.
        </p>
      )}
    </Card>
  )
}
