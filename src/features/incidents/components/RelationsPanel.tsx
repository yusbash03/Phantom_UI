import { useState } from 'react'
import { Link } from 'react-router'
import { toast } from 'sonner'
import { CopyCheck, GitMerge, Link2, Link2Off, Plus } from 'lucide-react'
import type { IncidentDetail, RelationResponse, RelationType } from '@/api/types'
import { useAuth } from '@/app/auth/auth-context'
import { StatusBadge } from '@/components/data/StatusBadge'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { useDecideRelation, useLinkIncident, useRelations } from '../api'
import { CATEGORY_LABELS } from '../labels'
import { ActionDialog } from './ActionDialog'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

const TYPE_TEXT: Record<RelationType, string> = {
  PossibleDuplicate: 'Possible duplicate',
  ConfirmedDuplicate: 'Confirmed duplicate',
  Related: 'Related',
  Unrelated: 'Not related',
}

/**
 * Possible duplicates and linked incidents (requirements.md 7). Suggestions are only ever suggestions:
 * nothing changes until a coordinator decides, and confirming a duplicate keeps every report.
 */
export function RelationsPanel({ incident }: { incident: IncidentDetail }) {
  const query = useRelations(incident.id)
  const { hasAnyRole } = useAuth()
  const isCoordinator = hasAnyRole('IncidentCoordinator')
  const [linking, setLinking] = useState(false)
  const suggestions = query.data?.filter((r) => r.type === 'PossibleDuplicate').length ?? 0

  return (
    <Card aria-labelledby="relations-title">
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle id="relations-title" className="flex items-center gap-2">
            <GitMerge className="size-4" aria-hidden /> Possible duplicates &amp; linked incidents
            {suggestions > 0 && <Badge className="bg-warning/15 text-warning">{suggestions} to review</Badge>}
          </CardTitle>
          {isCoordinator && (
            <Button size="sm" variant="outline" onClick={() => setLinking(true)}>
              <Plus aria-hidden /> Link incident
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">Suggested by comparing location, time, category and wording. Nothing is merged or closed automatically.</p>
      </CardHeader>
      <CardContent>
        {query.isPending ? (
          <output aria-label="Loading related incidents" className="block space-y-2">
            <Skeleton className="h-16" />
          </output>
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Related incidents could not be loaded" />
        ) : query.data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No possible duplicates or linked incidents.</p>
        ) : (
          <ul className="space-y-3">
            {query.data.map((relation) => (
              <RelationItem key={relation.id} incident={incident} relation={relation} />
            ))}
          </ul>
        )}
      </CardContent>
      {linking && <LinkDialog incident={incident} onClose={() => setLinking(false)} />}
    </Card>
  )
}

function RelationItem({ incident, relation }: { incident: IncidentDetail; relation: RelationResponse }) {
  const [confirming, setConfirming] = useState(false)
  const decide = useDecideRelation(incident.id)
  const other = relation.other
  const isPossible = relation.type === 'PossibleDuplicate'

  async function mark(decision: 'Related' | 'Unrelated') {
    try {
      await decide.mutateAsync({ relationId: relation.id, otherIncidentId: other.id, decision })
      toast.success(decision === 'Related' ? `Linked with ${other.number}` : `Marked as not related to ${other.number}; it will not be suggested again`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The decision could not be saved.')
    }
  }

  const primaryNote =
    relation.type === 'ConfirmedDuplicate'
      ? relation.primaryIncidentId === incident.id
        ? `${other.number} was closed as a duplicate of this incident; its reports are listed here.`
        : `This incident was closed as a duplicate of ${other.number}, which now holds its reports.`
      : null

  return (
    <li className={`space-y-2 rounded-md border p-3 text-sm ${isPossible ? 'border-warning/40 bg-warning/5' : 'border-border'}`}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={isPossible ? 'border-warning/40 text-warning' : ''}>
          {TYPE_TEXT[relation.type]}
          {relation.score !== null && ` · ${Math.round(relation.score * 100)}% match`}
        </Badge>
        <Link to={`/incidents/${other.id}`} className="font-mono text-xs hover:underline">
          {other.number}
        </Link>
        <StatusBadge status={other.status} />
      </div>
      <div>
        <Link to={`/incidents/${other.id}`} className="font-medium hover:underline">
          {other.title}
        </Link>
        <p className="text-xs text-muted-foreground">
          {CATEGORY_LABELS[other.category]} · {other.locationText} · reported {dateTime.format(new Date(other.createdAt))}
        </p>
      </div>
      {relation.explanation && <p className="text-xs">{relation.explanation}</p>}
      {primaryNote && <p className="text-xs text-muted-foreground">{primaryNote}</p>}
      <p className="text-xs text-muted-foreground">
        {relation.createdBy ? `Linked by ${relation.createdBy.displayName}` : 'Suggested automatically'}
        {relation.decidedBy && relation.decidedAt && !relation.createdBy && ` · decided by ${relation.decidedBy.displayName}, ${dateTime.format(new Date(relation.decidedAt))}`}
      </p>

      {relation.availableDecisions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {relation.availableDecisions.includes('ConfirmDuplicate') && (
            <Button size="sm" onClick={() => setConfirming(true)} disabled={decide.isPending}>
              <CopyCheck aria-hidden /> Confirm duplicate
            </Button>
          )}
          {relation.availableDecisions.includes('Related') && (
            <Button size="sm" variant="outline" onClick={() => void mark('Related')} disabled={decide.isPending}>
              <Link2 aria-hidden /> Related, keep both
            </Button>
          )}
          {relation.availableDecisions.includes('Unrelated') && (
            <Button size="sm" variant="ghost" onClick={() => void mark('Unrelated')} disabled={decide.isPending}>
              {decide.isPending ? <Spinner /> : <Link2Off aria-hidden />} Not related
            </Button>
          )}
        </div>
      )}

      {confirming && <ConfirmDuplicateDialog incident={incident} relation={relation} onClose={() => setConfirming(false)} />}
    </li>
  )
}

function ConfirmDuplicateDialog({ incident, relation, onClose }: { incident: IncidentDetail; relation: RelationResponse; onClose: () => void }) {
  const decide = useDecideRelation(incident.id)
  const other = relation.other
  const options = [
    { id: incident.id, number: incident.number, title: incident.title, createdAt: incident.createdAt },
    { id: other.id, number: other.number, title: other.title, createdAt: other.createdAt },
  ].filter((o) => relation.confirmablePrimaryIds.includes(o.id))
  // Default to the earlier report as the one that stays open.
  const [primaryId, setPrimaryId] = useState(() => [...options].sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0]?.id ?? '')
  const primary = options.find((o) => o.id === primaryId)
  const secondary = primaryId === incident.id ? other.number : incident.number

  return (
    <ActionDialog
      title="Confirm duplicate"
      description="Choose the incident that stays open. The other is closed as its duplicate and its reports move to it — no report is deleted."
      submitLabel={primary ? `Close ${secondary} as duplicate` : 'Confirm'}
      destructive
      onClose={onClose}
      validate={() => (primary ? null : 'Choose the incident that stays open.')}
      onSubmit={async () => {
        await decide.mutateAsync({ relationId: relation.id, otherIncidentId: other.id, decision: 'ConfirmDuplicate', primaryIncidentId: primaryId })
        toast.success(`${secondary} closed as a duplicate of ${primary?.number ?? ''}`)
      }}
    >
      <fieldset className="grid gap-2">
        <legend className="mb-1 text-sm font-medium">Keep open</legend>
        {options.map((o) => (
          <label key={o.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2 text-sm has-[:checked]:border-primary">
            <input type="radio" name="primary" value={o.id} checked={primaryId === o.id} onChange={() => setPrimaryId(o.id)} className="mt-1" />
            <span>
              <span className="font-mono text-xs">{o.number}</span>
              {o.id === incident.id && <span className="text-xs text-muted-foreground"> (this incident)</span>}
              <span className="block">{o.title}</span>
            </span>
          </label>
        ))}
        {options.length < 2 && (
          <p className="text-xs text-muted-foreground">Only one choice is possible: an incident that is already verified or further along cannot be closed as a duplicate.</p>
        )}
      </fieldset>
    </ActionDialog>
  )
}

function LinkDialog({ incident, onClose }: { incident: IncidentDetail; onClose: () => void }) {
  const link = useLinkIncident(incident.id)
  const [number, setNumber] = useState('')
  return (
    <ActionDialog
      title="Link a related incident"
      description="Both incidents stay open. Use this when reports describe connected events, not the same one."
      submitLabel="Link incident"
      onClose={onClose}
      validate={() => (number.trim() ? null : 'Enter the incident number to link.')}
      onSubmit={async () => {
        const relation = await link.mutateAsync(number.trim().toUpperCase())
        toast.success(`Linked with ${relation.other.number}`)
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="link-number">Incident number</Label>
        <Input id="link-number" placeholder="PH-2026-000123" value={number} autoComplete="off" onChange={(e) => setNumber(e.target.value)} />
      </div>
    </ActionDialog>
  )
}
