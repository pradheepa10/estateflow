import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { errMsg } from '../api';
import { ThemeToggle } from '../ui.jsx';

export default function Login() {
  const { user, login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  if (user) return <Navigate to="/" replace />;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setError('');
    try { await login(email, password); nav('/'); }
    catch (err) { setError(errMsg(err)); }
    finally { setBusy(false); }
  };
  const demo = (e, p) => { setEmail(e); setPassword(p); };

  return (
    <div className="login">
      <ThemeToggle compact />
      <section className="login-art">
        <div className="skyline" aria-hidden="true">
          {[40, 70, 55, 90, 62, 80, 48].map((h, i) => <span key={i} style={{ height: `${h}%` }}><i /><i /><i /><i /></span>)}
        </div>
        <h1>Every enquiry, from first call to keys in hand.</h1>
        <p>Track leads, manage inventory and book units without double-booking a single flat.</p>
      </section>
      <form className="login-form" onSubmit={submit}>
        <h2>Sign in</h2>
        <label className="field"><span>Email</span><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus /></label>
        <label className="field"><span>Password</span><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="btn primary" disabled={busy}>{busy ? 'Signing in...' : 'Sign in'}</button>
        <div className="demo">
          <small>Try a demo account</small>
          <div>
            <button type="button" className="chip" onClick={() => demo('admin@crm.com', 'Admin@123')}>Admin</button>
            <button type="button" className="chip" onClick={() => demo('priya@crm.com', 'Sales@123')}>Sales employee</button>
          </div>
        </div>
      </form>
    </div>
  );
}
