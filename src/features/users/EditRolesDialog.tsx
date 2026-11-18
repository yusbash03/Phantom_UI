import { useState } from 'react'
import { toast } from 'sonner'
import { isRoleName, type RoleName, type UserResponse } from '@/api/types'
import { Spinner } from '@/components/feedback/LoadingState'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useSetUserRoles } from './api'
import { RolePicker } from './RolePicker'

export function EditRolesDialog({ user, onClose }: { user: UserResponse; onClose: () => void }) {
  const [roles, setRoles] = useState<RoleName[]>(user.roles.filter(isRoleName))
  const [error, setError] = useState<string | null>(null)
  const setUserRoles = useSetUserRoles()

  async function save() {
    if (roles.length === 0) {
      setError('Choose at least one role.')
      return
    }
    setError(null)
    try {
      await setUserRoles.mutateAsync({ id: user.id, roles })
      toast.success(`Roles updated for ${user.displayName}`)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not update roles.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && !setUserRoles.isPending && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit roles</DialogTitle>
          <DialogDescription>
            {user.displayName} will be signed out of active sessions so the new permissions apply immediately.
          </DialogDescription>
        </DialogHeader>
        <RolePicker idPrefix={`er-${user.id}`} value={roles} onChange={setRoles} />
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={setUserRoles.isPending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={setUserRoles.isPending}>
            {setUserRoles.isPending ? <Spinner label="Saving" className="text-current" /> : 'Save roles'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
