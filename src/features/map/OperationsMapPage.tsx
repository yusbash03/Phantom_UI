import { Suspense, lazy, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Info, MapPin, MapPinOff } from 'lucide-react'
import type { MapIncident } from '@/api/types'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { StatusBadge } from '@/components/data/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useIncidentMap, type MapFilters } from '@/features/incidents/api'
import {
  CATEGORIES,
  CATEGORY_LABELS,
  OPEN_STATUSES,
  SEVERITIES,
  STATUSES,
  STATUS_LABELS,
  isCategory,
  isSeverity,
  isStatus,
} from '@/features/incidents/labels'
import { PROVENANCE_LABELS } from './markers'

// Mapbox GL is large; load it only on this screen.
const IncidentMap = lazy(() => import('./IncidentMap'))

const ALL = 'all'
const OPEN = 'open'
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function OperationsMapPage() {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status') ?? OPEN
  const category = params.get('category') ?? ALL
  const severity = params.get('severity') ?? ALL
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const filters: MapFilters = {
    status: statusParam === OPEN ? OPEN_STATUSES : isStatus(statusParam) ? [statusParam] : [],
    category: isCategory(category) ? category : undefined,
    severity: isSeverity(severity) ? severity : undefined,
  }
  const query = useIncidentMap(filters)
  const items = query.data?.items ?? []
  const selected = items.find((i) => i.id === selectedId) ?? null

  function update(key: string, value: string, fallback: string) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      if (value === fallback) next.delete(key)
      else next.set(key, value)
      return next
    })
  }

  return (
    <>
      <PageHeader title="Operations map" description="Where reported incidents are, and how sure we are of each location." />

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <Select value={statusParam} onValueChange={(v) => update('status', v, OPEN)}>
          <SelectTrigger aria-label="Filter by status" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={OPEN}>Open incidents</SelectItem>
            <SelectItem value={ALL}>All statuses</SelectItem>
            {STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {STATUS_LABELS[s]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={category} onValueChange={(v) => update('category', v, ALL)}>
          <SelectTrigger aria-label="Filter by category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>All categories</SelectItem>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={severity} onValueChange={(v) => update('severity', v, ALL)}>
          <SelectTrigger aria-label="Filter by approved severity" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Any approved severity</SelectItem>
            {SEVERITIES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {query.data && (query.data.withoutCoordinates > 0 || query.data.truncated) && (
        <output className="mb-4 flex items-start gap-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm">
          <Info className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />
          <div>
            {query.data.withoutCoordinates > 0 && (
              <p>
                {query.data.withoutCoordinates} matching incident{query.data.withoutCoordinates === 1 ? ' has' : 's have'} no coordinates and{' '}
                {query.data.withoutCoordinates === 1 ? 'is' : 'are'} not shown on the map.{' '}
                <Link to="/incidents" className="underline underline-offset-2">
                  Review them in the incident list
                </Link>
                .
              </p>
            )}
            {query.data.truncated && <p>Only the 1,000 most recent incidents are shown. Narrow the filters to see others.</p>}
          </div>
        </output>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="overflow-hidden py-0 lg:col-span-2">
          <div className="h-[60vh] min-h-[420px]">
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
                <IncidentMap items={items} selectedId={selectedId} onSelect={setSelectedId} />
              </Suspense>
            )}
          </div>
          <Legend />
        </Card>

        <div className="space-y-4">
          {selected ? (
            <SelectedIncident item={selected} onClose={() => setSelectedId(null)} />
          ) : (
            <Card>
              <CardContent className="text-sm text-muted-foreground">Select a marker, or an incident below, to see its details.</CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>
                On the map {query.data && <span className="font-normal text-muted-foreground">({items.length})</span>}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {query.isPending ? (
                <Spinner label="Loading incidents…" />
              ) : items.length === 0 ? (
                <EmptyState icon={MapPinOff} title="Nothing to plot" description="No incidents with coordinates match these filters." />
              ) : (
                <ul className="max-h-80 space-y-1 overflow-y-auto" aria-label="Incidents on the map">
                  {items.map((item) => (
                    <li key={item.id}>
                      <button
                        type="button"
                        aria-pressed={item.id === selectedId}
                        onClick={() => setSelectedId(item.id)}
                        className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted aria-pressed:bg-muted"
                      >
                        <span className="font-mono text-xs text-muted-foreground">{item.number}</span>
                        <span className="min-w-0 flex-1 truncate">{item.title}</span>
                        {!item.isVerified && (
                          <Badge variant="outline" className="border-dashed text-[10px]">
                            Unverified
                          </Badge>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  )
}

/** The incident "popup": details and, above all, how the location was obtained (8.8). */
function SelectedIncident({ item, onClose }: { item: MapIncident; onClose: () => void }) {
  return (
    <Card aria-labelledby="selected-incident-title" className={item.isVerified ? '' : 'border-dashed'}>
      <CardHeader>
        <p className="font-mono text-xs text-muted-foreground">{item.number}</p>
        <h2 id="selected-incident-title" className="leading-none font-semibold">
          {item.title}
        </h2>
        <div className="flex flex-wrap gap-2 pt-1">
          <StatusBadge status={item.status} />
          <SeverityBadge severity={item.approvedSeverity} />
          <Badge variant="secondary">{CATEGORY_LABELS[item.category]}</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="flex items-center gap-1 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            <MapPin className="size-3.5" aria-hidden /> Location
          </p>
          <p className="mt-0.5">{item.locationText}</p>
          <p className={`mt-1 text-xs ${item.isVerified ? 'text-success' : 'text-warning'}`}>{PROVENANCE_LABELS[item.provenance]}</p>
          {item.geocoderPlaceName && !item.isVerified && <p className="text-xs text-muted-foreground">Matched as “{item.geocoderPlaceName}”</p>}
          <p className="font-mono text-xs text-muted-foreground">
            {item.latitude}, {item.longitude} · {item.precision === 'Exact' ? 'point' : `${item.precision.toLowerCase()} precision`}
          </p>
        </div>
        <p className="text-xs text-muted-foreground">Reported {dateTime.format(new Date(item.createdAt))}</p>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link to={`/incidents/${item.id}`}>Open incident</Link>
          </Button>
          <Button size="sm" variant="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

function Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-border px-4 py-3 text-xs text-muted-foreground" aria-label="Map legend">
      {SEVERITIES.map((s) => (
        <SeverityBadge key={s} severity={s} />
      ))}
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-3 rounded-full bg-muted-foreground" aria-hidden /> Not yet assessed
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-3 rounded-full border-2 border-foreground" aria-hidden /> Verified location
      </span>
      <span className="inline-flex items-center gap-1">
        <span className="inline-block size-3 rounded-full border-2 border-dashed border-foreground" aria-hidden /> Unverified (reported, geocoded or AI-inferred)
      </span>
    </div>
  )
}
