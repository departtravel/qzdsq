import { NavLink, useNavigate } from 'react-router-dom'
import clsx from 'clsx'
import { useAuthStore } from '../../store/authStore'

interface NavItem {
  icon: string
  label: string
  to: string
}

const navItems: NavItem[] = [
  { icon: '📊', label: 'Tableau de Bord', to: '/dashboard' },
  { icon: '📅', label: 'Planning', to: '/planning' },
  { icon: '⚙️', label: 'Workflow', to: '/workflow' },
  { icon: '✉️', label: 'Emails IA', to: '/emails' },
  { icon: '🗺️', label: 'Excursions', to: '/excursions' },
  { icon: '🤝', label: 'Partenaires', to: '/partners' },
  { icon: '🌐', label: 'OTAs', to: '/otas' },
  { icon: '📆', label: 'Calendrier', to: '/calendar' },
  { icon: '👥', label: 'CRM Clients', to: '/crm' },
  { icon: '🤖', label: 'Agents IA', to: '/agents' },
  { icon: '⚙️', label: 'Paramètres', to: '/settings' },
]

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login')
  }

  return (
    <div className="flex h-screen overflow-hidden bg-bg">
      {/* Sidebar */}
      <aside className="flex flex-col w-[220px] min-w-[220px] bg-bg2 border-r border-border">
        {/* Branding */}
        <div className="px-5 py-5 border-b border-border">
          <div className="text-accent font-bold text-lg tracking-tight leading-none">
            DepartTravel
          </div>
          <div className="text-text/40 text-xs mt-0.5 tracking-widest uppercase">
            ERP Agence
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors duration-150 mb-0.5',
                  isActive
                    ? 'bg-accent/15 text-accent font-medium'
                    : 'text-text/60 hover:bg-bg3 hover:text-text',
                )
              }
            >
              <span className="text-base leading-none">{item.icon}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* User info + logout */}
        <div className="px-4 py-4 border-t border-border">
          {user && (
            <div className="mb-3">
              <div className="text-sm font-medium text-text truncate">{user.name}</div>
              <div className="text-xs text-text/40 truncate">{user.email}</div>
              <div className="mt-1">
                <span className="inline-block px-1.5 py-0.5 rounded text-[10px] bg-accent/15 text-accent uppercase tracking-wide">
                  {user.role}
                </span>
              </div>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="w-full text-left text-xs text-text/40 hover:text-alert transition-colors duration-150 flex items-center gap-1.5"
          >
            <svg className="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M3 4.25A2.25 2.25 0 0 1 5.25 2h5.5A2.25 2.25 0 0 1 13 4.25v2a.75.75 0 0 1-1.5 0v-2a.75.75 0 0 0-.75-.75h-5.5a.75.75 0 0 0-.75.75v11.5c0 .414.336.75.75.75h5.5a.75.75 0 0 0 .75-.75v-2a.75.75 0 0 1 1.5 0v2A2.25 2.25 0 0 1 10.75 18h-5.5A2.25 2.25 0 0 1 3 15.75V4.25Z" clipRule="evenodd" />
              <path fillRule="evenodd" d="M6 10a.75.75 0 0 1 .75-.75h9.546l-1.048-.943a.75.75 0 1 1 1.004-1.114l2.5 2.25a.75.75 0 0 1 0 1.114l-2.5 2.25a.75.75 0 1 1-1.004-1.114l1.048-.943H6.75A.75.75 0 0 1 6 10Z" clipRule="evenodd" />
            </svg>
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  )
}
