import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/auth-context';
import { BrandMark } from '../brand/BrandMark';

const navItems = [
  { to: '/', label: 'Saisie', end: true },
  { to: '/history', label: 'Historique', end: false },
  { to: '/charts', label: 'Graphes', end: false },
] as const;

export function AppLayout() {
  const { logout } = useAuth();

  return (
    <div className="app-shell">
      <header className="app-header">
        <BrandMark />
        <button
          type="button"
          className="logout-button"
          aria-label="Se déconnecter"
          onClick={() => {
            void logout();
          }}
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            <path
              d="M10 5H7a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h3"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
            />
            <path
              d="M11 12h9M17 8l4 4-4 4"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <nav className="app-nav" aria-label="Navigation principale">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              isActive ? 'nav-link nav-link-active' : 'nav-link'
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
