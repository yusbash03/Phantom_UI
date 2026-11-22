import type { OperationalSettings } from '@/api/types'

export type SettingKey = keyof OperationalSettings

export interface FieldSpec {
  key: SettingKey
  label: string
  help: string
  min: number
  max: number
  step: number
  unit?: string
}

/** Ranges mirror the API's validation (Requirement 17.1); the API remains the authority. */
export const CORRELATION_FIELDS: FieldSpec[] = [
  { key: 'geoWeight', label: 'Distance weight', help: 'How much closeness on the map counts.', min: 0, max: 1, step: 0.05 },
  { key: 'timeWeight', label: 'Time weight', help: 'How much reports close in time count.', min: 0, max: 1, step: 0.05 },
  { key: 'categoryWeight', label: 'Category weight', help: 'How much a matching category counts.', min: 0, max: 1, step: 0.05 },
  { key: 'textWeight', label: 'Text weight', help: 'How much similar wording counts.', min: 0, max: 1, step: 0.05 },
  { key: 'locationWeight', label: 'Place-name weight', help: 'How much shared place names count.', min: 0, max: 1, step: 0.05 },
  { key: 'geoRadiusMeters', label: 'Distance radius', help: 'Reports further apart than this score zero on distance.', min: 50, max: 100_000, step: 50, unit: 'm' },
  { key: 'windowHours', label: 'Time window', help: 'Only reports within this many hours of each other are compared.', min: 0.25, max: 168, step: 0.25, unit: 'h' },
  { key: 'suggestThreshold', label: 'Suggestion threshold', help: 'A pair is suggested as a possible duplicate at or above this score.', min: 0.1, max: 1, step: 0.05 },
]

export const WEATHER_FIELDS: FieldSpec[] = [
  { key: 'weatherCacheMinutes', label: 'Weather cache', help: 'Readings for the same area are reused for this long. 0 turns the cache off.', min: 0, max: 1440, step: 1, unit: 'min' },
]

export const ALL_FIELDS = [...CORRELATION_FIELDS, ...WEATHER_FIELDS]

/** Client-side check matching the API, so obvious mistakes are caught before saving. */
export function validate(values: Record<SettingKey, string>): Partial<Record<SettingKey, string>> {
  const errors: Partial<Record<SettingKey, string>> = {}
  for (const f of ALL_FIELDS) {
    const raw = values[f.key]
    const n = Number(raw)
    if (raw.trim() === '' || !Number.isFinite(n)) errors[f.key] = 'Enter a number.'
    else if (n < f.min || n > f.max) errors[f.key] = `Must be between ${f.min} and ${f.max}${f.unit ? ` ${f.unit}` : ''}.`
    else if (f.key === 'weatherCacheMinutes' && !Number.isInteger(n)) errors[f.key] = 'Use whole minutes.'
  }
  const weights: SettingKey[] = ['geoWeight', 'timeWeight', 'categoryWeight', 'textWeight', 'locationWeight']
  if (!errors.geoWeight && weights.every((k) => Number(values[k]) === 0)) errors.geoWeight = 'At least one weight must be above 0.'
  return errors
}

export function toStrings(values: OperationalSettings): Record<SettingKey, string> {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f.key, String(values[f.key])])) as Record<SettingKey, string>
}

export function toValues(strings: Record<SettingKey, string>): OperationalSettings {
  return Object.fromEntries(ALL_FIELDS.map((f) => [f.key, Number(strings[f.key])])) as unknown as OperationalSettings
}
