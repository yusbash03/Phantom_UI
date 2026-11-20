import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ApiError } from '@/api/errors'
import type { ResponderResponse } from '@/api/types'
import { Spinner } from '@/components/feedback/LoadingState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useUsers } from '@/features/users/api'
import { useCreateResponder, useResponderFacets, useUpdateResponder } from './api'
import { parseSkills } from './skills'

const NO_ACCOUNT = 'none'

// UX validation only; the API is authoritative and its field errors are shown on the fields.
const schema = z.object({
  callSign: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9][A-Za-z0-9-]{1,19}$/, 'Use 2-20 letters, digits or hyphens, e.g. MED-07'),
  fullName: z.string().trim().min(1, 'Name is required').max(200),
  team: z.string().trim().min(1, 'Team is required').max(100),
  phone: z.string().trim().max(50),
  email: z.union([z.literal(''), z.email('Enter a valid email address').max(320)]),
  skills: z.string().max(1200),
  userId: z.string(),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['callSign', 'fullName', 'team', 'phone', 'email', 'skills', 'userId'] as const

interface ResponderFormDialogProps {
  /** Omitted to create a new responder. */
  responder?: ResponderResponse
  onClose: () => void
}

export function ResponderFormDialog({ responder, onClose }: ResponderFormDialogProps) {
  const editing = responder !== undefined
  const create = useCreateResponder()
  const update = useUpdateResponder()
  const facets = useResponderFacets()
  const accounts = useUsers({ role: 'Responder', isActive: true, page: 1, pageSize: 100 })
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      callSign: responder?.callSign ?? '',
      fullName: responder?.fullName ?? '',
      team: responder?.team ?? '',
      phone: responder?.phone ?? '',
      email: responder?.email ?? '',
      skills: responder?.skills.join(', ') ?? '',
      userId: responder?.linkedUser?.id ?? NO_ACCOUNT,
    },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    const common = {
      fullName: values.fullName,
      team: values.team,
      phone: values.phone || null,
      email: values.email || null,
      skills: parseSkills(values.skills),
      userId: values.userId === NO_ACCOUNT ? null : values.userId,
    }
    try {
      if (editing) {
        await update.mutateAsync({ id: responder.id, body: { ...common, version: responder.version } })
        toast.success(`${responder.callSign} updated`)
      } else {
        const created = await create.mutateAsync({ ...common, callSign: values.callSign })
        toast.success(`${created.callSign} added`)
      }
      onClose()
    } catch (error) {
      if (error instanceof ApiError) {
        for (const field of FIELDS) {
          const message = error.fieldErrors[field]?.[0]
          if (message) form.setError(field, { message })
        }
      }
      form.setError('root', {
        message:
          error instanceof ApiError && error.status === 409 && error.code === 'responder.version_conflict'
            ? 'Someone else changed this responder. Close and reopen to see the latest details.'
            : error instanceof Error
              ? error.message
              : 'Could not save the responder.',
      })
    }
  })

  // Linked account options: active Responder users, plus the current link even if it no longer qualifies.
  const accountOptions = accounts.data?.items ?? []
  const currentLink = responder?.linkedUser && !accountOptions.some((u) => u.id === responder.linkedUser?.id) ? responder.linkedUser : null

  return (
    <Dialog open onOpenChange={(open) => !open && !isSubmitting && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{editing ? `Edit ${responder.callSign}` : 'Add responder'}</DialogTitle>
            <DialogDescription>
              {editing ? 'The call sign is fixed once created.' : 'Coordinators will see this responder when assigning incidents.'}
            </DialogDescription>
          </DialogHeader>

          {!editing && (
            <Field id="callSign" label="Call sign" error={errors.callSign?.message}>
              <Input id="callSign" placeholder="MED-07" autoCapitalize="characters" {...form.register('callSign')} />
            </Field>
          )}
          <Field id="fullName" label="Full name" error={errors.fullName?.message}>
            <Input id="fullName" {...form.register('fullName')} />
          </Field>
          <Field id="team" label="Team" error={errors.team?.message}>
            <Input id="team" list="team-options" {...form.register('team')} />
            <datalist id="team-options">
              {facets.data?.teams.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </datalist>
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="phone" label="Phone" error={errors.phone?.message}>
              <Input id="phone" type="tel" {...form.register('phone')} />
            </Field>
            <Field id="email" label="Email" error={errors.email?.message}>
              <Input id="email" type="email" {...form.register('email')} />
            </Field>
          </div>
          <Field id="skills" label="Skills" hint="Separate with commas, e.g. first aid, water rescue" error={errors.skills?.message}>
            <Input id="skills" {...form.register('skills')} />
          </Field>
          <Field id="userId" label="Linked account" hint="Lets the responder sign in and see their own assignments." error={errors.userId?.message}>
            <Controller
              control={form.control}
              name="userId"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger id="userId" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={NO_ACCOUNT}>No linked account</SelectItem>
                    {currentLink && <SelectItem value={currentLink.id}>{currentLink.displayName}</SelectItem>}
                    {accountOptions.map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.displayName}
                        <span className="text-muted-foreground"> · {u.email}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            />
          </Field>

          {errors.root?.message && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? <Spinner label="Saving" className="text-current" /> : editing ? 'Save changes' : 'Add responder'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function Field({ id, label, hint, error, children }: { id: string; label: string; hint?: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && <p className="text-xs text-muted-foreground">{hint}</p>}
      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
