import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Saisie', end: true },
  { to: '/history', label: 'Historique', end: false },
  { to: '/charts', label: 'Graphes', end: false },
] as const;

export function AppLayout() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <p className="app-name">Energy Tracker</p>
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
