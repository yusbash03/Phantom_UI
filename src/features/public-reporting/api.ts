import { useMutation, useQuery } from '@tanstack/react-query'
import { ApiError } from '@/api/errors'
import type { IncidentCategory, PublicReportStatus, PublicStatusResponse, SubmitReportResponse } from '@/api/types'

export type { SubmitReportResponse, PublicStatusResponse }

export const INCIDENT_CATEGORIES: { value: IncidentCategory; label: string }[] = [
  { value: 'Fire', label: 'Fire' },
  { value: 'MedicalEmergency', label: 'Medical emergency' },
  { value: 'RoadAccident', label: 'Road accident' },
  { value: 'Security', label: 'Security' },
  { value: 'Flood', label: 'Flood' },
  { value: 'Infrastructure', label: 'Infrastructure' },
  { value: 'Other', label: 'Other' },
]

export const PUBLIC_STATUS_TEXT: Record<PublicReportStatus, { label: string; description: string }> = {
  Received: { label: 'Received', description: 'Your report has been received and is waiting to be reviewed.' },
  UnderReview: { label: 'Under review', description: 'A coordinator is reviewing your report.' },
  BeingHandled: { label: 'Being handled', description: 'Responders have been assigned to this incident.' },
  Closed: { label: 'Closed', description: 'This report has been closed.' },
}

export const publicReportingKeys = {
  status: (reference: string) => ['public-reporting', 'status', reference] as const,
}

/** Public endpoints are anonymous, so they use plain fetch rather than the authenticated client. */
async function publicFetch<T>(input: string, init?: RequestInit): Promise<T> {
  let response: Response
  try {
    response = await fetch(input, init)
  } catch {
    throw new ApiError(0, null)
  }
  if (!response.ok) {
    throw new ApiError(response.status, await response.json().catch(() => null))
  }
  return (await response.json()) as T
}

export function useSubmitReport() {
  return useMutation({
    mutationFn: ({ formData, idempotencyKey }: { formData: FormData; idempotencyKey: string }) =>
      publicFetch<SubmitReportResponse>('/api/v1/public/reports', {
        method: 'POST',
        headers: { 'Idempotency-Key': idempotencyKey },
        body: formData,
      }),
  })
}

export function usePublicStatus(reference: string) {
  return useQuery({
    queryKey: publicReportingKeys.status(reference),
    queryFn: () => publicFetch<PublicStatusResponse>(`/api/v1/public/reports/${encodeURIComponent(reference)}/status`),
    enabled: reference.length > 0,
    retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 2,
    staleTime: 60_000,
  })
}
