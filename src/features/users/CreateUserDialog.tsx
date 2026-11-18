import { zodResolver } from '@hookform/resolvers/zod'
import { UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ApiError } from '@/api/errors'
import { ROLES } from '@/api/types'
import { Spinner } from '@/components/feedback/LoadingState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useCreateUser } from './api'
import { RolePicker } from './RolePicker'

// UX validation only; the API is authoritative and its field errors are shown below.
const schema = z.object({
  displayName: z.string().trim().min(1, 'Display name is required').max(120),
  email: z.email('Enter a valid email address').max(256),
  password: z.string().min(12, 'Use at least 12 characters').max(256),
  roles: z.array(z.enum(ROLES)).min(1, 'Choose at least one role'),
})
type FormValues = z.infer<typeof schema>
const FIELDS = ['displayName', 'email', 'password', 'roles'] as const

export function CreateUserDialog() {
  const [open, setOpen] = useState(false)
  const createUser = useCreateUser()
  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { displayName: '', email: '', password: '', roles: [] },
  })
  const { errors, isSubmitting } = form.formState

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await createUser.mutateAsync(values)
      toast.success(`${values.displayName} can now sign in`)
      form.reset()
      setOpen(false)
    } catch (error) {
      if (error instanceof ApiError) {
        for (const field of FIELDS) {
          const message = error.fieldErrors[field]?.[0]
          if (message) form.setError(field, { message })
        }
      }
      form.setError('root', { message: error instanceof Error ? error.message : 'Could not create the user.' })
    }
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) form.reset()
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <UserPlus aria-hidden /> New user
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create user</DialogTitle>
          <DialogDescription>Share the initial password with the person through a secure channel.</DialogDescription>
        </DialogHeader>
        <form id="create-user" onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cu-name">Display name</Label>
            <Input id="cu-name" aria-invalid={!!errors.displayName} {...form.register('displayName')} />
            {errors.displayName && <p className="text-sm text-destructive">{errors.displayName.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-email">Email</Label>
            <Input id="cu-email" type="email" autoComplete="off" aria-invalid={!!errors.email} {...form.register('email')} />
            {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
          </div>
          <div className="space-y-2">
            <Label htmlFor="cu-password">Initial password</Label>
            <Input id="cu-password" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...form.register('password')} />
            {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
          </div>
          <Controller
            control={form.control}
            name="roles"
            render={({ field }) => <RolePicker idPrefix="cu-role" value={field.value} onChange={field.onChange} />}
          />
          {errors.roles && <p className="text-sm text-destructive">{errors.roles.message}</p>}
          {errors.root && (
            <p role="alert" className="text-sm text-destructive">
              {errors.root.message}
            </p>
          )}
        </form>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button type="submit" form="create-user" disabled={isSubmitting}>
            {isSubmitting ? <Spinner label="Creating" className="text-current" /> : 'Create user'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
