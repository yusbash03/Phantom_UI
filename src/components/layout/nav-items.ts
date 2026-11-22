import { BarChart3, Bell, Settings, ClipboardList, HardHat, LayoutDashboard, Map, ScrollText, Siren, UserCircle, Users, type LucideIcon } from 'lucide-react'
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
      { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['Administrator', 'IncidentCoordinator'] },
      { to: '/incidents', label: 'Incidents', icon: Siren, roles: ['Administrator', 'IncidentCoordinator'] },
      { to: '/map', label: 'Operations map', icon: Map, roles: ['Administrator', 'IncidentCoordinator'] },
      { to: '/reports', label: 'Reports', icon: BarChart3, roles: ['Administrator', 'IncidentCoordinator'] },
      { to: '/responders', label: 'Responders', icon: HardHat, roles: ['Administrator', 'IncidentCoordinator'] },
      { to: '/assignments', label: 'My assignments', icon: ClipboardList, roles: ['Responder'] },
    ],
  },
  {
    title: 'Administration',
    items: [
      { to: '/admin/users', label: 'Users & roles', icon: Users, roles: ['Administrator'] },
      { to: '/admin/audit', label: 'Audit log', icon: ScrollText, roles: ['Administrator'] },
      { to: '/admin/settings', label: 'Settings', icon: Settings, roles: ['Administrator'] },
    ],
  },
  {
    title: 'You',
    items: [
      { to: '/notifications', label: 'Notifications', icon: Bell },
      { to: '/account', label: 'Account', icon: UserCircle },
    ],
  },
]

export function visibleSections(hasAnyRole: (...roles: RoleName[]) => boolean): NavSection[] {
  return NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || hasAnyRole(...item.roles)),
  })).filter((section) => section.items.length > 0)
}
