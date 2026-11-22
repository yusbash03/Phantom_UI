import { useState } from 'react'
import { toast } from 'sonner'
import { Download } from 'lucide-react'
import type { DurationStat, ReportSummary } from '@/api/types'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { PageHeader } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { CATEGORY_LABELS, STATUS_LABELS } from '@/features/incidents/labels'
import type { IncidentCategory, IncidentStatus } from '@/api/types'
import { downloadSummaryCsv, useReportSummary } from './api'
import { dayString, formatDuration, formatRate, periodFromDays } from './format'

const MAX_DAYS = 366

function labelFor(section: 'category' | 'severity' | 'status', key: string): string {
  if (section === 'category') return CATEGORY_LABELS[key as IncidentCategory] ?? key
  if (section === 'status') return STATUS_LABELS[key as IncidentStatus] ?? key
  return key === 'NotAssessed' ? 'Not yet assessed' : key
}

/** Summary reports for a period (Requirement 16): counts, response times and AI agreement, with CSV export. */
export function ReportsPage() {
  // The last 30 days, including today.
  const [fromDay, setFromDay] = useState(() => {
    const start = new Date()
    start.setDate(start.getDate() - 29)
    return dayString(start)
  })
  const [toDay, setToDay] = useState(() => dayString(new Date()))
  const [downloading, setDownloading] = useState(false)

  const period = periodFromDays(fromDay, toDay)
  const tooLong = period !== null && (new Date(period.to).getTime() - new Date(period.from).getTime()) / 86_400_000 > MAX_DAYS
  const query = useReportSummary(period && !tooLong ? period : null)

  async function download() {
    if (!period) return
    setDownloading(true)
    try {
      await downloadSummaryCsv(period)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The CSV could not be downloaded.')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <PageHeader
        title="Reports"
        description="Computed from live records for the period you choose."
        actions={
          <Button variant="outline" onClick={() => void download()} disabled={!period || tooLong || downloading}>
            {downloading ? <Spinner /> : <Download aria-hidden />} Download CSV
          </Button>
        }
      />
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-end gap-4">
          <div className="space-y-1">
            <Label htmlFor="report-from">From</Label>
            <Input id="report-from" type="date" value={fromDay} max={toDay} onChange={(e) => setFromDay(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="report-to">To (inclusive)</Label>
            <Input id="report-to" type="date" value={toDay} min={fromDay} onChange={(e) => setToDay(e.target.value)} />
          </div>
          {!period && (
            <p role="alert" className="text-sm text-destructive">
              Choose a start date on or before the end date.
            </p>
          )}
          {tooLong && (
            <p role="alert" className="text-sm text-destructive">
              A report can cover at most {MAX_DAYS} days.
            </p>
          )}
        </CardContent>
      </Card>

      {!period || tooLong ? null : query.isPending ? (
        <Spinner label="Calculating…" />
      ) : query.isError ? (
        <ErrorState error={query.error} onRetry={() => void query.refetch()} title="The report could not be calculated" />
      ) : (
        <Summary data={query.data} />
      )}
    </>
  )
}

function Summary({ data }: { data: ReportSummary }) {
  const ai = data.aiSeverityAgreement
  return (
    <div className="space-y-6">
      <section aria-label="Headline figures" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <Figure label="Incidents reported" value={data.totalIncidents.toLocaleString()} />
        <Timing label="Report → verification" stat={data.reportToVerification} />
        <Timing label="Report → first acknowledgement" stat={data.reportToFirstAcknowledgement} />
        <Timing label="Report → resolution" stat={data.reportToResolution} />
        <Figure
          label="AI severity agreement"
          value={formatRate(ai.rate)}
          hint={
            ai.compared === 0
              ? 'No incident has both an AI recommendation and an approved severity.'
              : `${ai.agreed} of ${ai.compared} matched the approved severity. AI higher ${ai.aiHigher}, lower ${ai.aiLower}.`
          }
        />
      </section>
      <div className="grid gap-6 lg:grid-cols-3">
        <Breakdown title="By category" section="category" items={data.byCategory} total={data.totalIncidents} />
        <Breakdown title="By approved severity" section="severity" items={data.bySeverity} total={data.totalIncidents} />
        <Breakdown title="By current status" section="status" items={data.byStatus} total={data.totalIncidents} />
      </div>
      <p className="text-xs text-muted-foreground">
        Incidents reported from {new Date(data.from).toLocaleString()} up to {new Date(data.to).toLocaleString()}. Times are medians over the incidents that reached
        each step; the AI figure compares recommendations with coordinators’ decisions and does not measure accuracy.
      </p>
    </div>
  )
}

function Figure({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="gap-1 px-4 py-3">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-muted-foreground">{hint}</p>}
    </Card>
  )
}

function Timing({ label, stat }: { label: string; stat: DurationStat }) {
  return (
    <Figure
      label={`Median ${label}`}
      value={formatDuration(stat.medianSeconds)}
      hint={stat.sampleSize === 0 ? 'No incidents reached this step.' : `From ${stat.sampleSize} incident${stat.sampleSize === 1 ? '' : 's'}.`}
    />
  )
}

function Breakdown({ title, section, items, total }: { title: string; section: 'category' | 'severity' | 'status'; items: ReportSummary['byCategory']; total: number }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <table className="w-full text-sm" aria-label={title}>
          <tbody>
            {items.map((item) => (
              <tr key={item.key} className="border-b border-border last:border-0">
                <th scope="row" className="py-1.5 pr-2 text-left font-normal">
                  {labelFor(section, item.key)}
                </th>
                <td className="w-1/2 py-1.5" aria-hidden>
                  <span className="block h-2 rounded-full bg-primary/70" style={{ width: total === 0 ? 0 : `${(item.count / total) * 100}%` }} aria-hidden />
                </td>
                <td className="py-1.5 pl-2 text-right tabular-nums">{item.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
