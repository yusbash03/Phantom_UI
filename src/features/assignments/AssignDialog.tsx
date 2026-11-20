import { useState } from 'react'
import { toast } from 'sonner'
import { ApiError } from '@/api/errors'
import type { IncidentDetail } from '@/api/types'
import { AvailabilityBadge } from '@/components/data/AvailabilityBadge'
import { Spinner } from '@/components/feedback/LoadingState'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ActionDialog } from '@/features/incidents/components/ActionDialog'
import { useResponders } from '@/features/responders/api'
import { useAssignResponder } from './api'
import { overrideNeededFor } from './rules'

export function AssignDialog({ incident, onClose }: { incident: IncidentDetail; onClose: () => void }) {
  const responders = useResponders({ isActive: true, page: 1, pageSize: 100 })
  const assign = useAssignResponder(incident.id)
  const [responderId, setResponderId] = useState('')
  const [overrideReason, setOverrideReason] = useState('')
  const [serverNeedsOverride, setServerNeedsOverride] = useState(false)

  const options = [...(responders.data?.items ?? [])].sort((a, b) => Number(overrideNeededFor(a) !== null) - Number(overrideNeededFor(b) !== null))
  const chosen = options.find((r) => r.id === responderId)
  const problem = chosen ? overrideNeededFor(chosen) : null
  const needsOverride = problem !== null || serverNeedsOverride

  return (
    <ActionDialog
      title={`Assign a responder to ${incident.number}`}
      description="The responder sees the assignment under My assignments and must acknowledge it."
      submitLabel="Assign"
      onClose={onClose}
      validate={() => {
        if (!chosen) return 'Choose a responder.'
        if (needsOverride && !overrideReason.trim()) return `Give a reason to assign ${chosen.callSign}${problem ? `, who is ${problem}` : ''}.`
        return null
      }}
      onSubmit={async () => {
        try {
          const created = await assign.mutateAsync({ responderId, overrideReason: needsOverride ? overrideReason.trim() : null })
          toast.success(`${created.responder.callSign} assigned to ${incident.number}`)
        } catch (error) {
          // The server may know something the list did not (e.g. a just-created assignment elsewhere).
          if (error instanceof ApiError && error.code === 'assignment.override_required') setServerNeedsOverride(true)
          throw error
        }
      }}
    >
      {responders.isPending ? (
        <Spinner label="Loading responders…" />
      ) : options.length === 0 ? (
        <p className="text-sm text-muted-foreground">There are no active responders. An administrator can add them.</p>
      ) : (
        <fieldset className="grid max-h-72 gap-2 overflow-y-auto">
          <legend className="sr-only">Responder</legend>
          {options.map((r) => (
            <label key={r.id} className="flex cursor-pointer items-center gap-2 rounded-md border border-border p-2 text-sm has-[:checked]:border-primary">
              <input
                type="radio"
                name="responder"
                value={r.id}
                checked={responderId === r.id}
                onChange={() => {
                  setResponderId(r.id)
                  setServerNeedsOverride(false)
                }}
              />
              <span className="min-w-0 flex-1">
                <span className="font-mono text-xs">{r.callSign}</span> {r.fullName}
                <span className="block text-xs text-muted-foreground">
                  {r.team}
                  {r.skills.length > 0 && ` · ${r.skills.join(', ')}`}
                  {!r.linkedUser && ' · no linked account (cannot see assignments in PHANTOM)'}
                </span>
              </span>
              <AvailabilityBadge availability={r.availability} />
            </label>
          ))}
        </fieldset>
      )}
      {needsOverride && chosen && (
        <div className="grid gap-2">
          <Label htmlFor="override-reason">Override reason (required — {chosen.callSign} is {problem ?? 'not assignable right now'})</Label>
          <Textarea id="override-reason" rows={2} value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} />
        </div>
      )}
    </ActionDialog>
  )
}
