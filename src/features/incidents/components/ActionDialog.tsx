import { useState, type FormEvent, type ReactNode } from 'react'
import { ApiError } from '@/api/errors'
import { Spinner } from '@/components/feedback/LoadingState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'

interface ActionDialogProps {
  title: string
  description: ReactNode
  submitLabel: string
  destructive?: boolean
  onClose: () => void
  /** Returns an error message to show without calling the API, or null when the input is valid. */
  validate?: () => string | null
  onSubmit: () => Promise<void>
  children?: ReactNode
}

/**
 * Dialog for a coordinator decision. It is also the confirmation step required for
 * high-impact actions (requirements.md 18.7): nothing happens until the explicit submit.
 */
export function ActionDialog({ title, description, submitLabel, destructive, onClose, validate, onSubmit, children }: ActionDialogProps) {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    const invalid = validate?.() ?? null
    if (invalid) {
      setError(invalid)
      return
    }
    setPending(true)
    setError(null)
    try {
      await onSubmit()
      onClose()
    } catch (err) {
      const conflict = err instanceof ApiError && err.status === 409
      setError(
        conflict
          ? 'Someone else changed this incident. The latest version has been loaded; close this dialog and review it before trying again.'
          : err instanceof Error
            ? err.message
            : 'The action failed.',
      )
    } finally {
      setPending(false)
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !pending && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" variant={destructive ? 'destructive' : 'default'} disabled={pending}>
              {pending ? <Spinner label="Working" className="text-current" /> : submitLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
