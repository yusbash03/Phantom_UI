import { useEffect, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { toast } from 'sonner'
import { ArrowLeft, FileAudio, FileImage, Mail, Phone, SearchX, User } from 'lucide-react'
import { ApiError } from '@/api/errors'
import type { IncidentAttachment, IncidentDetail, IncidentReport, Schemas } from '@/api/types'
import { LocationBadge } from '@/components/data/LocationBadge'
import { SeverityBadge } from '@/components/data/SeverityBadge'
import { StatusBadge } from '@/components/data/StatusBadge'
import { EmptyState } from '@/components/feedback/EmptyState'
import { ErrorState } from '@/components/feedback/ErrorState'
import { Spinner } from '@/components/feedback/LoadingState'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadAttachment, fetchAttachment, useIncident } from './api'
import { AssignmentsPanel } from '@/features/assignments/AssignmentsPanel'
import { IncidentActions } from './components/IncidentActions'
import { IncidentTimeline } from './components/IncidentTimeline'
import { IntelligencePanel } from './components/IntelligencePanel'
import { RelationsPanel } from './components/RelationsPanel'
import { WeatherPanel } from './components/WeatherPanel'
import { mailtoHref, telHref } from './contact-links'
import { CATEGORY_LABELS } from './labels'

const dateTime = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' })
const formatDate = (value: string | null | undefined) => (value ? dateTime.format(new Date(value)) : '—')

const PRECISION_TEXT: Record<Schemas['LocationPrecision'], string> = {
  Exact: 'Point',
  Street: 'Street level',
  Locality: 'Locality',
  Region: 'Region',
  Unknown: 'Unknown precision',
}

export function IncidentDetailPage() {
  const { id = '' } = useParams()
  const query = useIncident(id)

  return (
    <>
      <Link to="/incidents" className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-4" aria-hidden /> All incidents
      </Link>
      {query.isPending ? (
        <DetailSkeleton />
      ) : query.isError ? (
        query.error instanceof ApiError && query.error.status === 404 ? (
          <EmptyState icon={SearchX} title="Incident not found" description="It may have been mistyped, or you may not have access to it." />
        ) : (
          <ErrorState error={query.error} onRetry={() => void query.refetch()} title="The incident could not be loaded" />
        )
      ) : (
        <IncidentView incident={query.data} />
      )}
    </>
  )
}

function IncidentView({ incident }: { incident: IncidentDetail }) {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <p className="font-mono text-sm text-muted-foreground">{incident.number}</p>
          <h1 className="text-xl font-semibold tracking-tight break-words sm:text-2xl">{incident.title}</h1>
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={incident.status} />
            <SeverityBadge severity={incident.approvedSeverity} />
            <Badge variant="secondary">{CATEGORY_LABELS[incident.category]}</Badge>
            {incident.isDemoData && (
              <Badge variant="outline" className="border-info/40 text-info">
                Demo data
              </Badge>
            )}
          </div>
        </div>
        <IncidentActions incident={incident} />
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm whitespace-pre-wrap">{incident.description}</p>
            </CardContent>
          </Card>

          <AssignmentsPanel incident={incident} />

          <IntelligencePanel incident={incident} />

          <RelationsPanel incident={incident} />

          <section aria-labelledby="reports-heading" className="space-y-3">
            <h2 id="reports-heading" className="text-base font-semibold">
              Public reports ({incident.reports.length})
            </h2>
            {incident.reports.length === 0 ? (
              <Card>
                <CardContent className="text-sm text-muted-foreground">No reports are linked to this incident.</CardContent>
              </Card>
            ) : (
              incident.reports.map((report) => <ReportCard key={report.id} report={report} />)
            )}
          </section>

          <IncidentTimeline incident={incident} />
        </div>

        <aside className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Location</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="break-words">{incident.location.text}</p>
              <LocationBadge
                hasCoordinates={incident.location.latitude !== null && incident.location.longitude !== null}
                isVerified={incident.location.isVerified}
                provenance={incident.location.provenance}
              />
              {incident.location.latitude !== null && incident.location.longitude !== null && (
                <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                  <dt className="text-muted-foreground">Coordinates</dt>
                  <dd className="font-mono">
                    {incident.location.latitude}, {incident.location.longitude}
                  </dd>
                  <dt className="text-muted-foreground">Precision</dt>
                  <dd>{PRECISION_TEXT[incident.location.precision]}</dd>
                  {incident.location.verifiedBy && (
                    <>
                      <dt className="text-muted-foreground">Verified by</dt>
                      <dd>
                        {incident.location.verifiedBy.displayName}, {formatDate(incident.location.verifiedAt)}
                      </dd>
                    </>
                  )}
                </dl>
              )}
              {incident.location.geocoderPlaceName && !incident.location.isVerified && (
                <p className="text-xs text-muted-foreground">Matched by the geocoder as “{incident.location.geocoderPlaceName}”.</p>
              )}
              {(incident.geocodingStatus === 'Pending' || incident.geocodingStatus === 'Processing') && (
                <p className="text-xs text-muted-foreground">Looking up approximate coordinates…</p>
              )}
              {incident.locationNeedsVerification && (
                <p className="text-xs text-warning">
                  {incident.geocodingStatus === 'NoResult' || incident.geocodingStatus === 'Failed'
                    ? 'This location could not be found automatically and needs verification.'
                    : 'This location needs verification.'}
                </p>
              )}
            </CardContent>
          </Card>

          <WeatherPanel incident={incident} />

          <Card>
            <CardHeader>
              <CardTitle>Handling</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <Field label="Coordinator">{incident.assignedCoordinator?.displayName ?? 'Not yet reviewed'}</Field>
                <Field label="Reported">{formatDate(incident.createdAt)}</Field>
                <Field label="Last updated">{formatDate(incident.updatedAt)}</Field>
                {incident.verifiedBy && (
                  <Field label="Verified">
                    {incident.verifiedBy.displayName}, {formatDate(incident.verifiedAt)}
                  </Field>
                )}
                {incident.resolutionSummary && (
                  <Field label={incident.resolvedAt ? 'Resolution' : 'Previous resolution'}>
                    <p className="whitespace-pre-wrap">{incident.resolutionSummary}</p>
                    {incident.resolvedBy && (
                      <p className="text-xs text-muted-foreground">
                        {incident.resolvedBy.displayName}, {formatDate(incident.resolvedAt)}
                      </p>
                    )}
                  </Field>
                )}
                {incident.closureReason && <Field label="Closure reason">{incident.closureReason}</Field>}
                {incident.closedAt && <Field label="Closed">{formatDate(incident.closedAt)}</Field>}
              </dl>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wider text-muted-foreground uppercase">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

function ReportCard({ report }: { report: IncidentReport }) {
  const hasContact = report.reporterName || report.reporterPhone || report.reporterEmail
  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <CardTitle className="font-mono text-sm">{report.reference}</CardTitle>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {report.isOriginal ? <Badge variant="secondary">Original report</Badge> : <Badge variant="outline">Linked report</Badge>}
            {formatDate(report.submittedAt)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="font-medium">{report.title}</p>
          <p className="mt-1 whitespace-pre-wrap text-muted-foreground">{report.description}</p>
        </div>
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
          <dt className="text-muted-foreground">Category given</dt>
          <dd>{CATEGORY_LABELS[report.category]}</dd>
          <dt className="text-muted-foreground">Location given</dt>
          <dd className="break-words">
            {report.locationText}
            {report.reportedLatitude !== null && report.reportedLongitude !== null && (
              <span className="ml-1 font-mono text-muted-foreground">
                ({report.reportedLatitude}, {report.reportedLongitude})
              </span>
            )}
          </dd>
        </dl>
        {hasContact ? (
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-label="Reporter contact details">
            {report.reporterName && (
              <li className="flex items-center gap-1">
                <User className="size-3.5 text-muted-foreground" aria-hidden /> {report.reporterName}
              </li>
            )}
            {report.reporterPhone && (
              <li className="flex items-center gap-1">
                <Phone className="size-3.5 text-muted-foreground" aria-hidden />
                <ContactLink href={telHref(report.reporterPhone)} text={report.reporterPhone} />
              </li>
            )}
            {report.reporterEmail && (
              <li className="flex items-center gap-1">
                <Mail className="size-3.5 text-muted-foreground" aria-hidden />
                <ContactLink href={mailtoHref(report.reporterEmail)} text={report.reporterEmail} />
              </li>
            )}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Submitted anonymously.</p>
        )}
        {report.attachments.length > 0 && (
          <ul className="space-y-1" aria-label="Attachments">
            {report.attachments.map((a) => (
              <AttachmentRow key={a.id} attachment={a} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

/** Anything that is not plainly a phone number or email address is shown as text, not a link. */
function ContactLink({ href, text }: { href: string | null; text: string }) {
  return href ? (
    <a href={href} className="hover:underline">
      {text}
    </a>
  ) : (
    <span>{text}</span>
  )
}

function AttachmentRow({ attachment }: { attachment: IncidentAttachment }) {
  const [pending, setPending] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)
  const Icon = attachment.kind === 'Image' ? FileImage : FileAudio
  const isAudio = attachment.kind === 'Audio'

  useEffect(() => () => {
    if (audioUrl) URL.revokeObjectURL(audioUrl)
  }, [audioUrl])

  async function play() {
    setPending(true)
    try {
      setAudioUrl(URL.createObjectURL(await fetchAttachment(attachment.id)))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The recording could not be loaded.')
    } finally {
      setPending(false)
    }
  }

  async function download() {
    setPending(true)
    try {
      await downloadAttachment(attachment.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'The attachment could not be downloaded.')
    } finally {
      setPending(false)
    }
  }

  return (
    <li className="space-y-2 rounded-md bg-muted px-3 py-2 text-xs">
      <div className="flex items-center gap-2">
        <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate">{isAudio ? 'Voice recording' : attachment.originalFileName}</span>
        <span className="shrink-0 text-muted-foreground">{(attachment.sizeBytes / 1024).toFixed(0)} KB</span>
        {isAudio && !audioUrl && (
          <Button size="sm" variant="ghost" onClick={() => void play()} disabled={pending} aria-label="Play voice recording">
            Play
          </Button>
        )}
        <Button size="sm" variant="ghost" onClick={() => void download()} disabled={pending} aria-label={`Download ${attachment.originalFileName}`}>
          {pending ? <Spinner /> : 'Download'}
        </Button>
      </div>
      {audioUrl && (
        // oxlint-disable-next-line jsx-a11y/media-has-caption -- the transcript below is the text alternative
        <audio controls autoPlay src={audioUrl} className="w-full" aria-label="Voice recording" />
      )}
      {isAudio &&
        (attachment.transcript ? (
          <figure className="space-y-1 rounded border border-dashed border-info/40 bg-background p-2">
            <figcaption className="text-muted-foreground">
              Automatic transcript · {attachment.transcriptProvider} · may contain errors. The original recording is kept unchanged.
            </figcaption>
            <blockquote className="text-sm whitespace-pre-wrap">{attachment.transcript}</blockquote>
          </figure>
        ) : (
          <p className="text-muted-foreground">Not transcribed. Listen to the original recording.</p>
        ))}
    </li>
  )
}

function DetailSkeleton() {
  return (
    <output aria-label="Loading incident" className="block space-y-4">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-2/3" />
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-48 lg:col-span-2" />
        <Skeleton className="h-48" />
      </div>
    </output>
  )
}
