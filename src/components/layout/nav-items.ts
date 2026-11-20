import { Map, Siren, UserCircle, Users, type LucideIcon } from 'lucide-react'
import type { RoleName } from '@/api/types'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  /** Omitted = every signed-in user. */
  roles?: RoleName[]
}

export interface NavSection {
  title: string
  items: NavItem[]
}

// Only screens that exist are listed. New screens are added here as each feature is delivered.
export const NAV_SECTIONS: NavSection[] = [
  {
    title: 'Operations',
    items: [
      { to: '/incidents', label: 'Incidents', icon: Siren, roles: ['Administrator', 'IncidentCoordinator'] },
      { to: '/map', label: 'Operations map', icon: Map, roles: ['Administrator', 'IncidentCoordinator'] },
    ],
  },
  {
    title: 'Administration',
    items: [{ to: '/admin/users', label: 'Users & roles', icon: Users, roles: ['Administrator'] }],
  },
  {
    title: 'You',
    items: [{ to: '/account', label: 'Account', icon: UserCircle }],
  },
]

export function visibleSections(hasAnyRole: (...roles: RoleName[]) => boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || hasAnyRole(...item.roles)),
  })).filter((section) => section.items.length > 0)
}
