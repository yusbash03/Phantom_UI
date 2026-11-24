import { Link, useNavigate } from 'react-router'
import { Bell, CheckCheck } from 'lucide-react'
import type { NotificationResponse } from '@/api/types'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useMarkAllNotificationsRead, useMarkNotificationRead, useNotifications } from './api'
import { notificationLink, timeAgo } from './links'

const RECENT = 8

/** Top-bar bell with the unread count (Requirement 14.2). */
export function NotificationBell() {
  const navigate = useNavigate()
  const query = useNotifications(false, 1, RECENT)
  const markRead = useMarkNotificationRead()
  const markAll = useMarkAllNotificationsRead()
  const unread = query.data?.unreadCount ?? 0

  function open(notification: NotificationResponse) {
    if (!notification.readAt) markRead.mutate(notification.id)
    const link = notificationLink(notification)
    if (link) void navigate(link)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {/* The name carries the badge's visible text, so "99+" when capped (WCAG 2.5.3: label in name). */}
        <Button variant="ghost" size="icon" className="relative" aria-label={unread > 0 ? `Notifications, ${unread > 99 ? '99+' : unread} unread` : 'Notifications'}>
          <Bell />
          {unread > 0 && (
            <span aria-hidden className="absolute -top-0.5 -right-0.5 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Notifications</span>
          {unread > 0 && (
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAll.mutate()} disabled={markAll.isPending}>
              <CheckCheck aria-hidden /> Mark all read
            </Button>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {query.isError ? (
          <p className="px-2 py-3 text-sm text-destructive">Notifications could not be loaded.</p>
        ) : !query.data ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">Loading…</p>
        ) : query.data.items.length === 0 ? (
          <p className="px-2 py-3 text-sm text-muted-foreground">You are all caught up.</p>
        ) : (
          query.data.items.map((n) => (
            <DropdownMenuItem key={n.id} onSelect={() => open(n)} className="items-start gap-2">
              <span aria-hidden className={`mt-1.5 size-2 shrink-0 rounded-full ${n.readAt ? 'bg-transparent' : 'bg-primary'}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-sm ${n.readAt ? 'text-muted-foreground' : 'font-medium'}`}>
                  {!n.readAt && <span className="sr-only">Unread: </span>}
                  {n.title}
                </span>
                <span className="line-clamp-2 block text-xs text-muted-foreground">{n.body}</span>
                <span className="block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </span>
            </DropdownMenuItem>
          ))
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to="/notifications" className="justify-center text-sm">
            View all notifications
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
