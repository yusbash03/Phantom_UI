import { Loader2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

export function Spinner({ className, label }: { className?: string; label?: string }) {
  return (
    <output className={cn('inline-flex items-center gap-2 text-muted-foreground', className)}>
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span className={label ? 'text-sm' : 'sr-only'}>{label ?? 'Loading'}</span>
    </output>
  )
}

export function FullPageLoader({ label }: { label: string }) {
  return (
    <div className="grid min-h-svh place-items-center bg-background">
      <Spinner label={label} />
    </div>
  )
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <output aria-label="Loading" className="block space-y-2 p-4">
      {Array.from({ length: rows }, (_row, r) => (
        <div key={r} className="flex gap-4">
          {Array.from({ length: columns }, (_cell, c) => (
            <Skeleton key={c} className="h-5 flex-1" />
          ))}
        </div>
      ))}
    </output>
  )
}
