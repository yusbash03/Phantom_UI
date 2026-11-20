import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BellOff, CheckCheck } from 'lucide-react'
import type { NotificationResponse } from '@/api/types'
import { Pagination } from '@/components/data/Pagination'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { TableSkeleton } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/layout/AppShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './api'
import { notificationLink, timeAgo } from './links'

const PAGE_SIZE = 20
const exact = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

export function NotificationsPage() {
  const navigate = useNavigate()
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [page, setPage] = useState(1)
  const query = useNotifications(unreadOnly, page, PAGE_SIZE)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()

  function open(n: NotificationResponse) {
    if (!n.readAt) markRead.mutate(n.id)
    const link = notificationLink(n)
    if (link) void navigate(link)
  }

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Things that need your attention."
        actions={
          <>
            <Button
              variant={unreadOnly ? 'default' : 'outline'}
              aria-pressed={unreadOnly}
              onClick={() => {
                setUnreadOnly((v) => !v)
                setPage(1)
              }}
            >
              Unread only
            </Button>
            <Button variant="outline" onClick={() => markAll.mutate()} disabled={markAll.isPending || !query.data?.unreadCount}>
              <CheckCheck aria-hidden /> Mark all read
            </Button>
          </>
        }
      />
      <Card className="gap-0 overflow-hidden py-0">
        {query.isPending ? (
          <TableSkeleton columns={2} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Notifications could not be loaded" />
        ) : query.data.items.length === 0 ? (
          <EmptyState icon={BellOff} title={unreadOnly ? 'No unread notifications' : 'No notifications yet'} description="You will be told here when something needs your attention." />
        ) : (
          <ul className="divide-y divide-border">
            {query.data.items.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                <button type="button" onClick={() => open(n)} className="min-w-0 flex-1 text-left">
                  <span className={`block text-sm ${n.readAt ? 'text-muted-foreground' : 'font-medium'}`}>{n.title}</span>
                  <span className="block text-sm text-muted-foreground">{n.body}</span>
                  <span className="block text-xs text-muted-foreground" title={exact.format(new Date(n.createdAt))}>
                    {timeAgo(n.createdAt)}
                  </span>
                </button>
                {n.readAt ? (
                  <span className="text-xs text-muted-foreground">Read</span>
                ) : (
                  <div className="flex shrink-0 items-center gap-2">
                    <Badge>Unread</Badge>
                    <Button size="sm" variant="ghost" onClick={() => markRead.mutate(n.id)} aria-label={`Mark “${n.title}” as read`}>
                      Mark read
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
        {query.data && query.data.totalCount > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={query.data.totalCount} noun={['notification', 'notifications']} onPageChange={setPage} />
        )}
      </Card>
    </>
  )
}
