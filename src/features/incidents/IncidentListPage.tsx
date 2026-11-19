import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Inbox, Search, X } from 'lucide-react'
import type { IncidentSortField, SortDirection } from '@/api/types'
import { LocationBadge } from '@/components/data/LocationBadge'
import { Pagination } from '@/components/data/Pagination'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { StatusBadge } from '@/components/data/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { TableSkeleton } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useIncidents, type IncidentFilters } from './api'
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
} from './labels'

const PAGE_SIZE = 20
const ALL = 'all'
const OPEN = 'open'

const SORTS: { value: `${IncidentSortField}:${SortDirection}`; label: string }[] = [
  { value: 'CreatedAt:Desc', label: 'Newest first' },
  { value: 'CreatedAt:Asc', label: 'Oldest first' },
  { value: 'Severity:Desc', label: 'Highest severity' },
  { value: 'UpdatedAt:Desc', label: 'Recently updated' },
  { value: 'Status:Asc', label: 'Status' },
]

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Converts a yyyy-mm-dd date input to the start or end of that local day, as an ISO instant. */
function dayBoundary(day: string, end: boolean): string | undefined {
  if (!day) return undefined
  const date = new Date(`${day}T${end ? '23:59:59.999' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

/** Reads list filters from the URL so a filtered view can be bookmarked or shared. */
function useListParams() {
  const [params, setParams] = useSearchParams()
  const statusParam = params.get('status') ?? OPEN
  const [sort = 'CreatedAt', direction = 'Desc'] = (params.get('sort') ?? 'CreatedAt:Desc').split(':') as [IncidentSortField?, SortDirection?]

  function update(changes: Record<string, string | undefined>, resetPage = true) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      for (const [key, value] of Object.entries(changes)) {
        if (value === undefined || value === '') next.delete(key)
        else next.set(key, value)
      }
      if (resetPage) next.delete('page')
      return next
    })
  }

  return {
    statusParam,
    category: params.get('category') ?? ALL,
    severity: params.get('severity') ?? ALL,
    from: params.get('from') ?? '',
    to: params.get('to') ?? '',
    q: params.get('q') ?? '',
    sortValue: `${sort}:${direction}`,
    sort,
    direction,
    page: Math.max(1, Number(params.get('page')) || 1),
    update,
    clear: () => setParams(new URLSearchParams()),
  }
}

export function IncidentListPage() {
  const navigate = useNavigate()
  const p = useListParams()
  const [search, setSearch] = useState(p.q)
  const debouncedSearch = useDebouncedValue(search.trim())

  // Push the search to the URL only when the debounced value itself changes, so clearing the
  // filters is not undone by a stale debounced value.
  const { update } = p
  const lastSearch = useRef(debouncedSearch)
  useEffect(() => {
    if (debouncedSearch === lastSearch.current) return
    lastSearch.current = debouncedSearch
    update({ q: debouncedSearch })
  }, [debouncedSearch, update])

  const filters: IncidentFilters = {
    status: p.statusParam === OPEN ? OPEN_STATUSES : isStatus(p.statusParam) ? [p.statusParam] : [],
    category: isCategory(p.category) ? p.category : undefined,
    severity: isSeverity(p.severity) ? p.severity : undefined,
    from: dayBoundary(p.from, false),
    to: dayBoundary(p.to, true),
    search: p.q,
    sort: p.sort,
    direction: p.direction,
    page: p.page,
    pageSize: PAGE_SIZE,
  }
  const query = useIncidents(filters)
  const hasFilters = p.statusParam !== OPEN || p.category !== ALL || p.severity !== ALL || p.from !== '' || p.to !== '' || p.q !== ''
  const invalidRange = p.from !== '' && p.to !== '' && p.from > p.to

  return (
    <>
      <PageHeader title="Incidents" description="Reports from the public and their handling, newest first." />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative sm:col-span-2">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search incidents"
              placeholder="Search number, title, description or location"
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select value={p.statusParam} onValueChange={(value) => p.update({ status: value === OPEN ? undefined : value })}>
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
          <Select value={p.sortValue} onValueChange={(value) => p.update({ sort: value === 'CreatedAt:Desc' ? undefined : value }, false)}>
            <SelectTrigger aria-label="Sort incidents" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SORTS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={p.category} onValueChange={(value) => p.update({ category: value === ALL ? undefined : value })}>
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
          <Select value={p.severity} onValueChange={(value) => p.update({ severity: value === ALL ? undefined : value })}>
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
          <div className="flex items-center gap-2">
            <Label htmlFor="from" className="w-10 shrink-0 text-xs text-muted-foreground">
              From
            </Label>
            <Input id="from" type="date" value={p.from} max={p.to || undefined} onChange={(e) => p.update({ from: e.target.value })} />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="to" className="w-10 shrink-0 text-xs text-muted-foreground">
              To
            </Label>
            <Input id="to" type="date" value={p.to} min={p.from || undefined} onChange={(e) => p.update({ to: e.target.value })} />
          </div>
          {hasFilters && (
            <Button
              variant="ghost"
              size="sm"
              className="justify-self-start lg:col-start-4 lg:justify-self-end"
              onClick={() => {
                setSearch('')
                p.clear()
              }}
            >
              <X aria-hidden /> Clear filters
            </Button>
          )}
        </div>

        {invalidRange ? (
          <p role="alert" className="p-6 text-sm text-destructive">
            The “To” date must be on or after the “From” date.
          </p>
        ) : query.isPending ? (
          <TableSkeleton columns={5} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Incidents could not be loaded" />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            icon={Inbox}
            title={hasFilters ? 'No incidents match these filters' : 'No open incidents'}
            description={hasFilters ? 'Try a different search or filter.' : 'New public reports will appear here.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Incident</TableHead>
                <TableHead className="hidden md:table-cell">Category</TableHead>
                <TableHead>Severity</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden lg:table-cell">Location</TableHead>
                <TableHead className="hidden sm:table-cell">Reported</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((incident) => (
                <TableRow
                  key={incident.id}
                  className="cursor-pointer"
                  onClick={(e) => {
                    if (!(e.target instanceof HTMLElement && e.target.closest('a'))) void navigate(`/incidents/${incident.id}`)
                  }}
                >
                  <TableCell className="max-w-72">
                    <Link to={`/incidents/${incident.id}`} className="font-mono text-xs text-muted-foreground hover:text-foreground hover:underline">
                      {incident.number}
                    </Link>
                    <div className="truncate font-medium">{incident.title}</div>
                    <div className="flex gap-1">
                      {incident.reportCount > 1 && <span className="text-xs text-muted-foreground">{incident.reportCount} reports</span>}
                      {incident.isDemoData && (
                        <Badge variant="outline" className="border-info/40 text-info">
                          Demo data
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{CATEGORY_LABELS[incident.category]}</TableCell>
                  <TableCell>
                    <div className="flex flex-col items-start gap-1">
                      <SeverityBadge severity={incident.approvedSeverity} />
                      {!incident.approvedSeverity && incident.aiRecommendedSeverity && (
                        <SeverityBadge severity={incident.aiRecommendedSeverity} source="ai" />
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={incident.status} />
                  </TableCell>
                  <TableCell className="hidden max-w-56 lg:table-cell">
                    <div className="truncate text-sm">{incident.locationText}</div>
                    <LocationBadge hasCoordinates={incident.hasCoordinates} isVerified={incident.locationIsVerified} />
                  </TableCell>
                  <TableCell className="hidden text-sm whitespace-nowrap text-muted-foreground sm:table-cell">
                    {dateTime.format(new Date(incident.createdAt))}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {query.data && query.data.totalCount > 0 && !invalidRange && (
          <Pagination
            page={p.page}
            pageSize={PAGE_SIZE}
            total={query.data.totalCount}
            noun={['incident', 'incidents']}
            onPageChange={(page) => p.update({ page: page > 1 ? String(page) : undefined }, false)}
          />
        )}
      </Card>
    </>
  )
}
