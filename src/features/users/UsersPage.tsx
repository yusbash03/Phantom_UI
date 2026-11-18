import { ChevronLeft, ChevronRight, MoreHorizontal, Search, ShieldCheck, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { ROLES, ROLE_LABELS, isRoleName, type RoleName, type UserResponse } from '@/api/types'
import { useAuth } from '@/app/auth/auth-context'
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
import { useSetUserActive, useUsers } from './api'
import { CreateUserDialog } from './CreateUserDialog'
import { EditRolesDialog } from './EditRolesDialog'

const PAGE_SIZE = 20
type StatusFilter = 'all' | 'active' | 'inactive'

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const [search, setSearch] = useState('')
  const [role, setRole] = useState<RoleName | 'all'>('all')
  const [status, setStatus] = useState<StatusFilter>('active')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState<UserResponse | null>(null)
  const [toggling, setToggling] = useState<UserResponse | null>(null)
  const debouncedSearch = useDebouncedValue(search.trim())

  const query = useUsers({
    search: debouncedSearch,
    role: role === 'all' ? undefined : role,
    isActive: status === 'all' ? undefined : status === 'active',
    page,
    pageSize: PAGE_SIZE,
  })
  const setActive = useSetUserActive()

  const total = query.data?.totalCount ?? 0
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const hasFilters = debouncedSearch !== '' || role !== 'all' || status !== 'active'

  return (
    <>
      <PageHeader title="Users & roles" description="Manage who can access PHANTOM and what they can do." actions={<CreateUserDialog />} />

      <Card className="gap-0 overflow-hidden py-0">
        <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              aria-label="Search users"
              placeholder="Search by name or email"
              className="pl-9"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
          <Select
            value={role}
            onValueChange={(value) => {
              setRole(value === 'all' || !isRoleName(value) ? 'all' : value)
              setPage(1)
            }}
          >
            <SelectTrigger className="sm:w-52" aria-label="Filter by role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {ROLES.map((r) => (
                <SelectItem key={r} value={r}>
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={status}
            onValueChange={(value) => {
              setStatus(value as StatusFilter)
              setPage(1)
            }}
          >
            <SelectTrigger className="sm:w-40" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Deactivated</SelectItem>
              <SelectItem value="all">All statuses</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {query.isPending ? (
          <TableSkeleton columns={4} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Users could not be loaded" />
        ) : query.data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title={hasFilters ? 'No users match these filters' : 'No users yet'}
            description={hasFilters ? 'Try a different search or filter.' : 'Create the first user to get started.'}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead className="hidden md:table-cell">Last sign-in</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-12">
                  <span className="sr-only">Actions</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {query.data.items.map((u) => (
                <TableRow key={u.id}>
                  <TableCell>
                    <div className="font-medium">
                      {u.displayName}
                      {u.isDemoData && (
                        <Badge variant="outline" className="ml-2 border-info/40 text-info">
                          Demo data
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{u.email}</div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => (
                        <Badge key={r} variant="secondary" className="gap-1">
                          <ShieldCheck className="size-3" aria-hidden />
                          {isRoleName(r) ? ROLE_LABELS[r] : r}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell className="hidden text-sm text-muted-foreground md:table-cell">
                    {u.lastLoginAt ? dateFormat.format(new Date(u.lastLoginAt)) : 'Never'}
                  </TableCell>
                  <TableCell>
                    {u.isActive ? (
                      <Badge className="border-success/40 bg-success/15 text-success" variant="outline">Active</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">Deactivated</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label={`Actions for ${u.displayName}`}>
                          <MoreHorizontal />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(u)}>Edit roles</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          variant={u.isActive ? 'destructive' : 'default'}
                          disabled={u.id === currentUser?.id}
                          onSelect={() => setToggling(u)}
                        >
                          {u.isActive ? 'Deactivate' : 'Reactivate'}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {query.data && total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3 text-sm text-muted-foreground">
            <span>
              {total} user{total === 1 ? '' : 's'} · page {page} of {pageCount}
            </span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p - 1)} disabled={page <= 1} aria-label="Previous page">
                <ChevronLeft />
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={page >= pageCount} aria-label="Next page">
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {editing && <EditRolesDialog user={editing} onClose={() => setEditing(null)} />}
      {toggling && (
        <ConfirmDialog
          open
          onOpenChange={(open) => !open && setToggling(null)}
          title={toggling.isActive ? `Deactivate ${toggling.displayName}?` : `Reactivate ${toggling.displayName}?`}
          description={
            toggling.isActive
              ? 'They will be signed out everywhere and will not be able to sign in. Their history is kept.'
              : 'They will be able to sign in again with their existing password.'
          }
          confirmLabel={toggling.isActive ? 'Deactivate' : 'Reactivate'}
          destructive={toggling.isActive}
          onConfirm={async () => {
            await setActive.mutateAsync({ id: toggling.id, active: !toggling.isActive })
            toast.success(`${toggling.displayName} ${toggling.isActive ? 'deactivated' : 'reactivated'}`)
          }}
        />
      )}
    </>
  )
}
