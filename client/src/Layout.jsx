import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { Avatar, Icon, ThemeToggle } from './ui.jsx';

export default function Layout() {
  const { user, logout, isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  // Each role gets its own navigation labels and workspace identity
  const items = isAdmin
    ? [['/', 'Dashboard', 'dashboard'], ['/leads', 'Leads', 'leads'], ['/properties', 'Properties', 'building'], ['/bookings', 'Bookings', 'bookings'], ['/team', 'Team', 'team']]
    : [['/', 'My day', 'dashboard'], ['/leads', 'My leads', 'leads'], ['/properties', 'Inventory', 'building'], ['/bookings', 'My bookings', 'bookings']];
  return (
    <div className="shell" data-role={user.role}>
      <aside className={'side' + (open ? ' open' : '')}>
        <div className="brand"><span className="brand-mark" />Estate CRM<small>{isAdmin ? 'Admin console' : 'Sales workspace'}</small></div>
        <nav>
          {items.map(([to, label, icon]) => (
            <NavLink key={to} to={to} end={to === '/'} onClick={() => setOpen(false)} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
              <Icon name={icon} /> {label}
            </NavLink>
          ))}
        </nav>
        <div className="side-foot">
          <div className="me"><Avatar name={user.name} size={34} /><div><strong>{user.name}</strong><span className="role-pill">{isAdmin ? 'Admin' : 'Sales employee'}</span></div></div>
          <ThemeToggle />
          <button className="nav-link" onClick={() => { logout(); nav('/login'); }}><Icon name="logout" /> Sign out</button>
        </div>
      </aside>
      {open && <div className="scrim" onClick={() => setOpen(false)} />}
      <div className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setOpen(true)} aria-label="Open menu"><Icon name="menu" /></button>
          <span className="top-brand">Estate CRM</span>
        </header>
        <main className="page"><Outlet /></main>
      </div>
    </div>
  );
}
