import { toast } from 'sonner'
import type { ResponderAvailability } from '@/api/types'
import { AvailabilityBadge } from '@/components/data/AvailabilityBadge'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useMyResponder, useSetMyAvailability } from './api'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** A responder's own availability (Requirement 10.4). Assigned is shown but set only by an active assignment. */
export function MyAvailabilityCard() {
  const query = useMyResponder(true)
  const setAvailability = useSetMyAvailability()

  async function change(next: ResponderAvailability) {
    try {
      await setAvailability.mutateAsync(next)
      toast.success(`You are now ${next.toLowerCase()}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Your availability could not be changed.')
    }
  }

  return (
    <Card className="max-w-2xl" aria-labelledby="my-availability-title">
      <CardHeader>
        <CardTitle id="my-availability-title">My availability</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {query.isPending ? (
          <Spinner label="Loading your responder profile…" />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Your responder profile could not be loaded" />
        ) : query.data === null ? (
          <p className="text-muted-foreground">Your account is not linked to a responder profile yet. Ask an administrator to link it.</p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-xs text-muted-foreground">{query.data.callSign}</span>
              <AvailabilityBadge availability={query.data.availability} inactive={!query.data.isActive} />
              <span className="text-xs text-muted-foreground">since {dateTime.format(new Date(query.data.lastStatusAt))}</span>
            </div>
            {!query.data.isActive ? (
              <p className="text-muted-foreground">Your responder profile is deactivated. Contact an administrator.</p>
            ) : query.data.availability === 'Assigned' ? (
              <p className="text-muted-foreground">You have an active assignment. Your availability changes when it ends.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={query.data.availability === 'Available' ? 'default' : 'outline'}
                  aria-pressed={query.data.availability === 'Available'}
                  disabled={setAvailability.isPending || query.data.availability === 'Available'}
                  onClick={() => void change('Available')}
                >
                  Available
                </Button>
                <Button
                  size="sm"
                  variant={query.data.availability === 'Unavailable' ? 'default' : 'outline'}
                  aria-pressed={query.data.availability === 'Unavailable'}
                  disabled={setAvailability.isPending || query.data.availability === 'Unavailable'}
                  onClick={() => void change('Unavailable')}
                >
                  Unavailable
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
