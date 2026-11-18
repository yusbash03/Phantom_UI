import { AlertTriangle, RotateCw, ShieldX } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'

export function ErrorState({ error, onRetry, title = 'Something went wrong' }: { error: unknown; onRetry?: () => void; title?: string }) {
  const message = error instanceof Error ? error.message : 'An unexpected error occurred.'
  const traceId = error instanceof ApiError ? error.traceId : undefined
  return (
    <div role="alert" className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <AlertTriangle className="size-8 text-destructive" aria-hidden />
      <div>
        <p className="font-medium">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{message}</p>
        {traceId && <p className="mt-2 font-mono text-xs text-muted-foreground">Reference: {traceId}</p>}
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCw aria-hidden /> Try again
        </Button>
      )}
    </div>
  )
}

export function ForbiddenState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <ShieldX className="size-8 text-muted-foreground" aria-hidden />
      <p className="font-medium">You do not have access to this area</p>
      <p className="text-sm text-muted-foreground">Ask an administrator if you need this permission.</p>
    </div>
  )
}
