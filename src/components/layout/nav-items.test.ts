import type { RoleName } from '@/api/types'
import { visibleSections } from './nav-items'

const as = (...held: RoleName[]) => (...wanted: RoleName[]) => wanted.some((r) => held.includes(r))
const labels = (roles: RoleName[]) => visibleSections(as(...roles)).flatMap((s) => s.items.map((i) => i.label))

describe('visibleSections', () => {
  it('shows user administration only to administrators', () => {
    expect(labels(['Administrator'])).toContain('Users & roles')
    expect(labels(['IncidentCoordinator'])).not.toContain('Users & roles')
    expect(labels(['Responder'])).not.toContain('Users & roles')
    expect(labels(['Administrator'])).toContain('Audit log')
    expect(labels(['IncidentCoordinator'])).not.toContain('Audit log')
  })

  it('drops sections that end up empty', () => {
    expect(visibleSections(as('Responder')).map((s) => s.title)).not.toContain('Administration')
  })
})

describe('incident navigation', () => {
  it('shows incidents to operational staff only', () => {
    expect(labels(['IncidentCoordinator'])).toContain('Incidents')
    expect(labels(['Administrator'])).toContain('Incidents')
    expect(labels(['Responder'])).not.toContain('Incidents')
    expect(labels(['IncidentCoordinator'])).toContain('Operations map')
    expect(labels(['Responder'])).not.toContain('Operations map')
    expect(labels(['IncidentCoordinator'])).toContain('Dashboard')
    expect(labels(['Administrator'])).toContain('Dashboard')
    expect(labels(['Responder'])).not.toContain('Dashboard')
    expect(labels(['IncidentCoordinator'])).toContain('Responders')
    expect(labels(['Responder'])).not.toContain('Responders')
    expect(labels(['Responder'])).toContain('My assignments')
    expect(labels(['IncidentCoordinator'])).not.toContain('My assignments')
  })
})
