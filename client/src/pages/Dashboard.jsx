import { Link } from 'react-router-dom';
import { useAuth } from '../auth.jsx';
import { useFetch } from '../api';
import { Avatar, ErrorBox, Skeleton, STAGES, STAGE_COLOR, StageBadge, fmtDate, fmtDateTime, inrShort } from '../ui.jsx';

const Stat = ({ label, value, sub, tone }) => (
  <div className={'stat ' + (tone || '')}><small>{label}</small><strong>{value}</strong>{sub && <span>{sub}</span>}</div>
);
const todayStart = () => new Date(new Date().setHours(0, 0, 0, 0));

function Pipeline({ stageCount, title }) {
  const max = Math.max(1, ...Object.values(stageCount));
  return (
    <section className="card"><h3>{title}</h3>
      {STAGES.map((s) => (
        <Link to="/leads" key={s} className="bar-row"><span>{s}</span>
          <div className="bar"><i style={{ width: `${((stageCount[s] || 0) / max) * 100}%`, background: STAGE_COLOR[s] }} /></div><b>{stageCount[s] || 0}</b></Link>
      ))}
    </section>
  );
}

function Inventory({ units, link }) {
  const total = (units.Available || 0) + (units.Booked || 0) + (units.Held || 0) || 1;
  return (
    <section className="card"><h3>Inventory</h3>
      <div className="seg"><i style={{ flex: units.Available || 0, background: '#2f7d57' }} /><i style={{ flex: units.Held || 0, background: '#b98a3e' }} /><i style={{ flex: units.Booked || 0, background: '#9aa7a4' }} /></div>
      <ul className="legend">
        <li><i style={{ background: '#2f7d57' }} />Available <b>{units.Available || 0}</b></li>
        <li><i style={{ background: '#b98a3e' }} />On hold <b>{units.Held || 0}</b></li>
        <li><i style={{ background: '#9aa7a4' }} />Booked <b>{units.Booked || 0}</b></li>
      </ul>
      <p className="muted">{Math.round(((units.Booked || 0) / total) * 100)}% of all units are booked.</p>
      {link && <p style={{ marginTop: 8 }}><Link to="/properties">Browse available units</Link></p>}
    </section>
  );
}

function Activity({ items }) {
  return (
    <section className="card"><h3>Recent activity</h3>
      {items.length === 0 ? <p className="muted pad">Activity will show here.</p> : items.map((a) => (
        <div key={a._id} className="feed"><span className="dot" /><div>
          <p>{a.message}{a.lead && <> · <Link to={`/leads/${a.lead._id}`}>{a.lead.name}</Link></>}</p>
          <small>{a.user?.name} · {fmtDateTime(a.at)}</small></div></div>
      ))}
    </section>
  );
}

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const { data, loading, error, reload } = useFetch('/dashboard');
  if (loading) return <><h1 className="title">{isAdmin ? 'Command center' : 'My day'}</h1><div className="stats"><Skeleton rows={2} /><Skeleton rows={2} /><Skeleton rows={2} /></div><Skeleton rows={8} /></>;
  if (error) return <ErrorBox message={error} onRetry={reload} />;

  const { totals: t, byStage, bySource, units, dueList, activity, leaderboard } = data;
  const stageCount = Object.fromEntries(byStage.map((s) => [s._id, s.count]));
  const maxSrc = Math.max(1, ...bySource.map((s) => s.count));
  const first = user.name.split(' ')[0];

  /* ---------------- SALES: a personal daily workspace ---------------- */
  if (!isAdmin) {
    const due = t.dueToday + t.overdue;
    return (
      <>
        <section className="card hero">
          <div>
            <h2>{due === 0 ? `You're all caught up, ${first}` : `${due} follow-up${due > 1 ? 's' : ''} to do, ${first}`}</h2>
            <p>{t.overdue > 0 ? `${t.overdue} overdue. Start with those.` : due ? 'Nothing overdue. Work through today\'s list.' : 'No follow-ups due. A good time to add new leads.'}</p>
          </div>
          <Link to="/leads" className="btn primary">View my leads</Link>
        </section>

        <div className="stats">
          <Stat label="My leads" value={t.leads} sub={`${t.newThisWeek} new this week`} />
          <Stat label="Due today" value={t.dueToday} sub={`${t.overdue} overdue`} tone={t.overdue ? 'warn' : ''} />
          <Stat label="My bookings" value={t.activeBookings} sub={`${t.bookingsThisMonth} this month`} />
          <Stat label="My booked value" value={inrShort(t.revenue)} />
        </div>

        <div className="cols">
          <section className="card span2">
            <h3>Today's follow-ups</h3>
            {dueList.length === 0 ? <p className="muted pad">Nothing due. Your follow-ups are up to date.</p> : dueList.map((l) => (
              <div key={l._id} className="call-row">
                <Link to={`/leads/${l._id}`}><strong>{l.name}</strong><small>{l.phone}</small></Link>
                <div className="who">
                  <StageBadge stage={l.stage} />
                  <small className={new Date(l.nextFollowUp) < todayStart() ? 'late' : ''}>{new Date(l.nextFollowUp) < todayStart() ? 'Overdue · ' : ''}{fmtDate(l.nextFollowUp)}</small>
                  <a className="btn small" href={`tel:${l.phone}`}>Call</a>
                </div>
              </div>
            ))}
          </section>
          <Pipeline stageCount={stageCount} title="My pipeline" />
          <Inventory units={units} link />
          <Activity items={activity} />
        </div>
      </>
    );
  }

  /* ---------------- ADMIN: team-wide command center ---------------- */
  return (
    <>
      <div className="page-head"><div><h1 className="title">Command center</h1><p className="muted">Company-wide numbers, team performance and inventory</p></div></div>

      {t.unassigned > 0 && (
        <div className="banner" role="alert">
          <span><strong>{t.unassigned} open lead{t.unassigned > 1 ? 's have' : ' has'} no owner.</strong> Assign them so nobody is missed.</span>
          <Link to="/leads?assigned=unassigned" className="btn small">Review unassigned</Link>
        </div>
      )}

      <div className="stats">
        <Stat label="Total leads" value={t.leads} sub={`${t.newThisWeek} new this week`} />
        <Stat label="Overdue follow-ups" value={t.overdue} sub={`${t.dueToday} more due today`} tone={t.overdue ? 'warn' : ''} />
        <Stat label="Active bookings" value={t.activeBookings} sub={`${t.bookingsThisMonth} this month`} />
        <Stat label="Booked value" value={inrShort(t.revenue)} />
      </div>

      <div className="cols">
        <section className="card">
          <h3>Team performance</h3>
          {leaderboard.length === 0 ? <p className="muted pad">No bookings yet.</p> : leaderboard.map((p) => (
            <div key={p._id} className="row-link static"><div className="who"><Avatar name={p.name} /><div><strong>{p.name}</strong><small>{p.bookings} booking{p.bookings > 1 ? 's' : ''}</small></div></div><b>{inrShort(p.revenue)}</b></div>
          ))}
        </section>

        <section className="card">
          <h3>Follow-ups across the team</h3>
          {dueList.length === 0 ? <p className="muted pad">Nothing due. The team is on track.</p> : dueList.map((l) => (
            <Link key={l._id} to={`/leads/${l._id}`} className="row-link">
              <div><strong>{l.name}</strong><small>{l.assignedTo ? l.assignedTo.name : 'Unassigned'} · {l.phone}</small></div>
              <div className="right"><StageBadge stage={l.stage} /><small className={new Date(l.nextFollowUp) < todayStart() ? 'late' : ''}>{fmtDate(l.nextFollowUp)}</small></div>
            </Link>
          ))}
        </section>

        <Pipeline stageCount={stageCount} title="Company pipeline" />
        <Inventory units={units} />

        <section className="card">
          <h3>Where leads come from</h3>
          {bySource.map((s) => (
            <div key={s._id} className="bar-row"><span>{s._id}</span><div className="bar"><i style={{ width: `${(s.count / maxSrc) * 100}%`, background: 'var(--forest2)' }} /></div><b>{s.count}</b></div>
          ))}
        </section>
        <Activity items={activity} />
      </div>
    </>
  );
}
