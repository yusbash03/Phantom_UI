import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Search, SearchX } from 'lucide-react'
import { ApiError } from '@/api/errors'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PhantomMark } from '@/components/layout/PhantomMark'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { PUBLIC_STATUS_TEXT, usePublicStatus } from './api'

export function PublicStatusPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeRef = (searchParams.get('ref') ?? '').trim()
  const [reference, setReference] = useState(activeRef)

  const { data, isFetching, isError, error, refetch } = usePublicStatus(activeRef)
  const notFound = error instanceof ApiError && error.status === 404

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    const next = reference.trim().toUpperCase()
    if (next) setSearchParams({ ref: next })
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <PhantomMark className="size-6" />
        <span className="font-semibold tracking-tight">PHANTOM</span>
        <span className="ml-auto text-xs text-muted-foreground">Emergency Reporting</span>
      </header>

      <main className="mx-auto max-w-lg space-y-6 px-4 py-8 sm:px-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">Check report status</h1>
          <p className="text-sm text-muted-foreground">
            Enter the reference number you received when you submitted your report.
          </p>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1">
            <Label htmlFor="ref" className="sr-only">
              Reference number
            </Label>
            <Input
              id="ref"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. PH-2026-000123"
              autoComplete="off"
              autoCapitalize="characters"
            />
          </div>
          <Button type="submit" disabled={!reference.trim() || isFetching} aria-label="Check status">
            {isFetching ? <Spinner /> : <Search aria-hidden />}
          </Button>
        </form>

        {isFetching && !data && (
          <div className="py-6 text-center">
            <Spinner label="Looking up reference…" />
          </div>
        )}

        {isError && notFound && (
          <div role="alert" className="flex flex-col items-center gap-2 rounded-lg border border-border px-5 py-8 text-center">
            <SearchX className="size-6 text-muted-foreground" aria-hidden />
            <p className="font-medium">No report found for {activeRef}</p>
            <p className="text-sm text-muted-foreground">Check the reference and try again.</p>
          </div>
        )}

        {isError && !notFound && (
          <ErrorState error={error} title="Could not check the status" onRetry={() => void refetch()} />
        )}

        {data && !isError && (
          <section aria-label="Report status" className="space-y-3 rounded-lg border border-border bg-card p-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference</p>
              <p className="mt-0.5 font-mono font-semibold">{data.reference}</p>
            </div>
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Status</p>
              <p className="mt-0.5 font-medium">{PUBLIC_STATUS_TEXT[data.status].label}</p>
              <p className="mt-1 text-sm text-muted-foreground">{PUBLIC_STATUS_TEXT[data.status].description}</p>
            </div>
          </section>
        )}

        <Link to="/report" className="block text-sm text-primary underline-offset-4 hover:underline">
          ← Submit a new report
        </Link>
      </main>
    </div>
  )
}
