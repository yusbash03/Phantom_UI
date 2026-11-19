import { useEffect, useRef } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircle, ChevronDown, Paperclip, Upload, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Spinner } from '@/components/feedback/LoadingState'
import { type ReportFormValues, reportSchema } from './schema'
import { INCIDENT_CATEGORIES } from './api'

interface ReportFormProps {
  onSubmit: (values: ReportFormValues) => void
  isSubmitting: boolean
  serverError: string | null
  /** Field-level errors from the API (keys are form field names; casing may differ). */
  serverFieldErrors?: Record<string, string[]>
}

const FIELD_NAMES: readonly (keyof ReportFormValues)[] = [
  'title', 'description', 'category', 'locationText', 'latitude', 'longitude',
  'reporterName', 'reporterPhone', 'reporterEmail', 'files',
]

function toFieldName(key: string): keyof ReportFormValues | undefined {
  return FIELD_NAMES.find((name) => name.toLowerCase() === key.toLowerCase())
}

function FieldError({ message }: { message: string | undefined }) {
  if (!message) return null
  return (
    <p role="alert" className="mt-1 flex items-center gap-1 text-xs text-destructive">
      <AlertCircle className="size-3 shrink-0" aria-hidden />
      {message}
    </p>
  )
}

export function ReportForm({ onSubmit, isSubmitting, serverError, serverFieldErrors }: ReportFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    formState: { errors },
    // oxlint-disable-next-line react/incompatible-library
  } = useForm<ReportFormValues>({
    resolver: zodResolver(reportSchema),
    defaultValues: { category: undefined },
  })

  useEffect(() => {
    for (const [key, messages] of Object.entries(serverFieldErrors ?? {})) {
      const field = toFieldName(key)
      if (field && messages[0]) setError(field, { type: 'server', message: messages[0] })
    }
  }, [serverFieldErrors, setError])

  const files = useWatch({ control, name: 'files' })
  const fileList = files ? Array.from(files) : []

  function removeFile(index: number) {
    if (!fileInputRef.current) return
    const dt = new DataTransfer()
    fileList.forEach((f, i) => {
      if (i !== index) dt.items.add(f)
    })
    fileInputRef.current.files = dt.files
    setValue('files', dt.files.length > 0 ? dt.files : undefined, { shouldValidate: true })
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {/* Title */}
      <div className="space-y-1">
        <Label htmlFor="title">
          Title <span aria-hidden className="text-destructive">*</span>
        </Label>
        <Input
          id="title"
          placeholder="Brief description of the incident"
          aria-required="true"
          aria-invalid={!!errors.title}
          aria-describedby={errors.title ? 'title-error' : undefined}
          {...register('title')}
        />
        <span id="title-error">
          <FieldError message={errors.title?.message} />
        </span>
      </div>

      {/* Category — native <select> for testability and accessibility */}
      <div className="space-y-1">
        <Label htmlFor="category">
          Category <span aria-hidden className="text-destructive">*</span>
        </Label>
        <div className="relative">
          <select
            id="category"
            aria-required="true"
            aria-invalid={!!errors.category}
            aria-describedby={errors.category ? 'category-error' : undefined}
            className="h-9 w-full appearance-none rounded-md border border-input bg-transparent px-3 py-1 pr-8 text-sm shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-destructive/20"
            {...register('category')}
          >
            <option value="">Select a category</option>
            {INCIDENT_CATEGORIES.map(({ value, label }) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
        </div>
        <span id="category-error">
          <FieldError message={errors.category?.message} />
        </span>
      </div>

      {/* Description */}
      <div className="space-y-1">
        <Label htmlFor="description">
          Description <span aria-hidden className="text-destructive">*</span>
        </Label>
        <Textarea
          id="description"
          placeholder="What happened? Include as much detail as you can."
          rows={4}
          aria-required="true"
          aria-invalid={!!errors.description}
          aria-describedby={errors.description ? 'description-error' : undefined}
          {...register('description')}
        />
        <span id="description-error">
          <FieldError message={errors.description?.message} />
        </span>
      </div>

      {/* Location */}
      <div className="space-y-1">
        <Label htmlFor="locationText">
          Location <span aria-hidden className="text-destructive">*</span>
        </Label>
        <Input
          id="locationText"
          placeholder="Street address, landmark, or area"
          aria-required="true"
          aria-invalid={!!errors.locationText}
          aria-describedby={errors.locationText ? 'location-error' : undefined}
          {...register('locationText')}
        />
        <span id="location-error">
          <FieldError message={errors.locationText?.message} />
        </span>
      </div>

      {/* Coordinates — optional, collapsible pair */}
      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-muted-foreground transition-colors hover:text-foreground">
          Add precise coordinates (optional)
        </summary>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="latitude">Latitude</Label>
            <Input
              id="latitude"
              type="number"
              step="any"
              placeholder="-90 to 90"
              aria-invalid={!!errors.latitude}
              {...register('latitude')}
            />
            <FieldError message={errors.latitude?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="longitude">Longitude</Label>
            <Input
              id="longitude"
              type="number"
              step="any"
              placeholder="-180 to 180"
              aria-invalid={!!errors.longitude}
              {...register('longitude')}
            />
            <FieldError message={errors.longitude?.message} />
          </div>
        </div>
      </details>

      {/* Contact — optional */}
      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-muted-foreground transition-colors hover:text-foreground">
          Add your contact details (optional)
        </summary>
        <div className="mt-3 space-y-3">
          <div className="space-y-1">
            <Label htmlFor="reporterName">Name</Label>
            <Input id="reporterName" placeholder="Your name" {...register('reporterName')} />
            <FieldError message={errors.reporterName?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reporterPhone">Phone</Label>
            <Input id="reporterPhone" type="tel" placeholder="+1 555 000 0000" {...register('reporterPhone')} />
            <FieldError message={errors.reporterPhone?.message} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="reporterEmail">Email</Label>
            <Input id="reporterEmail" type="email" placeholder="you@example.com" {...register('reporterEmail')} />
            <FieldError message={errors.reporterEmail?.message} />
          </div>
        </div>
      </details>

      {/* File attachments */}
      <div className="space-y-2">
        <Label>Attachments (optional)</Label>
        <p className="text-xs text-muted-foreground">
          Up to 5 images (JPEG, PNG, WebP) and 1 audio file (WebM, OGG, MP3, WAV, M4A). Max 10 MB each.
        </p>

        {fileList.length > 0 && (
          <ul className="space-y-1" aria-label="Selected files">
            {fileList.map((file, i) => (
              <li key={i} className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-sm">
                <Paperclip className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="min-w-0 flex-1 truncate">{file.name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                </span>
                <button
                  type="button"
                  onClick={() => removeFile(i)}
                  className="shrink-0 rounded-sm text-muted-foreground hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="size-3.5" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}

        <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
          <Upload aria-hidden /> Choose files
        </Button>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept="image/jpeg,image/png,image/webp,audio/webm,audio/ogg,audio/mpeg,audio/wav,audio/mp4,audio/x-m4a"
          className="sr-only"
          aria-hidden="true"
          tabIndex={-1}
          onChange={(e) => {
            setValue('files', e.target.files ?? undefined, { shouldValidate: true })
          }}
        />

        <FieldError message={errors.files?.message} />
      </div>

      {/* Server-level error */}
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <span>{serverError}</span>
        </div>
      )}

      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? <Spinner label="Submitting…" /> : 'Submit report'}
      </Button>

      <p className="text-center text-xs text-muted-foreground">
        Your report is anonymous unless you provide contact details above.
      </p>
    </form>
  )
}
