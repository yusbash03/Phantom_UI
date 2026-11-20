import { describe, expect, it } from 'vitest'
import type { MapIncident } from '@/api/types'
import { boundsOf, markerAppearance } from './markers'

const base: MapIncident = {
  id: '1',
  number: 'PH-2026-000123',
  title: 'Fire',
  category: 'Fire',
  status: 'Verified',
  approvedSeverity: 'High',
  aiRecommendedSeverity: 'Critical',
  latitude: 6.6,
  longitude: 3.35,
  provenance: 'Geocoded',
  precision: 'Street',
  isVerified: false,
  locationText: 'Allen Avenue',
  geocoderPlaceName: 'Allen Avenue, Lagos',
  createdAt: '2026-11-20T08:00:00Z',
}

describe('markerAppearance', () => {
  it('marks unverified locations with a dashed ring, a tag and a spoken description', () => {
    const look = markerAppearance(base)
    expect(look.dashed).toBe(true)
    expect(look.tag).toBe('Unverified')
    expect(look.color).toBe('var(--severity-high)')
    expect(look.label).toBe('PH-2026-000123, Fire, High severity, Verified, unverified location (geocoded, approximate)')
  })

  it('shows verified locations plainly and never colours by the AI recommendation', () => {
    const look = markerAppearance({ ...base, isVerified: true, provenance: 'ManuallyVerified', approvedSeverity: null })
    expect(look.dashed).toBe(false)
    expect(look.tag).toBeNull()
    expect(look.color).toBe('var(--muted-foreground)')
    expect(look.label).toContain('severity not yet assessed')
    expect(look.label).toContain('verified location')
  })
})

describe('boundsOf', () => {
  it('frames all items and returns null when empty', () => {
    expect(boundsOf([])).toBeNull()
    expect(boundsOf([base, { ...base, latitude: 6.4, longitude: 3.5 }])).toEqual([3.35, 6.4, 3.5, 6.6])
  })
})
