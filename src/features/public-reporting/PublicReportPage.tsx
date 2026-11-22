import { useCallback, useState } from 'react'
import { ApiError } from '@/api/errors'
import { PhantomMark } from '@/components/layout/PhantomMark'
import { useSubmitReport, type SubmitReportResponse } from './api'
import { ConfirmationScreen } from './ConfirmationScreen'
import { ReportForm } from './ReportForm'
import type { ReportFormValues } from './schema'

/** Stable idempotency key for the current form instance. Regenerated only when form is reset. */
function newIdempotencyKey() {
  return crypto.randomUUID()
}

export function PublicReportPage() {
  const [idempotencyKey, setIdempotencyKey] = useState(newIdempotencyKey)
  const [submitted, setSubmitted] = useState<SubmitReportResponse | null>(null)
  const [serverError, setServerError] = useState<string | null>(null)
  const [serverFieldErrors, setServerFieldErrors] = useState<Record<string, string[]>>({})

  const mutation = useSubmitReport()

  const handleSubmit = useCallback(
    (values: ReportFormValues, recording: File | null = null) => {
      setServerError(null)
      setServerFieldErrors({})

      const formData = new FormData()
      formData.append('title', values.title)
      formData.append('description', values.description)
      formData.append('category', values.category)
      formData.append('locationText', values.locationText)
      if (values.latitude && values.latitude !== '') formData.append('latitude', values.latitude)
      if (values.longitude && values.longitude !== '') formData.append('longitude', values.longitude)
      if (values.reporterName) formData.append('reporterName', values.reporterName)
      if (values.reporterPhone) formData.append('reporterPhone', values.reporterPhone)
      if (values.reporterEmail) formData.append('reporterEmail', values.reporterEmail)
      if (values.files) {
        Array.from(values.files).forEach((file) => formData.append('files', file))
      }
      if (recording) {
        formData.append('files', recording)
      }

      mutation.mutate(
        { formData, idempotencyKey },
        {
          onSuccess: (data) => setSubmitted(data),
          onError: (err) => {
            setServerError(err instanceof Error ? err.message : 'Submission failed. Please try again.')
            if (err instanceof ApiError) {
              setServerFieldErrors(err.fieldErrors)
              // An expired key can never succeed; a fresh one lets the reporter retry.
              if (err.status === 409) setIdempotencyKey(newIdempotencyKey())
            }
          },
        },
      )
    },
    [mutation, idempotencyKey],
  )

  function handleReportAnother() {
    setSubmitted(null)
    setServerError(null)
    setServerFieldErrors({})
    setIdempotencyKey(newIdempotencyKey())
  }

  return (
    <div className="min-h-svh bg-background text-foreground">
      {/* Minimal header — no internal nav links */}
      <header className="flex items-center gap-3 border-b border-border px-4 py-3 sm:px-6">
        <PhantomMark className="size-6" />
        <span className="font-semibold tracking-tight">PHANTOM</span>
        <span className="ml-auto text-xs text-muted-foreground">Emergency Reporting</span>
      </header>

      <main className="mx-auto max-w-lg px-4 py-8 sm:px-6">
        {submitted ? (
          <ConfirmationScreen result={submitted} onReportAnother={handleReportAnother} />
        ) : (
          <>
            <div className="mb-6 space-y-1">
              <h1 className="text-2xl font-semibold">Report an incident</h1>
              <p className="text-sm text-muted-foreground">
                Use this form to report an emergency or public safety concern. No account is required.
              </p>
            </div>

            <ReportForm
              onSubmit={handleSubmit}
              isSubmitting={mutation.isPending}
              serverError={serverError}
              serverFieldErrors={serverFieldErrors}
            />
          </>
        )}
      </main>
    </div>
  )
}
