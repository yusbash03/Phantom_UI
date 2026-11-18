/** A failed API call, carrying the server's RFC 9457 problem details. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string | undefined
  readonly traceId: string | undefined
  readonly fieldErrors: Record<string, string[]>

  constructor(status: number, problem: unknown) {
    const body = isRecord(problem) ? problem : {}
    super(typeof body.title === 'string' ? body.title : defaultMessage(status))
    this.name = 'ApiError'
    this.status = status
    this.code = typeof body.code === 'string' ? body.code : undefined
    this.traceId = typeof body.traceId === 'string' ? body.traceId : undefined
    this.fieldErrors = isRecord(body.errors) ? toFieldErrors(body.errors) : {}
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function toFieldErrors(errors: Record<string, unknown>): Record<string, string[]> {
  const result: Record<string, string[]> = {}
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) result[key] = value.filter((v): v is string => typeof v === 'string')
  }
  return result
}

function defaultMessage(status: number): string {
  if (status === 0) return 'The PHANTOM service could not be reached. Check your connection and try again.'
  if (status === 403) return 'You do not have permission to do that.'
  if (status === 404) return 'The requested record was not found.'
  if (status === 429) return 'Too many requests. Please wait a moment and try again.'
  if (status >= 500) return 'The server encountered an error. Please try again.'
  return 'The request could not be completed.'
}

/** Unwraps an openapi-fetch result, throwing ApiError on failure. */
export function unwrap<T>(result: { data?: T; error?: unknown; response: Response }): T {
  if (result.response.ok && result.data !== undefined) return result.data
  if (result.response.ok) return undefined as T
  throw new ApiError(result.response.status, result.error)
}
