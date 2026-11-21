import type { IncidentCategory, WeatherFailureReason, WeatherReading } from '@/api/types'

export type WeatherField = 'temperatureC' | 'precipitationMm' | 'rainMm' | 'windSpeedKmh' | 'windDirectionDegrees' | 'windGustsKmh' | 'visibilityMetres'

export const FIELD_LABELS: Record<WeatherField, string> = {
  temperatureC: 'Temperature',
  precipitationMm: 'Precipitation',
  rainMm: 'Rain',
  windSpeedKmh: 'Wind speed',
  windDirectionDegrees: 'Wind from',
  windGustsKmh: 'Wind gusts',
  visibilityMetres: 'Visibility',
}

const ALL_FIELDS: WeatherField[] = ['temperatureC', 'windSpeedKmh', 'windDirectionDegrees', 'windGustsKmh', 'precipitationMm', 'rainMm', 'visibilityMetres']

/** Requirement 9.3: the fields that matter most for each kind of incident. */
export const RELEVANT: Partial<Record<IncidentCategory, WeatherField[]>> = {
  Fire: ['windSpeedKmh', 'windDirectionDegrees', 'windGustsKmh'],
  Flood: ['precipitationMm', 'rainMm'],
  RoadAccident: ['precipitationMm', 'visibilityMetres'],
}

/** Relevant fields first, then the rest, each marked. */
export function orderedFields(category: IncidentCategory): { field: WeatherField; relevant: boolean }[] {
  const relevant = RELEVANT[category] ?? []
  return [...relevant.map((field) => ({ field, relevant: true })), ...ALL_FIELDS.filter((f) => !relevant.includes(f)).map((field) => ({ field, relevant: false }))]
}

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']

export function formatField(field: WeatherField, reading: WeatherReading): string {
  const value = reading[field]
  if (value === null) return 'Not reported'
  switch (field) {
    case 'temperatureC':
      return `${value.toFixed(1)} °C`
    case 'precipitationMm':
    case 'rainMm':
      return `${value.toFixed(1)} mm`
    case 'windSpeedKmh':
    case 'windGustsKmh':
      return `${value.toFixed(0)} km/h`
    case 'windDirectionDegrees':
      return `${COMPASS[Math.round(value / 45) % 8]} (${value}°)`
    case 'visibilityMetres':
      return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value.toFixed(0)} m`
  }
}

export const FAILURE_LABELS: Record<WeatherFailureReason, string> = {
  Timeout: 'The weather provider timed out',
  Unreachable: 'The weather provider could not be reached',
  ProviderError: 'The weather provider returned an error',
  InvalidResponse: 'The weather provider sent an unreadable response',
  NotConfigured: 'No weather provider is configured',
}
