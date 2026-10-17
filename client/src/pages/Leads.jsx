import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api, { errMsg, useFetch } from '../api';
import { useAuth } from '../auth.jsx';
import { LeadForm, LostModal } from '../components.jsx';
import { Avatar, Empty, ErrorBox, Icon, SOURCES, STAGES, STAGE_COLOR, Skeleton, StageBadge, fmtDate, inrShort, isOverdue, useToast } from '../ui.jsx';

export default function Leads() {
  const { isAdmin } = useAuth();
  const nav = useNavigate();
  const toast = useToast();
  const [sp] = useSearchParams();
  const [view, setView] = useState('table');
  const [q, setQ] = useState('');
  const [f, setF] = useState({ search: '', stage: '', assignedTo: sp.get('assigned') || '', source: '', due: '', page: 1 });
  const [form, setForm] = useState(false);
  const [lost, setLost] = useState(null);

  useEffect(() => { const t = setTimeout(() => setF((s) => ({ ...s, search: q, page: 1 })), 300); return () => clearTimeout(t); }, [q]);
  const params = view === 'table' ? { ...f, limit: 10 } : { search: f.search, assignedTo: f.assignedTo, source: f.source, limit: 200 };
  const { data, loading, error, reload } = useFetch('/leads', params);
  const users = useFetch(isAdmin ? '/users/assignable' : null);
  const setFilter = (k) => (e) => setF({ ...f, [k]: e.target.value, page: 1 });

  const move = async (id, stage, lostReason) => {
    try { await api.patch(`/leads/${id}/stage`, { stage, lostReason }); toast(`Moved to ${stage}`); reload(); }
    catch (e) { toast(errMsg(e), 'err'); }
  };
  const drop = (stage) => (e) => {
    e.preventDefault();
    const id = e.dataTransfer.getData('lead');
    const lead = data.items.find((l) => l._id === id);
    if (!lead || lead.stage === stage) return;
    if (stage === 'Booked') return toast('Book a unit from the lead page to mark it Booked', 'err');
    if (stage === 'Lost') return setLost(id);
    move(id, stage);
  };

  return (
    <>
      <div className="page-head">
        <div><h1 className="title">{isAdmin ? 'Leads' : 'My leads'}</h1><p className="muted">{data ? `${data.total} lead${data.total === 1 ? '' : 's'}` : ' '}</p></div>
        <div className="head-actions">
          <div className="toggle"><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button><button className={view === 'board' ? 'on' : ''} onClick={() => setView('board')}>Pipeline</button></div>
          <button className="btn primary" onClick={() => setForm(true)}><Icon name="plus" size={16} /> New lead</button>
        </div>
      </div>

      <div className="filters">
        <div className="search"><Icon name="search" size={16} /><input placeholder="Search name, phone or email" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        {view === 'table' && <select value={f.stage} onChange={setFilter('stage')}><option value="">All stages</option>{STAGES.map((s) => <option key={s}>{s}</option>)}</select>}
        <select value={f.source} onChange={setFilter('source')}><option value="">All sources</option>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select>
        {isAdmin && <select value={f.assignedTo} onChange={setFilter('assignedTo')}><option value="">Everyone</option><option value="unassigned">Unassigned</option>{users.data?.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select>}
        {view === 'table' && <label className="check"><input type="checkbox" checked={f.due === 'today'} onChange={(e) => setF({ ...f, due: e.target.checked ? 'today' : '', page: 1 })} /> Follow-up due</label>}
      </div>

      {error ? <ErrorBox message={error} onRetry={reload} /> : loading && !data ? <Skeleton rows={8} /> : data.items.length === 0 ? (
        <Empty title="No leads found" hint="Try different filters, or add your first lead." action={<button className="btn primary" onClick={() => setForm(true)}>New lead</button>} />
      ) : view === 'table' ? (
        <>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lead</th><th>Stage</th><th>Assigned to</th><th>Budget</th><th>Follow-up</th><th>Source</th></tr></thead>
              <tbody>
                {data.items.map((l) => (
                  <tr key={l._id} onClick={() => nav(`/leads/${l._id}`)}>
                    <td><strong>{l.name}</strong><small>{l.phone}</small></td>
                    <td><StageBadge stage={l.stage} /></td>
                    <td>{l.assignedTo ? <span className="who"><Avatar name={l.assignedTo.name} size={24} />{l.assignedTo.name}</span> : <span className="muted">Unassigned</span>}</td>
                    <td>{inrShort(l.budget)}</td>
                    <td className={isOverdue(l.nextFollowUp, l.stage) ? 'late' : ''}>{fmtDate(l.nextFollowUp)}</td>
                    <td>{l.source}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="pager">
            <button className="btn" disabled={data.page <= 1} onClick={() => setF({ ...f, page: f.page - 1 })}>Previous</button>
            <span>Page {data.page} of {data.pages}</span>
            <button className="btn" disabled={data.page >= data.pages} onClick={() => setF({ ...f, page: f.page + 1 })}>Next</button>
          </div>
        </>
      ) : (
        <div className="board">
          {STAGES.map((s) => {
            const items = data.items.filter((l) => l.stage === s);
            return (
              <div key={s} className="col" onDragOver={(e) => e.preventDefault()} onDrop={drop(s)}>
                <div className="col-head" style={{ '--c': STAGE_COLOR[s] }}><i />{s}<b>{items.length}</b></div>
                {items.map((l) => (
                  <div key={l._id} className="kcard" draggable onDragStart={(e) => e.dataTransfer.setData('lead', l._id)} onClick={() => nav(`/leads/${l._id}`)}>
                    <strong>{l.name}</strong>
                    <small>{inrShort(l.budget)} · {l.source}</small>
                    <div className="kfoot">
                      <span className={isOverdue(l.nextFollowUp, l.stage) ? 'late' : ''}>{l.nextFollowUp ? fmtDate(l.nextFollowUp) : ''}</span>
                      {l.assignedTo && <Avatar name={l.assignedTo.name} size={22} />}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}

      {form && <LeadForm onClose={() => setForm(false)} onSaved={() => { setForm(false); reload(); }} />}
      {lost && <LostModal onClose={() => setLost(null)} onConfirm={(r) => { move(lost, 'Lost', r); setLost(null); }} />}
    </>
  );
}
