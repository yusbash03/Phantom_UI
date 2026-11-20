import { useState } from 'react'
import { toast } from 'sonner'
import { MoreHorizontal, Search, UserPlus, Users } from 'lucide-react'
import type { ResponderAvailability, ResponderResponse } from '@/api/types'
import { useAuth } from '@/app/auth/auth-context'
import { AvailabilityBadge } from '@/components/data/AvailabilityBadge'
import { Pagination } from '@/components/data/Pagination'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { TableSkeleton } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebouncedValue } from '@/hooks/use-debounced-value'
import { useResponderFacets, useResponders, useSetResponderActive, useSetResponderAvailability } from './api'
import { ResponderFormDialog } from './ResponderFormDialog'

const PAGE_SIZE = 20
const ALL = 'all'
type ActiveFilter = 'active' | 'inactive' | 'all'
const AVAILABILITIES: ResponderAvailability[] = ['Available', 'Assigned', 'Unavailable']
const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function RespondersPage() {
  const { hasAnyRole } = useAuth()
  const isAdmin = hasAnyRole('Administrator')
  const [search, setSearch] = useState('')
  const [team, setTeam] = useState(ALL)
  const [skill, setSkill] = useState(ALL)
  const [availability, setAvailability] = useState<ResponderAvailability | typeof ALL>(ALL)
  const [active, setActive] = useState<ActiveFilter>('active')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<ResponderResponse | 'new' | null>(null)
  const [toggling, setToggling] = useState<ResponderResponse | null>(null)
  const debouncedSearch = useDebouncedValue(search.trim())

  const facets = useResponderFacets()
  const query = useResponders({
    search: debouncedSearch,
    team: team === ALL ? undefined : team,
    skill: skill === ALL ? undefined : skill,
    availability: availability === ALL ? undefined : availability,
    isActive: active === 'all' ? undefined : active === 'active',
    page,
    pageSize: PAGE_SIZE,
  })
  const setActiveState = useSetResponderActive()
  const setResponderAvailability = useSetResponderAvailability()
  const hasFilters = debouncedSearch !== '' || team !== ALL || skill !== ALL || availability !== ALL || active !== 'active'

  function filter<T>(setter: (value: T) => void) {
    return (value: T) => {
      setter(value)
      setPage(1)
    }
  }

  async function changeAvailability(responder: ResponderResponse, next: ResponderAvailability) {
    try {
      await setResponderAvailability.mutateAsync({ responder, availability: next })
      toast.success(`${responder.callSign} is now ${next.toLowerCase()}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Availability could not be changed.')
    }
  }

  return (
    <>
      <PageHeader
        title="Responders"
        description="People coordinators can assign to incidents, and whether they are free."
        actions={
          isAdmin && (
            <Button onClick={() => setEditing('new')}>
              <UserPlus aria-hidden /> Add responder
            </Button>
          )
        }
      />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 lg:grid-cols-5">
          <div className="relative sm:col-span-2 lg:col-span-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input aria-label="Search responders" placeholder="Name or call sign" className="pl-9" value={search} onChange={(e) => filter(setSearch)(e.target.value)} />
          </div>
          <Select value={team} onValueChange={filter(setTeam)}>
            <SelectTrigger aria-label="Filter by team" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>All teams</SelectItem>
              {facets.data?.teams.map((t) => (
                <SelectItem key={t} value={t}>
                  {t}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={skill} onValueChange={filter(setSkill)}>
            <SelectTrigger aria-label="Filter by skill" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any skill</SelectItem>
              {facets.data?.skills.map((s) => (
                <SelectItem key={s} value={s}>
                  {s}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={availability} onValueChange={filter((v: string) => setAvailability(v as ResponderAvailability | typeof ALL))}>
            <SelectTrigger aria-label="Filter by availability" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>Any availability</SelectItem>
              {AVAILABILITIES.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={active} onValueChange={filter((v: string) => setActive(v as ActiveFilter))}>
            <SelectTrigger aria-label="Filter by active state" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Deactivated</SelectItem>
              <SelectItem value="all">Active and deactivated</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isPending ? (
          <TableSkeleton columns={5} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Responders could not be loaded" />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No responders match these filters' : 'No responders yet'}
            description={hasFilters ? 'Try a different search or filter.' : isAdmin ? 'Add the first responder to start assigning incidents.' : 'An administrator adds responders.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Responder</TableHead>
                <TableHead className="hidden md:table-cell">Team &amp; skills</TableHead>
                <TableHead>Availability</TableHead>
                <TableHead className="hidden lg:table-cell">Last status</TableHead>
                {isAdmin && (
                  <TableHead className="w-12">
                    <span className="sr-only">Actions</span>
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((r) => (
                <TableRow key={r.id} className={r.isActive ? '' : 'opacity-70'}>
                  <TableCell>
                    <div className="font-mono text-xs text-muted-foreground">{r.callSign}</div>
                    <div className="font-medium">
                      {r.fullName}
                      {r.isDemoData && (
                        <Badge variant="outline" className="ml-2 border-info/40 text-info">
                          Demo data
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {[r.phone, r.linkedUser ? `account: ${r.linkedUser.displayName}` : 'no linked account'].filter(Boolean).join(' · ')}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="text-sm">{r.team}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {r.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="font-normal">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <AvailabilityBadge availability={r.availability} inactive={!r.isActive} />
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground lg:table-cell">{dateTime.format(new Date(r.lastStatusAt))}</TableCell>
                  {isAdmin && (
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${r.callSign}`}>
                            <MoreHorizontal />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setEditing(r)}>Edit details</DropdownMenuItem>
                          {r.isActive && r.availability !== 'Assigned' && (
                            <DropdownMenuItem onSelect={() => void changeAvailability(r, r.availability === 'Available' ? 'Unavailable' : 'Available')}>
                              Mark {r.availability === 'Available' ? 'unavailable' : 'available'}
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem variant={r.isActive ? 'destructive' : 'default'} onSelect={() => setToggling(r)}>
                            {r.isActive ? 'Deactivate' : 'Reactivate'}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {query.data && query.data.totalCount > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.totalCount} noun={['responder', 'responders']} onPageChange={setPage} />
        )}
      </Card>

      {editing && <ResponderFormDialog responder={editing === 'new' ? undefined : editing} onClose={() => setEditing(null)} />}
      {toggling && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setToggling(null)}
          title={toggling.isActive ? `Deactivate ${toggling.callSign}?` : `Reactivate ${toggling.callSign}?`}
          description={
            toggling.isActive
              ? 'They will no longer be offered for assignments. Their history is kept.'
              : 'They return as Unavailable until they or an administrator confirm they are available.'
          }
          confirmLabel={toggling.isActive ? 'Deactivate' : 'Reactivate'}
          destructive={toggling.isActive}
          onConfirm={async () => {
            await setActiveState.mutateAsync({ responder: toggling, active: !toggling.isActive })
            toast.success(`${toggling.callSign} ${toggling.isActive ? 'deactivated' : 'reactivated'}`)
          }}
        />
      )}
    </>
  )
}
