import { ROLES, ROLE_LABELS, type RoleName } from '@/api/types'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'

const DESCRIPTIONS: Record<RoleName, string> = {
  Administrator: 'Users, responders, settings and audit.',
  IncidentCoordinator: 'Verify, prioritise, assign and resolve incidents.',
  Responder: 'Receive and update assignments.',
}

export function RolePicker({ value, onChange, idPrefix }: { value: RoleName[]; onChange: (roles: RoleName[]) => void; idPrefix: string }) {
  return (
    <fieldset className="space-y-3">
      <legend className="mb-2 text-sm font-medium">Roles</legend>
      {ROLES.map((role) => {
        const id = `${idPrefix}-${role}`
        const checked = value.includes(role)
        return (
          <div key={role} className="flex items-start gap-3">
            <Checkbox
              id={id}
              checked={checked}
              onCheckedChange={(next) => onChange(next === true ? [...value, role] : value.filter((r) => r !== role))}
            />
            <div className="grid gap-0.5 leading-tight">
              <Label htmlFor={id}>{ROLE_LABELS[role]}</Label>
              <p className="text-xs text-muted-foreground">{DESCRIPTIONS[role]}</p>
            </div>
          </div>
        )
      })}
    </fieldset>
  )
}
