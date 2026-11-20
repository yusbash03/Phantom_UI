import { useState } from 'react'
import { toast } from 'sonner'
import { CheckCircle2, Eye, Gauge, Lock, MapPinCheck, Pencil, RotateCcw, ShieldCheck, XCircle } from 'lucide-react'
import type { IncidentAction, IncidentCategory, IncidentDetail, Severity } from '@/api/types'
import { ApiError } from '@/api/errors'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { ConfirmDialog } from '@/components/feedback/ConfirmDialog'
import { Spinner } from '@/components/feedback/LoadingState'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useIncidentCommand, type IncidentCommand } from '../api'
import { CATEGORIES, CATEGORY_LABELS, SEVERITIES, isCategory, isSeverity } from '../labels'
import { ActionDialog } from './ActionDialog'

const MAX_TITLE = 200
const MAX_TEXT = 5000
const MAX_REASON = 1000

const BUTTONS: Record<IncidentAction, { label: string; icon: typeof Eye; variant: 'default' | 'outline' | 'destructive' }> = {
  BeginReview: { label: 'Start review', icon: Eye, variant: 'default' },
  Verify: { label: 'Verify', icon: ShieldCheck, variant: 'default' },
  Resolve: { label: 'Resolve', icon: CheckCircle2, variant: 'default' },
  Close: { label: 'Close', icon: Lock, variant: 'outline' },
  Reopen: { label: 'Reopen', icon: RotateCcw, variant: 'outline' },
  ChangeSeverity: { label: 'Change severity', icon: Gauge, variant: 'outline' },
  Edit: { label: 'Edit details', icon: Pencil, variant: 'outline' },
  VerifyLocation: { label: 'Verify location', icon: MapPinCheck, variant: 'outline' },
  Reject: { label: 'Reject', icon: XCircle, variant: 'destructive' },
}

const ORDER: IncidentAction[] = ['BeginReview', 'Verify', 'Resolve', 'Close', 'Reopen', 'ChangeSeverity', 'VerifyLocation', 'Edit', 'Reject']

/** Shows only the actions the API says this user may take now (requirements.md 18.4). */
export function IncidentActions({ incident }: { incident: IncidentDetail }) {
  const [open, setOpen] = useState<IncidentAction | null>(null)
  const command = useIncidentCommand(incident)
  const actions = ORDER.filter((a) => incident.availableActions.includes(a))
  if (actions.length === 0) return null

  async function run(cmd: IncidentCommand, success: string) {
    await command.mutateAsync(cmd)
    toast.success(success)
  }

  async function startReview() {
    try {
      await run({ action: 'BeginReview' }, `${incident.number} is now under review`)
    } catch (err) {
      toast.error(err instanceof ApiError && err.status === 409 ? 'Someone else changed this incident. The latest version has been loaded.' : err instanceof Error ? err.message : 'Could not start the review.')
    }
  }

  const close = () => setOpen(null)
  return (
    <>
      <div className="flex flex-wrap gap-2">
        {actions.map((action) => {
          const { label, icon: Icon, variant } = BUTTONS[action]
          const busy = action === 'BeginReview' && command.isPending
          return (
            <Button
              key={action}
              size="sm"
              variant={variant}
              disabled={command.isPending}
              onClick={() => (action === 'BeginReview' ? void startReview() : setOpen(action))}
            >
              {busy ? <Spinner className="text-current" /> : <Icon aria-hidden />}
              {label}
            </Button>
          )
        })}
      </div>

      {open === 'Verify' && <VerifyDialog incident={incident} onClose={close} run={run} />}
      {open === 'ChangeSeverity' && <SeverityDialog incident={incident} onClose={close} run={run} />}
      {open === 'Edit' && <EditDialog incident={incident} onClose={close} run={run} />}
      {open === 'VerifyLocation' && <VerifyLocationDialog incident={incident} onClose={close} run={run} />}
      {open === 'Reject' && (
        <TextDialog
          title={`Reject ${incident.number}?`}
          description="Rejected incidents are closed for good. The original report is kept and the reason is recorded in the audit trail."
          label="Reason for rejection"
          max={MAX_REASON}
          submitLabel="Reject incident"
          destructive
          onClose={close}
          onSubmit={(reason) => run({ action: 'Reject', body: { reason } }, `${incident.number} rejected`)}
        />
      )}
      {open === 'Resolve' && (
        <TextDialog
          title={`Resolve ${incident.number}`}
          description="Record what was done. The incident can be reopened later if needed."
          label="Resolution details"
          max={MAX_TEXT}
          submitLabel="Resolve incident"
          onClose={close}
          onSubmit={(resolutionSummary) => run({ action: 'Resolve', body: { resolutionSummary } }, `${incident.number} resolved`)}
        />
      )}
      {open === 'Reopen' && (
        <TextDialog
          title={`Reopen ${incident.number}?`}
          description="The incident returns to In progress. Explain why it needs more work."
          label="Reason for reopening"
          max={MAX_REASON}
          submitLabel="Reopen incident"
          onClose={close}
          onSubmit={(reason) => run({ action: 'Reopen', body: { reason } }, `${incident.number} reopened`)}
        />
      )}
      {open === 'Close' && (
        <ConfirmDialog
          open
          onOpenChange={(o) => !o && close()}
          title={`Close ${incident.number}?`}
          description="Closed incidents are final and can no longer be changed. Their full history is kept."
          confirmLabel="Close incident"
          destructive
          onConfirm={() => run({ action: 'Close' }, `${incident.number} closed`)}
        />
      )}
    </>
  )
}

type Run = (cmd: IncidentCommand, success: string) => Promise<void>

function SeverityPicker({ id, value, onChange }: { id: string; value: Severity | ''; onChange: (s: Severity) => void }) {
  return (
    <Select value={value} onValueChange={(v) => isSeverity(v) && onChange(v)}>
      <SelectTrigger id={id} className="w-full">
        <SelectValue placeholder="Choose a severity" />
      </SelectTrigger>
      <SelectContent>
        {SEVERITIES.map((s) => (
          <SelectItem key={s} value={s}>
            {s}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function VerifyDialog({ incident, onClose, run }: { incident: IncidentDetail; onClose: () => void; run: Run }) {
  // Deliberately not pre-filled from the AI recommendation: the approved value is a human decision.
  const [severity, setSeverity] = useState<Severity | ''>('')
  return (
    <ActionDialog
      title={`Verify ${incident.number}`}
      description="Confirm this is a genuine incident and set its approved severity. This is recorded as your decision."
      submitLabel="Verify incident"
      onClose={onClose}
      validate={() => (severity ? null : 'Choose an approved severity.')}
      onSubmit={() => run({ action: 'Verify', body: { approvedSeverity: severity as Severity } }, `${incident.number} verified`)}
    >
      <div className="grid gap-2">
        <Label htmlFor="verify-severity">Approved severity</Label>
        <SeverityPicker id="verify-severity" value={severity} onChange={setSeverity} />
        {incident.aiRecommendedSeverity && (
          <p className="flex items-center gap-2 text-xs text-muted-foreground">
            For reference: <SeverityBadge severity={incident.aiRecommendedSeverity} source="ai" />
          </p>
        )}
      </div>
    </ActionDialog>
  )
}

function SeverityDialog({ incident, onClose, run }: { incident: IncidentDetail; onClose: () => void; run: Run }) {
  const [severity, setSeverity] = useState<Severity | ''>(incident.approvedSeverity ?? '')
  return (
    <ActionDialog
      title="Change approved severity"
      description={`Currently ${incident.approvedSeverity ?? 'not set'}. The change is recorded in the audit trail.`}
      submitLabel="Save severity"
      onClose={onClose}
      validate={() => (!severity ? 'Choose a severity.' : severity === incident.approvedSeverity ? 'Choose a different severity.' : null)}
      onSubmit={() => run({ action: 'ChangeSeverity', body: { severity: severity as Severity } }, 'Severity updated')}
    >
      <div className="grid gap-2">
        <Label htmlFor="change-severity">Approved severity</Label>
        <SeverityPicker id="change-severity" value={severity} onChange={setSeverity} />
      </div>
    </ActionDialog>
  )
}

function EditDialog({ incident, onClose, run }: { incident: IncidentDetail; onClose: () => void; run: Run }) {
  const [title, setTitle] = useState(incident.title)
  const [description, setDescription] = useState(incident.description)
  const [category, setCategory] = useState<IncidentCategory>(incident.category)
  return (
    <ActionDialog
      title="Edit incident details"
      description="The original public report is kept unchanged; previous values are recorded in the audit trail."
      submitLabel="Save changes"
      onClose={onClose}
      validate={() => {
        if (!title.trim()) return 'Title is required.'
        if (title.trim().length > MAX_TITLE) return `Title must be at most ${MAX_TITLE} characters.`
        if (!description.trim()) return 'Description is required.'
        if (description.trim().length > MAX_TEXT) return `Description must be at most ${MAX_TEXT} characters.`
        return null
      }}
      onSubmit={() => run({ action: 'Edit', body: { title: title.trim(), description: description.trim(), category } }, 'Incident updated')}
    >
      <div className="grid gap-2">
        <Label htmlFor="edit-title">Title</Label>
        <Input id="edit-title" value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edit-category">Category</Label>
        <Select value={category} onValueChange={(v) => isCategory(v) && setCategory(v)}>
          <SelectTrigger id="edit-category" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-2">
        <Label htmlFor="edit-description">Description</Label>
        <Textarea id="edit-description" rows={6} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>
    </ActionDialog>
  )
}

interface TextDialogProps {
  title: string
  description: string
  label: string
  max: number
  submitLabel: string
  destructive?: boolean
  onClose: () => void
  onSubmit: (text: string) => Promise<void>
}

function TextDialog({ title, description, label, max, submitLabel, destructive, onClose, onSubmit }: TextDialogProps) {
  const [text, setText] = useState('')
  return (
    <ActionDialog
      title={title}
      description={description}
      submitLabel={submitLabel}
      destructive={destructive}
      onClose={onClose}
      validate={() => (!text.trim() ? `${label} is required.` : text.trim().length > max ? `${label} must be at most ${max} characters.` : null)}
      onSubmit={() => onSubmit(text.trim())}
    >
      <div className="grid gap-2">
        <Label htmlFor="action-text">{label}</Label>
        <Textarea id="action-text" rows={4} value={text} onChange={(e) => setText(e.target.value)} />
      </div>
    </ActionDialog>
  )
}

function parseCoordinate(value: string, min: number, max: number): number | null {
  if (value.trim() === '') return null
  const n = Number(value)
  return Number.isFinite(n) && n >= min && n <= max ? n : null
}

function VerifyLocationDialog({ incident, onClose, run }: { incident: IncidentDetail; onClose: () => void; run: Run }) {
  const location = incident.location
  const [text, setText] = useState(location.text)
  const [latitude, setLatitude] = useState(location.latitude?.toString() ?? '')
  const [longitude, setLongitude] = useState(location.longitude?.toString() ?? '')
  return (
    <ActionDialog
      title="Verify location"
      description="Confirm or correct where this incident is. Your confirmation is recorded and the location is then shown as verified."
      submitLabel="Verify location"
      onClose={onClose}
      validate={() => {
        if (!text.trim()) return 'A location description is required.'
        if (parseCoordinate(latitude, -90, 90) === null) return 'Latitude must be a number between -90 and 90.'
        if (parseCoordinate(longitude, -180, 180) === null) return 'Longitude must be a number between -180 and 180.'
        return null
      }}
      onSubmit={() =>
        run(
          {
            action: 'VerifyLocation',
            body: { text: text.trim(), latitude: parseCoordinate(latitude, -90, 90)!, longitude: parseCoordinate(longitude, -180, 180)! },
          },
          'Location verified',
        )
      }
    >
      {location.latitude !== null && !location.isVerified && (
        <p className="text-xs text-muted-foreground">
          Prefilled from the {location.provenance === 'Reported' ? "reporter's" : 'approximate'} coordinates
          {location.geocoderPlaceName ? ` (${location.geocoderPlaceName})` : ''}. Check them before confirming.
        </p>
      )}
      <div className="grid gap-2">
        <Label htmlFor="verify-location-text">Location description</Label>
        <Input id="verify-location-text" value={text} maxLength={500} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label htmlFor="verify-latitude">Latitude</Label>
          <Input id="verify-latitude" inputMode="decimal" value={latitude} onChange={(e) => setLatitude(e.target.value)} />
        </div>
        <div className="grid gap-2">
          <Label htmlFor="verify-longitude">Longitude</Label>
          <Input id="verify-longitude" inputMode="decimal" value={longitude} onChange={(e) => setLongitude(e.target.value)} />
        </div>
      </div>
    </ActionDialog>
  )
}
