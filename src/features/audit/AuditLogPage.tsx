import { Fragment, useState } from 'react'
import { Link } from 'react-router'
import { ChevronDown, ChevronRight, ScrollText, X } from 'lucide-react'
import type { AuditEntryResponse } from '@/api/types'
import { Pagination } from '@/components/data/Pagination'
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
import { useUsers } from '@/features/users/api'
import { useAuditFacets, useAuditSearch } from './api'

const PAGE_SIZE = 50
const ANY = 'any'
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'medium' })

function dayBoundary(day: string, end: boolean): string | undefined {
  if (!day) return undefined
  const date = new Date(`${day}T${end ? '23:59:59.999' : '00:00:00'}`)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

function pretty(json: string | null): string | null {
  if (!json) return null
  try {
    return JSON.stringify(JSON.parse(json), null, 2)
  } catch {
    return json
  }
}

/** Search the append-only audit log (Requirement 15.6). Read-only: nothing here can change a record. */
export function AuditLogPage() {
  const [actor, setActor] = useState(ANY)
  const [action, setAction] = useState(ANY)
  const [entityType, setEntityType] = useState(ANY)
  const [entityId, setEntityId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)
  const [expanded, setExpanded] = useState<number | null>(null)
  const debouncedEntityId = useDebouncedValue(entityId.trim())

  const facets = useAuditFacets()
  const users = useUsers({ page: 1, pageSize: 100 })
  const invalidRange = from !== '' && to !== '' && from > to
  const query = useAuditSearch({
    actorUserId: actor === ANY ? undefined : actor,
    action: action === ANY ? undefined : action,
    entityType: entityType === ANY ? undefined : entityType,
    entityId: debouncedEntityId,
    from: dayBoundary(from, false),
    to: dayBoundary(to, true),
    page,
    pageSize: PAGE_SIZE,
  })
  const hasFilters = actor !== ANY || action !== ANY || entityType !== ANY || entityId !== '' || from !== '' || to !== ''

  function set<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  function clear() {
    setActor(ANY)
    setAction(ANY)
    setEntityType(ANY)
    setEntityId('')
    setFrom('')
    setTo('')
    setPage(1)
  }

  return (
    <>
      <PageHeader title="Audit log" description="Every significant action, who took it and what changed. Records cannot be edited or deleted." />
      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-3">
          <Select value={actor} onValueChange={set(setActor)}>
            <SelectTrigger aria-label="Filter by actor" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any actor</SelectItem>
              {users.data?.items.map((u) => (
                <SelectItem key={u.id} value={u.id}>
                  {u.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={action} onValueChange={set(setAction)}>
            <SelectTrigger aria-label="Filter by action" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any action</SelectItem>
              {facets.data?.actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={entityType} onValueChange={set(setEntityType)}>
            <SelectTrigger aria-label="Filter by entity type" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ANY}>Any entity type</SelectItem>
              {facets.data?.entityTypes.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input aria-label="Entity ID" placeholder="Entity ID (exact)" value={entityId} onChange={(e) => set(setEntityId)(e.target.value)} />
          <div className="flex items-center gap-2">
            <Label htmlFor="audit-from" className="w-10 shrink-0 text-xs text-muted-foreground">
              From
            </Label>
            <Input id="audit-from" type="date" value={from} onChange={(e) => set(setFrom)(e.target.value)} />
          </div>
          <div className="flex items-center gap-2">
            <Label htmlFor="audit-to" className="w-10 shrink-0 text-xs text-muted-foreground">
              To
            </Label>
            <Input id="audit-to" type="date" value={to} onChange={(e) => set(setTo)(e.target.value)} />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" className="justify-self-start" onClick={clear}>
              <X aria-hidden /> Clear filters
            </Button>
          )}
        </div>

        {invalidRange ? (
          <p role="alert" className="p-6 text-sm text-destructive">
            The “To” date must be on or after the “From” date.
          </p>
        ) : query.isPending ? (
          <TableSkeleton columns={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="The audit log could not be loaded" />
        ) : query.data.items.length === 0 ? (
          <EmptyState icon={ScrollText} title={hasFilters ? 'No records match these filters' : 'No audit records yet'} />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <span className="sr-only">Details</span>
                </TableHead>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead className="hidden md:table-cell">Entity</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((entry) => (
                <Fragment key={entry.id}>
                  <TableRow>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        aria-expanded={expanded === entry.id}
                        aria-label={`${expanded === entry.id ? 'Hide' : 'Show'} details of record ${entry.id}`}
                        onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                      >
                        {expanded === entry.id ? <ChevronDown /> : <ChevronRight />}
                      </Button>
                    </TableCell>
                    <TableCell className="text-sm whitespace-nowrap">{dateTime.format(new Date(entry.occurredAt))}</TableCell>
                    <TableCell className="text-sm">
                      <Actor entry={entry} />
                    </TableCell>
                    <TableCell className="font-mono text-xs">{entry.action}</TableCell>
                    <TableCell className="hidden text-xs md:table-cell">
                      <Entity entry={entry} />
                    </TableCell>
                  </TableRow>
                  {expanded === entry.id && (
                    <TableRow className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={5}>
                        <Details entry={entry} />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}

        {query.data && query.data.totalCount > 0 && !invalidRange && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.totalCount} noun={['record', 'records']} onPageChange={setPage} />
        )}
      </Card>
    </>
  )
}

function Actor({ entry }: { entry: AuditEntryResponse }) {
  if (entry.actor) return <>{entry.actor.displayName}</>
  return (
    <Badge variant="outline" className="text-muted-foreground">
      {entry.actorType === 'Anonymous' ? 'Public' : 'System'}
    </Badge>
  )
}

function Entity({ entry }: { entry: AuditEntryResponse }) {
  return (
    <span>
      {entry.entityType}
      {entry.entityId &&
        (entry.entityType === 'Incident' ? (
          <Link to={`/incidents/${entry.entityId}`} className="ml-1 font-mono text-muted-foreground hover:text-foreground hover:underline">
            {entry.entityId.slice(0, 8)}…
          </Link>
        ) : (
          <span className="ml-1 font-mono text-muted-foreground" title={entry.entityId}>
            {entry.entityId.slice(0, 8)}…
          </span>
        ))}
    </span>
  )
}

function Details({ entry }: { entry: AuditEntryResponse }) {
  const blocks: [string, string | null][] = [
    ['Before', pretty(entry.previousValue)],
    ['After', pretty(entry.newValue)],
    ['Metadata', pretty(entry.metadata)],
  ]
  return (
    <div className="space-y-2 text-xs">
      <p className="text-muted-foreground">
        Entity ID <span className="font-mono">{entry.entityId ?? '—'}</span> · correlation ID <span className="font-mono">{entry.correlationId ?? '—'}</span>
      </p>
      <div className="grid gap-2 md:grid-cols-3">
        {blocks.map(([label, value]) => (
          <div key={label}>
            <p className="font-medium">{label}</p>
            {value ? <pre className="max-h-64 overflow-auto rounded bg-background p-2 font-mono text-[11px] whitespace-pre-wrap">{value}</pre> : <p className="text-muted-foreground">—</p>}
          </div>
        ))}
      </div>
    </div>
  )
}
