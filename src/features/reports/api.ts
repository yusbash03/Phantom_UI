import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api, authFetch } from '@/api/client'
import { ApiError, unwrap } from '@/api/errors'

export interface ReportPeriod {
  from: string
  to: string
}

export const reportKeys = {
  all: ['reports'] as const,
  summary: (period: ReportPeriod) => [...reportKeys.all, 'summary', period] as const,
}

/** Requirement 16: computed by the API from the database for the chosen period. */
export function useReportSummary(period: ReportPeriod | null) {
  return useQuery({
    queryKey: reportKeys.summary(period ?? { from: '', to: '' }),
    queryFn: async ({ signal }) =>
      unwrap(await api.GET('/api/v1/reports/summary', { signal, params: { query: { From: period!.from, To: period!.to } } })),
    enabled: period !== null,
    placeholderData: keepPreviousData,
  })
}

/** The CSV needs the bearer token, so it is fetched and saved rather than linked. */
export async function downloadSummaryCsv(period: ReportPeriod) {
  const url = new URL('/api/v1/reports/summary.csv', window.location.origin)
  url.searchParams.set('From', period.from)
  url.searchParams.set('To', period.to)
  const response = await authFetch(new Request(url))
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => null))
  const name = /filename="?([^";]+)"?/.exec(response.headers.get('content-disposition') ?? '')?.[1] ?? 'phantom-summary.csv'
  const objectUrl = URL.createObjectURL(await response.blob())
  try {
    const link = document.createElement('a')
    link.href = objectUrl
    link.download = name
    link.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000)
  }
}
