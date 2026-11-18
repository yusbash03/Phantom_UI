import { cn } from '@/lib/utils'

export function PhantomMark({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-7 shrink-0" aria-hidden>
        <rect width="32" height="32" rx="7" className="fill-primary/15" />
        <path d="M16 6l9 5v10l-9 5-9-5V11z" className="fill-none stroke-primary" strokeWidth="2" strokeLinejoin="round" />
        <circle cx="16" cy="16" r="3" className="fill-primary" />
      </svg>
      <div className="leading-tight">
        <p className="text-sm font-semibold tracking-[0.18em]">PHANTOM</p>
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Incident intelligence</p>
      </div>
    </div>
  )
}
