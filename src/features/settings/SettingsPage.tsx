import { useState } from 'react'
import { toast } from 'sonner'
import { RotateCcw } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { SettingsResponse } from '@/api/types'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useSaveSettings, useSettings } from './api'
import { CORRELATION_FIELDS, WEATHER_FIELDS, toStrings, toValues, validate, type FieldSpec, type SettingKey } from './fields'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })

/** Operational settings for administrators (Requirement 17). Secrets are never shown or editable here. */
export function SettingsPage() {
  const query = useSettings()
  // Kept here, not in the form: the form re-mounts with the latest values after a conflict.
  const [conflict, setConflict] = useState(false)
  return (
    <>
      <PageHeader title="Settings" description="Operational values that can change without a redeploy. Every change is recorded in the audit log." />
      {query.isPending ? (
        <Spinner label="Loading settings…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} title="Settings could not be loaded" />
      ) : (
        // Re-mount the form when the stored version changes (after a save or a conflict reload).
        <SettingsForm key={query.data.updatedAt ?? 'defaults'} data={query.data} conflict={conflict} onConflict={setConflict} />
      )}
    </>
  )
}

interface SettingsFormProps {
  data: SettingsResponse
  conflict: boolean
  onConflict: (conflict: boolean) => void
}

function SettingsForm({ data, conflict, onConflict: setConflict }: SettingsFormProps) {
  const [values, setValues] = useState(() => toStrings(data.values))
  const [errors, setErrors] = useState<Partial<Record<SettingKey, string>>>({})
  const save = useSaveSettings()
  const defaults = toStrings(data.defaults)
  const dirty = Object.entries(values).some(([k, v]) => Number(v) !== data.values[k as SettingKey])

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const found = validate(values)
    setErrors(found)
    setConflict(false)
    if (Object.keys(found).length > 0) return
    save.mutate(
      { values: toValues(values), expectedUpdatedAt: data.updatedAt },
      {
        onSuccess: () => toast.success('Settings saved. They apply within 30 seconds.'),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) setConflict(true)
          else if (err instanceof ApiError && Object.keys(err.fieldErrors).length > 0) {
            const fromServer: Partial<Record<SettingKey, string>> = {}
            for (const [field, messages] of Object.entries(err.fieldErrors)) {
              const key = field.replace(/^values\./i, '')
              const match = Object.keys(values).find((k) => k.toLowerCase() === key.toLowerCase()) as SettingKey | undefined
              if (match && messages[0]) fromServer[match] = messages[0]
            }
            setErrors(fromServer)
          } else toast.error(err instanceof Error ? err.message : 'The settings could not be saved.')
        },
      },
    )
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-6">
      <p className="text-sm text-muted-foreground">
        {data.isCustomised ? 'Some values differ from the configured defaults.' : 'Using the configured defaults.'}
        {data.updatedAt && ` Last changed by ${data.updatedBy?.displayName ?? 'an administrator'} on ${dateTime.format(new Date(data.updatedAt))}.`}
      </p>
      {conflict && (
        <p role="alert" className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          Someone else changed these settings while you were editing. The latest values have been loaded; make your change again.
        </p>
      )}
      <Section
        title="Duplicate detection"
        description="How similar two reports must be before PHANTOM suggests they may be the same incident. Weights are relative: only their proportions matter. Suggestions never merge anything by themselves."
        fields={CORRELATION_FIELDS}
        values={values}
        defaults={defaults}
        errors={errors}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
      />
      <Section
        title="Weather"
        description="Weather is context only. Caching reduces calls to the provider."
        fields={WEATHER_FIELDS}
        values={values}
        defaults={defaults}
        errors={errors}
        onChange={(key, value) => setValues((v) => ({ ...v, [key]: value }))}
      />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={save.isPending || !dirty}>
          {save.isPending ? <Spinner label="Saving…" /> : 'Save changes'}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setValues(defaults)
            setErrors({})
          }}
        >
          <RotateCcw aria-hidden /> Use defaults
        </Button>
      </div>
    </form>
  )
}

interface SectionProps {
  title: string
  description: string
  fields: FieldSpec[]
  values: Record<SettingKey, string>
  defaults: Record<SettingKey, string>
  errors: Partial<Record<SettingKey, string>>
  onChange: (key: SettingKey, value: string) => void
}

function Section({ title, description, fields, values, defaults, errors, onChange }: SectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key} className="space-y-1">
            <Label htmlFor={`setting-${f.key}`}>
              {f.label}
              {f.unit && <span className="text-muted-foreground"> ({f.unit})</span>}
            </Label>
            <Input
              id={`setting-${f.key}`}
              type="number"
              inputMode="decimal"
              min={f.min}
              max={f.max}
              step={f.step}
              value={values[f.key]}
              aria-invalid={!!errors[f.key]}
              aria-describedby={`setting-${f.key}-help`}
              onChange={(e) => onChange(f.key, e.target.value)}
            />
            <p id={`setting-${f.key}-help`} className="text-xs text-muted-foreground">
              {f.help} Default {defaults[f.key]}
              {f.unit ? ` ${f.unit}` : ''}.
            </p>
            {errors[f.key] && (
              <p role="alert" className="text-xs text-destructive">
                {errors[f.key]}
              </p>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
