import { NavLink } from 'react-router'
import { useAuth } from '@/app/auth/auth-context'
import { cn } from '@/lib/utils'
import { visibleSections } from './nav-items'
import { PhantomMark } from './PhantomMark'

export function SidebarNav({ onNavigate }: { onNavigate?: () => void }) {
  const { hasAnyRole } = useAuth()
  return (
    <nav aria-label="Main" className="flex flex-col gap-6 px-3">
      {visibleSections(hasAnyRole).map((section) => (
        <div key={section.title}>
          <p className="px-3 pb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{section.title}</p>
          <ul className="space-y-0.5">
            {section.items.map(({ to, label, icon: Icon }) => (
              <li key={to}>
                <NavLink
                  to={to}
                  onClick={onNavigate}
                  className={({ isActive }) =>
                    cn(
                      'flex items-center gap-3 rounded-md px-3 py-2 text-sm text-sidebar-foreground transition-colors',
                      'hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
                      isActive && 'bg-sidebar-accent font-medium text-sidebar-accent-foreground shadow-[inset_2px_0_0_var(--sidebar-primary)]',
                    )
                  }
                >
                  <Icon className="size-4" aria-hidden />
                  {label}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  )
}

export function Sidebar() {
  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
      <div className="flex h-16 items-center border-b border-sidebar-border px-5">
        <PhantomMark />
      </div>
      <div className="flex-1 overflow-y-auto py-5">
        <SidebarNav />
      </div>
    </aside>
  )
}
