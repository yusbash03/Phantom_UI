import { Link } from 'react-router'
import { CheckCircle, Clock, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { SubmitReportResponse } from './api'

interface ConfirmationScreenProps {
  result: SubmitReportResponse
  onReportAnother: () => void
}

export function ConfirmationScreen({ result, onReportAnother }: ConfirmationScreenProps) {
  const submittedAt = new Date(result.submittedAt).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })

  return (
    <output className="flex flex-col items-center gap-6 px-4 py-10 text-center" aria-live="polite">
      <div className="grid size-16 place-items-center rounded-full bg-success/15">
        <CheckCircle className="size-8 text-[var(--success)]" aria-hidden />
      </div>

      <div className="space-y-2">
        <h1 className="text-xl font-semibold">Report submitted</h1>
        <p className="text-sm text-muted-foreground">
          Thank you for helping keep the community safe. Your report has been received and will be reviewed.
        </p>
      </div>

      <div className="w-full max-w-sm rounded-lg border border-border bg-card p-5 text-left space-y-4">
        <div className="flex items-start gap-3">
          <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Reference number</p>
            <p className="mt-0.5 font-mono text-lg font-semibold tracking-wide">{result.reference}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Save this reference to check your report status later.
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Submitted at</p>
            <p className="mt-0.5 text-sm">{submittedAt}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Button onClick={onReportAnother} variant="outline" className="w-full">
          Report another incident
        </Button>
        <Link
          to={`/report/status?ref=${encodeURIComponent(result.reference)}`}
          className="text-sm text-primary underline-offset-4 hover:underline"
        >
          Check status of this report
        </Link>
      </div>
    </output>
  )
}
