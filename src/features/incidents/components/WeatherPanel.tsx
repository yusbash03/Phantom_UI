import { CloudOff, CloudSun, RefreshCw } from 'lucide-react'
import type { EnvironmentResponse, IncidentDetail } from '@/api/types'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'
import { useIncidentEnvironment, useRefreshEnvironment } from '../api'
import { FAILURE_LABELS, FIELD_LABELS, formatField, orderedFields } from './weather'

const time = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Weather near the incident (Requirement 9): context for planning, never evidence or a prediction (9.6). */
export function WeatherPanel({ incident }: { incident: IncidentDetail }) {
  const query = useIncidentEnvironment(incident.id)
  const refresh = useRefreshEnvironment(incident.id)
  const canRefresh = query.data && query.data.status !== 'NoCoordinates'

  return (
    <Card aria-labelledby="weather-title">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle id="weather-title" className="flex items-center gap-2">
            <CloudSun className="size-4" aria-hidden /> Weather
          </CardTitle>
          {canRefresh && (
            <Button size="sm" variant="ghost" onClick={() => refresh.mutate()} disabled={refresh.isPending} aria-label="Refresh weather">
              {refresh.isPending ? <Spinner /> : <RefreshCw aria-hidden />}
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Context only — not evidence of the emergency or a prediction.</p>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {query.isPending ? (
          <Spinner label="Loading weather…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Weather could not be loaded" />
        ) : (
          <EnvironmentBody data={query.data} />
        )}
      </CardContent>
    </Card>
  )
}

function EnvironmentBody({ data }: { data: EnvironmentResponse }) {
  if (data.status === 'NoCoordinates') {
    return <p className="text-muted-foreground">No coordinates yet, so weather cannot be looked up.</p>
  }

  return (
    <>
      {data.status === 'Pending' && <Spinner label="Looking up current weather…" />}
      {data.status === 'Unavailable' && data.failure && (
        <div role="alert" className="flex gap-2 rounded-md border border-warning/40 bg-warning/10 p-2 text-xs">
          <CloudOff className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div>
            <p className="font-medium">Weather unavailable</p>
            <p>{FAILURE_LABELS[data.failure.reason]}. {data.failure.message}</p>
            <p className="text-muted-foreground">Nothing else about the incident is affected.</p>
          </div>
        </div>
      )}
      {data.snapshot && (
        <div className="space-y-2">
          {(data.status !== 'Available' || !data.isForCurrentLocation) && (
            <p className="text-xs text-muted-foreground">{data.isForCurrentLocation ? 'Last successful reading:' : 'Last reading, for the previous location:'}</p>
          )}
          {data.snapshot.isFixture && (
            <Badge variant="outline" className="border-warning/40 text-warning">
              Recorded test fixture — not live weather
            </Badge>
          )}
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1" aria-label="Weather reading">
            {orderedFields(data.category).map(({ field, relevant }) => (
              <div key={field} className="contents">
                <dt className={cn('text-muted-foreground', relevant && 'font-medium text-foreground')}>
                  {FIELD_LABELS[field]}
                  {relevant && <span className="sr-only"> (relevant to this incident type)</span>}
                </dt>
                <dd className={cn(relevant && 'font-semibold')}>{formatField(field, data.snapshot!.reading)}</dd>
              </div>
            ))}
          </dl>
          <p className="text-xs text-muted-foreground">
            Source: {data.snapshot.provider} · retrieved {time.format(new Date(data.snapshot.retrievedAt))} · observed{' '}
            {time.format(new Date(data.snapshot.reading.observedAt))} · for {data.snapshot.latitude.toFixed(2)}, {data.snapshot.longitude.toFixed(2)} (within about 1 km)
            {!data.locationIsVerified && ' · location not yet verified'}.
          </p>
        </div>
      )}
      {!data.alertsSupported && <p className="text-xs text-muted-foreground">Weather alerts are not offered by this provider.</p>}
    </>
  )
}
