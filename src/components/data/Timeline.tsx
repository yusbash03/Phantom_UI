import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

export interface TimelineItem {
  id: string
  icon: LucideIcon
  title: ReactNode
  meta: ReactNode
  detail?: ReactNode
  badge?: ReactNode
  /** Visually set apart, e.g. AI output (dashed) so it is never mistaken for a human decision. */
  tone?: 'default' | 'ai' | 'system'
}

/** Vertical, chronological list of events (design system Timeline). */
export function Timeline({ items, label }: { items: TimelineItem[]; label: string }) {
  return (
    <ol className="relative space-y-4 border-l border-border pl-6" aria-label={label}>
      {items.map((item) => {
        const Icon = item.icon
        return (
          <li key={item.id} className="relative">
            <span
              aria-hidden
              className={cn(
                'absolute top-0.5 -left-[2.05rem] grid size-6 place-items-center rounded-full border bg-background',
                item.tone === 'ai' ? 'border-dashed border-info text-info' : item.tone === 'system' ? 'border-border text-muted-foreground' : 'border-primary/40 text-primary',
              )}
            >
              <Icon className="size-3.5" />
            </span>
            <div className={cn('rounded-md px-3 py-2', item.tone === 'ai' && 'border border-dashed border-info/40 bg-info/5')}>
              <p className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium">{item.title}</span>
                {item.badge}
              </p>
              <p className="text-xs text-muted-foreground">{item.meta}</p>
              {item.detail && <div className="mt-1 text-sm whitespace-pre-wrap text-muted-foreground">{item.detail}</div>}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
