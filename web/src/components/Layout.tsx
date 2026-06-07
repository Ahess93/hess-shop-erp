import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { logout } from '../api/auth';
import { useAuthStore } from '../store/auth';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: string[];
}

const NAV_ITEMS: NavItem[] = [
  { to: '/jobs', label: 'Job Board', icon: '🏭' },
  { to: '/quotes', label: 'Quotes', icon: '📋', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/users', label: 'Users', icon: '👥', roles: ['SUPER_ADMIN', 'ADMIN'] },
  { to: '/settings', label: 'Settings', icon: '⚙️', roles: ['SUPER_ADMIN'] },
];

export function Layout() {
  const { user, clear } = useAuthStore();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const logoutMutation = useMutation({
    mutationFn: logout,
    onSettled: () => {
      clear();
      qc.clear();
      void navigate('/login');
    },
  });

  const visibleNav = NAV_ITEMS.filter(
    (item) => !item.roles || (user && item.roles.includes(user.role)),
  );

  return (
    <div className="flex h-screen bg-[var(--bg)] text-[var(--text)]">
      {/* Sidebar */}
      <aside className="w-56 flex-shrink-0 bg-[var(--surface)] border-r border-[var(--border)] flex flex-col">
        {/* Logo */}
        <div className="px-4 py-5 border-b border-[var(--border)]">
          <div className="text-[var(--gold)] font-bold text-lg leading-tight">Hess Solutions</div>
          <div className="text-[var(--text-muted)] text-xs mt-0.5">Shop ERP</div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-2 py-4 space-y-1">
          {visibleNav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                  isActive
                    ? 'bg-[var(--gold)]/15 text-[var(--gold)] font-medium'
                    : 'text-[var(--text-muted)] hover:text-[var(--text)] hover:bg-[var(--surface-2)]'
                }`
              }
            >
              <span>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User / logout */}
        <div className="px-4 py-4 border-t border-[var(--border)]">
          <div className="text-xs text-[var(--text-muted)] mb-1 truncate">{user?.name}</div>
          <div className="text-xs text-[var(--gold)]/70 mb-3 truncate">{user?.role}</div>
          <button
            onClick={() => logoutMutation.mutate()}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--danger)] transition-colors w-full text-left"
          >
            Sign out
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
