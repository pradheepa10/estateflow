import { createContext, useCallback, useContext, useEffect, useState } from 'react';

export const STAGES = ['New', 'Contacted', 'Site Visit', 'Interested', 'Negotiation', 'Booked', 'Lost'];
export const STAGE_COLOR = { New: '#3b6ea8', Contacted: '#2a8a8c', 'Site Visit': '#6b5ba8', Interested: '#a97a2c', Negotiation: '#c4682d', Booked: '#2f7d57', Lost: '#a14a3c' };
export const SOURCES = ['Website', 'Referral', 'Walk-in', 'Social', 'Ads', 'Other'];
export const UNIT_TYPES = ['1BHK', '2BHK', '3BHK', 'Villa', 'Shop'];

export const inr = (n) => (n == null ? '-' : '₹' + Number(n).toLocaleString('en-IN'));
export const inrShort = (n) => {
  if (n == null) return '-';
  if (n >= 1e7) return '₹' + (n / 1e7).toFixed(2) + ' Cr';
  if (n >= 1e5) return '₹' + (n / 1e5).toFixed(1) + ' L';
  return inr(n);
};
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '-');
export const fmtDateTime = (d) => new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
export const toInput = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '');
export const isOverdue = (d, stage) => d && !['Booked', 'Lost'].includes(stage) && new Date(d) < new Date(new Date().setHours(0, 0, 0, 0));

const ICONS = {
  dashboard: '<rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/>',
  leads: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  building: '<path d="M3 21h18M5 21V7l8-4v18M19 21V11l-6-4M9 9v.01M9 13v.01M9 17v.01"/>',
  bookings: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  team: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  menu: '<path d="M3 6h18M3 12h18M3 18h18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  moon: '<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>',
};
export const Icon = ({ name, size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: ICONS[name] }} />
);

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);
export function ToastProvider({ children }) {
  const [list, setList] = useState([]);
  const push = useCallback((message, kind = 'ok') => {
    const id = Math.random();
    setList((l) => [...l, { id, message, kind }]);
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status">{list.map((t) => <div key={t.id} className={'toast ' + t.kind}>{t.message}</div>)}</div>
    </ToastCtx.Provider>
  );
}

export function Modal({ title, onClose, children, wide }) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
  return (
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head"><h3>{title}</h3><button className="icon-btn" onClick={onClose} aria-label="Close"><Icon name="x" /></button></div>
        {children}
      </div>
    </div>
  );
}

export const StageBadge = ({ stage }) => <span className="badge" style={{ '--c': STAGE_COLOR[stage] }}>{stage}</span>;
export const Avatar = ({ name, size = 28 }) => (
  <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.4 }} title={name}>
    {(name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('')}
  </span>
);
export const Empty = ({ title, hint, action }) => (
  <div className="empty"><div className="empty-mark" /><h4>{title}</h4>{hint && <p>{hint}</p>}{action}</div>
);
export const ErrorBox = ({ message, onRetry }) => (
  <div className="error-box"><strong>We could not load this.</strong><span>{message}</span>{onRetry && <button className="btn" onClick={onRetry}>Try again</button>}</div>
);
export const Skeleton = ({ rows = 5 }) => (
  <div className="skel-wrap">{Array.from({ length: rows }).map((_, i) => <div key={i} className="skel" style={{ width: `${70 + ((i * 13) % 30)}%` }} />)}</div>
);
export const Field = ({ label, error, children }) => (
  <label className="field"><span>{label}</span>{children}{error && <em>{error}</em>}</label>
);

export function ThemeToggle({ compact }) {
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'light');
  const flip = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    setTheme(next);
  };
  const label = theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode';
  if (compact) return <button className="theme-float" onClick={flip} aria-label={label} title={label}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /></button>;
  return <button className="nav-link" onClick={flip}><Icon name={theme === 'dark' ? 'sun' : 'moon'} /> {theme === 'dark' ? 'Light mode' : 'Dark mode'}</button>;
}
