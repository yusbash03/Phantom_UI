import { WifiOff } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { useLiveStatus } from './realtime-context'

/** Requirement 13.3: say so when live updates stop, so nobody trusts a stale screen. */
export function LiveIndicator() {
  const status = useLiveStatus()
  if (status === 'live') {
    return (
      <output aria-label="Live updates on" title="Changes appear automatically" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="size-2 rounded-full bg-success" aria-hidden />
        <span className="hidden sm:inline" aria-hidden>
          Live
        </span>
      </output>
    )
  }
  if (status !== 'paused') return null
  return (
    <output title="Reconnecting. Screens refresh every minute and when you return to the tab.">
      <Badge variant="outline" className="gap-1.5 border-warning/50 text-warning">
        <WifiOff className="size-3.5" aria-hidden /> Live updates paused
      </Badge>
    </output>
  )
}
