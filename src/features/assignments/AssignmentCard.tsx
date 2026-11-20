import { useState } from 'react'
import { toast } from 'sonner'
import { Ban, Car, CheckCircle2, Hand, MapPinned, MessageSquarePlus, ThumbsUp, type LucideIcon } from 'lucide-react'
import type { AssignmentAction, AssignmentResponse } from '@/api/types'
import { ApiError } from '@/api/errors'
import { AssignmentStatusBadge } from '@/components/data/AssignmentStatusBadge'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { StatusBadge } from '@/components/data/StatusBadge'
import { Spinner } from '@/components/feedback/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ActionDialog } from '@/features/incidents/components/ActionDialog'
import { CATEGORY_LABELS } from '@/features/incidents/labels'
import { useAssignmentCommand, type AssignmentCommand } from './api'

const time = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const fmt = (value: string | null | undefined) => (value ? time.format(new Date(value)) : null)

const BUTTONS: Record<AssignmentAction, { label: string; icon: LucideIcon; variant: 'default' | 'outline' | 'destructive' }> = {
  Acknowledge: { label: 'Acknowledge', icon: ThumbsUp, variant: 'default' },
  EnRoute: { label: 'On my way', icon: Car, variant: 'default' },
  OnScene: { label: 'Arrived on scene', icon: MapPinned, variant: 'default' },
  Complete: { label: 'Complete', icon: CheckCircle2, variant: 'default' },
  PostUpdate: { label: 'Post update', icon: MessageSquarePlus, variant: 'outline' },
  Decline: { label: 'Decline', icon: Hand, variant: 'outline' },
  Cancel: { label: 'Cancel assignment', icon: Ban, variant: 'destructive' },
}

const ORDER: AssignmentAction[] = ['Acknowledge', 'EnRoute', 'OnScene', 'Complete', 'PostUpdate', 'Decline', 'Cancel']

interface TextAction {
  title: string
  description: string
  label: string
  submit: string
  destructive?: boolean
  max: number
  toCommand: (text: string) => AssignmentCommand
}

const TEXT_ACTIONS: Partial<Record<AssignmentAction, TextAction>> = {
  Decline: {
    title: 'Decline this assignment?',
    description: 'The coordinator will see your reason and can assign someone else.',
    label: 'Reason',
    submit: 'Decline assignment',
    destructive: true,
    max: 1000,
    toCommand: (reason) => ({ action: 'Decline', reason }),
  },
  Cancel: {
    title: 'Cancel this assignment?',
    description: 'The responder is released. The reason is recorded in the audit trail.',
    label: 'Reason',
    submit: 'Cancel assignment',
    destructive: true,
    max: 1000,
    toCommand: (reason) => ({ action: 'Cancel', reason }),
  },
  PostUpdate: {
    title: 'Post a progress update',
    description: 'Coordinators see it on the incident straight away.',
    label: 'Update',
    submit: 'Post update',
    max: 2000,
    toCommand: (body) => ({ action: 'PostUpdate', body }),
  },
  Complete: {
    title: 'Complete this assignment',
    description: 'Describe what was done. A coordinator decides when the incident itself is resolved.',
    label: 'Resolution notes',
    submit: 'Complete assignment',
    max: 5000,
    toCommand: (notes) => ({ action: 'Complete', notes }),
  },
}

interface AssignmentCardProps {
  assignment: AssignmentResponse
  /** Staff see who is assigned; responders see what they are assigned to. */
  perspective: 'staff' | 'responder'
}

export function AssignmentCard({ assignment, perspective }: AssignmentCardProps) {
  const command = useAssignmentCommand(assignment)
  const [open, setOpen] = useState<AssignmentAction | null>(null)
  const actions = ORDER.filter((a) => assignment.availableActions.includes(a))
  const incident = assignment.incident

  async function run(cmd: AssignmentCommand, success: string) {
    try {
      await command.mutateAsync(cmd)
      toast.success(success)
    } catch (error) {
      toast.error(error instanceof ApiError && error.status === 409 ? 'This assignment changed meanwhile. The latest version has been loaded.' : error instanceof Error ? error.message : 'The action failed.')
    }
  }

  const timeline = [
    ['Assigned', fmt(assignment.assignedAt)],
    ['Acknowledged', fmt(assignment.acknowledgedAt)],
    ['En route', fmt(assignment.enRouteAt)],
    ['On scene', fmt(assignment.onSceneAt)],
    ['Completed', fmt(assignment.completedAt)],
  ].filter(([, at]) => at !== null) as [string, string][]
  const textAction = open ? TEXT_ACTIONS[open] : undefined

  return (
    <article className="space-y-3 rounded-md border border-border p-3 text-sm" aria-label={`Assignment ${assignment.responder.callSign} to ${incident.number}`}>
      <div className="flex flex-wrap items-center gap-2">
        <AssignmentStatusBadge status={assignment.status} />
        {perspective === 'staff' ? (
          <span>
            <span className="font-mono text-xs">{assignment.responder.callSign}</span> {assignment.responder.fullName}
            <span className="text-xs text-muted-foreground"> · {assignment.responder.team}</span>
          </span>
        ) : (
          <>
            <span className="font-mono text-xs text-muted-foreground">{incident.number}</span>
            <StatusBadge status={incident.status} />
            <SeverityBadge severity={incident.approvedSeverity} />
          </>
        )}
        {perspective === 'staff' && !assignment.responder.hasLinkedAccount && assignment.status === 'Assigned' && (
          <Badge variant="outline" className="text-[10px]">
            No linked account — contact them directly
          </Badge>
        )}
      </div>

      {perspective === 'responder' && (
        <div className="space-y-1">
          <h3 className="font-medium">{incident.title}</h3>
          <p className="text-xs text-muted-foreground">
            {CATEGORY_LABELS[incident.category]} · {incident.locationText}
            {incident.latitude !== null && incident.longitude !== null && (
              <>
                {' '}
                · <span className="font-mono">{incident.latitude}, {incident.longitude}</span>
                {!incident.locationIsVerified && ' (unverified)'}
              </>
            )}
          </p>
          <p className="whitespace-pre-wrap">{incident.description}</p>
        </div>
      )}

      <ol className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Assignment timeline">
        {timeline.map(([label, at]) => (
          <li key={label}>
            {label} {at}
          </li>
        ))}
        {assignment.assignedBy && perspective === 'responder' && <li>by {assignment.assignedBy.displayName}</li>}
      </ol>

      {assignment.overrideReason && <p className="text-xs">Assigned with override: {assignment.overrideReason}</p>}
      {assignment.endedReason && (
        <p className="text-xs">
          {assignment.status === 'Declined' ? 'Declined' : 'Cancelled'}: {assignment.endedReason}
        </p>
      )}
      {assignment.completionNotes && <p className="text-xs">Resolution notes: {assignment.completionNotes}</p>}

      {assignment.updates.length > 0 && (
        <ul className="space-y-1 border-l-2 border-border pl-3" aria-label="Updates">
          {assignment.updates.map((u) => (
            <li key={u.id} className="text-xs">
              <span className="text-muted-foreground">
                {fmt(u.createdAt)}
                {u.author && ` · ${u.author.displayName}`}
                {u.kind === 'ResolutionNote' && ' · resolution'}
              </span>
              <p className="whitespace-pre-wrap">{u.body}</p>
            </li>
          ))}
        </ul>
      )}

      {actions.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {actions.map((action) => {
            const { label, icon: Icon, variant } = BUTTONS[action]
            const immediate = action === 'Acknowledge' || action === 'EnRoute' || action === 'OnScene'
            return (
              <Button
                key={action}
                size="sm"
                variant={variant}
                disabled={command.isPending}
                onClick={() =>
                  immediate ? void run({ action } as AssignmentCommand, `${label} — recorded`) : setOpen(action)
                }
              >
                {command.isPending && immediate ? <Spinner className="text-current" /> : <Icon aria-hidden />}
                {label}
              </Button>
            )
          })}
        </div>
      )}

      {open && textAction && <TextActionDialog action={textAction} onClose={() => setOpen(null)} onSubmit={(text) => command.mutateAsync(textAction.toCommand(text)).then(() => undefined)} />}
    </article>
  )
}

function TextActionDialog({ action, onClose, onSubmit }: { action: TextAction; onClose: () => void; onSubmit: (text: string) => Promise<void> }) {
  const [text, setText] = useState('')
  return (
    <ActionDialog
      title={action.title}
      description={action.description}
      submitLabel={action.submit}
      destructive={action.destructive}
      onClose={onClose}
      validate={() => (!text.trim() ? `${action.label} is required.` : text.trim().length > action.max ? `${action.label} must be at most ${action.max} characters.` : null)}
      onSubmit={async () => {
        await onSubmit(text.trim())
        toast.success('Saved')
      }}
    >
      <div className="grid gap-2">
        <Label htmlFor="assignment-text">{action.label}</Label>
        <Textarea id="assignment-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
    </ActionDialog>
  )
}
