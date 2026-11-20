import type { ReactNode } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, RotateCw, Sparkles } from 'lucide-react'
import type { AnalysisFailureCode, AnalysisResponse, EntityType, Indication, IncidentDetail, IntelligenceResult } from '@/api/types'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useAnalyses, useRetryAnalysis } from '../api'
import { CATEGORY_LABELS } from '../labels'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const INDICATION_TEXT: Record<Indication, string> = {
  Unknown: 'Not stated',
  NotIndicated: 'Not indicated',
  Possible: 'Possible',
  Reported: 'Reported by caller',
}

const FAILURE_TEXT: Record<AnalysisFailureCode, string> = {
  Timeout: 'The AI provider timed out',
  ProviderError: 'The AI provider returned an error',
  InvalidOutput: 'The AI response was not usable',
  RateLimited: 'The AI provider is rate-limiting requests',
  NotConfigured: 'No AI provider is configured',
}

const ENTITY_TEXT: Record<EntityType, string> = {
  Person: 'Person',
  Vehicle: 'Vehicle',
  Organisation: 'Organisation',
  Landmark: 'Landmark',
  Hazard: 'Hazard',
  Other: 'Other',
}

/**
 * The AI recommendation for an incident (requirements.md 6.12): clearly labelled, shown apart from and
 * side by side with the approved values, with failure and retry states. All model text is rendered as
 * plain text, never HTML (security steering).
 */
export function IntelligencePanel({ incident }: { incident: IncidentDetail }) {
  const query = useAnalyses(incident.id)

  return (
    <Card className="border-dashed" aria-labelledby="ai-panel-title">
      <CardHeader>
        <CardTitle id="ai-panel-title" className="flex flex-wrap items-center gap-2">
          <Sparkles className="size-4" aria-hidden /> AI recommendation
          <Badge variant="outline" className="border-dashed font-normal">
            Advisory only
          </Badge>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Suggestions to help triage. Approved values and every decision are made by a coordinator.
        </p>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <output aria-label="Loading AI analysis" className="block space-y-2">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-16" />
          </output>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="The AI analysis could not be loaded" />
        ) : (
          <PanelBody incident={incident} analyses={query.data} />
        )}
      </CardContent>
    </Card>
  )
}

function PanelBody({ incident, analyses }: { incident: IncidentDetail; analyses: AnalysisResponse[] }) {
  const latest = analyses[0]
  if (!latest) {
    return <p className="text-sm text-muted-foreground">No AI analysis has been requested for this incident.</p>
  }

  const lastSuccess = analyses.find((a) => a.status === 'Succeeded' && a.result)
  const earlier = analyses.slice(1)

  return (
    <div className="space-y-5">
      {(latest.status === 'Pending' || latest.status === 'Processing') && (
        <div className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
          <Spinner />
          <span>
            {latest.status === 'Pending' ? 'Analysis queued' : 'Analysing the report'}
            {latest.attempt > 1 && ` (attempt ${latest.attempt})`}…
          </span>
        </div>
      )}

      {latest.status === 'Failed' && <FailureNotice incidentId={incident.id} analysis={latest} />}

      {lastSuccess?.result ? (
        <ResultView incident={incident} analysis={lastSuccess} result={lastSuccess.result} superseded={lastSuccess !== latest} />
      ) : (
        latest.status !== 'Failed' && <p className="text-sm text-muted-foreground">The recommendation will appear here when the analysis finishes.</p>
      )}

      {earlier.length > 0 && (
        <details className="text-xs">
          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">Earlier attempts ({earlier.length})</summary>
          <ul className="mt-2 space-y-1">
            {earlier.map((a) => (
              <li key={a.id} className="flex flex-wrap gap-x-2 text-muted-foreground">
                <span className="font-medium text-foreground">Attempt {a.attempt}</span>
                <span>{a.status === 'Failed' && a.failureCode ? FAILURE_TEXT[a.failureCode] : a.status}</span>
                <span>· {dateTime.format(new Date(a.requestedAt))}</span>
                {a.requestedBy && <span>· retried by {a.requestedBy.displayName}</span>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}

function FailureNotice({ incidentId, analysis }: { incidentId: string; analysis: AnalysisResponse }) {
  const retry = useRetryAnalysis(incidentId)

  async function onRetry() {
    try {
      await retry.mutateAsync()
      toast.success('AI analysis queued again')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The analysis could not be retried.')
    }
  }

  return (
    <div role="alert" className="space-y-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-3 text-sm">
      <p className="flex items-center gap-2 font-medium text-destructive">
        <AlertTriangle className="size-4 shrink-0" aria-hidden />
        {analysis.failureCode ? FAILURE_TEXT[analysis.failureCode] : 'The AI analysis failed'}
        {analysis.attempt > 1 && ` (attempt ${analysis.attempt})`}
      </p>
      {analysis.failureMessage && <p className="text-muted-foreground">{analysis.failureMessage}</p>}
      <p className="text-muted-foreground">The report and incident are unchanged. You can review the report manually or try again.</p>
      <Button size="sm" variant="outline" onClick={() => void onRetry()} disabled={retry.isPending}>
        {retry.isPending ? <Spinner className="text-current" /> : <RotateCw aria-hidden />} Retry analysis
      </Button>
    </div>
  )
}

function ResultView({
  incident,
  analysis,
  result,
  superseded,
}: {
  incident: IncidentDetail
  analysis: AnalysisResponse
  result: IntelligenceResult
  superseded: boolean
}) {
  const severityDiffers = incident.approvedSeverity !== null && incident.approvedSeverity !== result.severity
  const categoryDiffers = incident.category !== result.category

  return (
    <div className="space-y-5 text-sm">
      {superseded && <p className="text-xs text-muted-foreground">Showing the last successful result (attempt {analysis.attempt}).</p>}

      <table className="w-full table-fixed border-separate border-spacing-0 overflow-hidden rounded-md border border-border text-left">
        <caption className="sr-only">AI recommendation compared with approved values</caption>
        <thead className="bg-muted/60 text-xs text-muted-foreground">
          <tr>
            <th scope="col" className="w-24 px-3 py-2 font-medium">
              <span className="sr-only">Field</span>
            </th>
            <th scope="col" className="px-3 py-2 font-medium">AI recommendation</th>
            <th scope="col" className="px-3 py-2 font-medium">Approved by coordinator</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row" className="border-t border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              Severity
            </th>
            <td className="border-t border-border px-3 py-2">
              <SeverityBadge severity={result.severity} source="ai" />
            </td>
            <td className="border-t border-border px-3 py-2">
              <SeverityBadge severity={incident.approvedSeverity} />
              {severityDiffers && <span className="ml-2 text-xs text-muted-foreground">differs</span>}
            </td>
          </tr>
          <tr>
            <th scope="row" className="border-t border-border px-3 py-2 text-xs font-medium text-muted-foreground">
              Category
            </th>
            <td className="border-t border-border px-3 py-2">AI · {CATEGORY_LABELS[result.category]}</td>
            <td className="border-t border-border px-3 py-2">
              {CATEGORY_LABELS[incident.category]}
              {categoryDiffers && <span className="ml-2 text-xs text-muted-foreground">differs</span>}
            </td>
          </tr>
        </tbody>
      </table>

      <Section title="Summary">
        <p className="whitespace-pre-wrap">{result.summary}</p>
      </Section>
      <Section title="Why this severity">
        <p className="whitespace-pre-wrap">{result.severityRationale}</p>
      </Section>

      <dl className="grid grid-cols-2 gap-3">
        <div>
          <dt className="text-xs text-muted-foreground">Possible casualties</dt>
          <dd className="font-medium">{INDICATION_TEXT[result.potentialCasualties]}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">People possibly trapped</dt>
          <dd className="font-medium">{INDICATION_TEXT[result.possibleTrappedPersons]}</dd>
        </div>
      </dl>

      <ItemList title="Suggested next steps" items={result.recommendedNextActions} ordered />
      <ItemList title="Hazards mentioned" items={result.hazards} />
      <ItemList title="Missing information" items={result.missingInformation} />
      <ItemList title="Places mentioned" items={result.namedLocations} />
      {result.extractedEntities.length > 0 && (
        <Section title="Named in the report">
          <ul className="flex flex-wrap gap-1">
            {result.extractedEntities.map((e, i) => (
              <li key={`${e.type}-${i}`}>
                <Badge variant="secondary" className="font-normal">
                  <span className="text-muted-foreground">{ENTITY_TEXT[e.type]}:</span> {e.value}
                </Badge>
              </li>
            ))}
          </ul>
        </Section>
      )}
      <Section title="Confidence">
        <p className="whitespace-pre-wrap text-muted-foreground">{result.confidenceExplanation}</p>
      </Section>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border pt-3 text-xs text-muted-foreground">
        {analysis.isSimulated && (
          <Badge variant="outline" className="border-warning/40 text-warning">
            Simulated — not a real AI result
          </Badge>
        )}
        <span>
          {analysis.provider} · {analysis.model}
        </span>
        {analysis.completedAt && <span>· {dateTime.format(new Date(analysis.completedAt))}</span>}
        {analysis.latencyMs !== null && <span>· {(analysis.latencyMs / 1000).toFixed(1)} s</span>}
        <span>· from report {analysis.reportReference}</span>
      </p>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">{title}</h3>
      {children}
    </section>
  )
}

function ItemList({ title, items, ordered }: { title: string; items: string[]; ordered?: boolean }) {
  if (items.length === 0) return null
  const List = ordered ? 'ol' : 'ul'
  return (
    <Section title={title}>
      <List className={`space-y-0.5 pl-5 ${ordered ? 'list-decimal' : 'list-disc'}`}>
        {items.map((item, i) => (
          <li key={i}>{item}</li>
        ))}
      </List>
    </Section>
  )
}
