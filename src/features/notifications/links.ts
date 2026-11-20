import type { NotificationResponse } from '@/api/types'

/** Where a notification leads: a responder's assignment notices to My assignments, everything else to the incident. */
export function notificationLink(notification: NotificationResponse): string | null {
  if (notification.type === 'AssignmentCreated' || notification.type === 'AssignmentCancelled') return '/assignments'
  return notification.incidentId ? `/incidents/${notification.incidentId}` : null
}

const relative = new Intl.RelativeTimeFormat(undefined, { numeric: 'auto' })

/** "5 minutes ago", "yesterday". */
export function timeAgo(iso: string, now: Date = new Date()): string {
  const seconds = Math.round((new Date(iso).getTime() - now.getTime()) / 1000)
  const units: [Intl.RelativeTimeFormatUnit, number][] = [
    ['day', 86_400],
    ['hour', 3_600],
    ['minute', 60],
  ]
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit)
  }
  return relative.format(0, 'second')
}
