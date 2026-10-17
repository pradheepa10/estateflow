import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api, { errMsg, useFetch } from '../api';
import { useAuth } from '../auth.jsx';
import { BookModal, LeadForm, LostModal } from '../components.jsx';
import { Avatar, ErrorBox, STAGES, STAGE_COLOR, Skeleton, StageBadge, fmtDateTime, inr, inrShort, toInput, useToast } from '../ui.jsx';

export default function LeadDetail() {
  const { id } = useParams();
  const { isAdmin } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch(`/leads/${id}`);
  const users = useFetch(isAdmin ? '/users/assignable' : null);
  const [tab, setTab] = useState('notes');
  const [edit, setEdit] = useState(false);
  const [book, setBook] = useState(false);
  const [lost, setLost] = useState(false);
  const [note, setNote] = useState('');
  const [follow, setFollow] = useState('');

  if (loading && !data) return <Skeleton rows={10} />;
  if (error) return <ErrorBox message={error} onRetry={reload} />;
  const { lead, activity, bookings } = data;
  const act = async (fn, ok) => { try { await fn(); if (ok) toast(ok); reload(); } catch (e) { toast(errMsg(e), 'err'); } };

  const setStage = (stage, lostReason) => act(() => api.patch(`/leads/${id}/stage`, { stage, lostReason }), `Moved to ${stage}`);
  const addNote = (e) => {
    e.preventDefault();
    act(async () => { await api.post(`/leads/${id}/notes`, { text: note, nextFollowUp: follow || undefined }); setNote(''); setFollow(''); }, 'Note added');
  };
  const activeBookings = bookings.filter((b) => b.status === 'Active');

  return (
    <>
      <p className="crumb"><Link to="/leads">Leads</Link> / {lead.name}</p>
      <div className="page-head">
        <div><h1 className="title">{lead.name}</h1><p className="muted">{lead.phone}{lead.email ? ` · ${lead.email}` : ''} · {lead.source}</p></div>
        <div className="head-actions">
          <button className="btn" onClick={() => setEdit(true)}>Edit</button>
          {lead.stage !== 'Lost' && <button className="btn primary" onClick={() => setBook(true)}>Book a unit</button>}
        </div>
      </div>

      <div className="stepper" role="group" aria-label="Lead stage">
        {STAGES.map((s) => (
          <button key={s} className={'step' + (lead.stage === s ? ' on' : '')} style={{ '--c': STAGE_COLOR[s] }}
            disabled={s === 'Booked' && lead.stage !== 'Booked'}
            title={s === 'Booked' ? 'Use "Book a unit" to mark a lead as Booked' : undefined}
            onClick={() => (s === 'Lost' ? setLost(true) : setStage(s))}>{s}</button>
        ))}
      </div>
      {lead.stage === 'Lost' && lead.lostReason && <p className="muted">Lost reason: {lead.lostReason}</p>}

      <div className="detail">
        <aside className="card">
          <h3>Details</h3>
          <dl className="dl">
            <dt>Stage</dt><dd><StageBadge stage={lead.stage} /></dd>
            <dt>Budget</dt><dd>{inrShort(lead.budget)}</dd>
            <dt>Next follow-up</dt>
            <dd><input type="date" value={toInput(lead.nextFollowUp)} onChange={(e) => act(() => api.patch(`/leads/${id}`, { nextFollowUp: e.target.value }), 'Follow-up saved')} /></dd>
            <dt>Assigned to</dt>
            <dd>{isAdmin ? (
              <select value={lead.assignedTo?._id || ''} onChange={(e) => act(() => api.patch(`/leads/${id}/assign`, { assignedTo: e.target.value }), 'Lead reassigned')}>
                <option value="" disabled>Unassigned</option>{users.data?.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}
              </select>
            ) : <span className="who"><Avatar name={lead.assignedTo?.name} size={24} />{lead.assignedTo?.name}</span>}</dd>
            <dt>Created</dt><dd>{fmtDateTime(lead.createdAt)}</dd>
          </dl>
        </aside>

        <section className="card">
          <div className="tabs">{['notes', 'timeline', 'bookings'].map((t) => <button key={t} className={tab === t ? 'on' : ''} onClick={() => setTab(t)}>{t[0].toUpperCase() + t.slice(1)}{t === 'bookings' && activeBookings.length ? ` (${activeBookings.length})` : ''}</button>)}</div>

          {tab === 'notes' && (
            <>
              <form onSubmit={addNote} className="note-form">
                <textarea rows="3" placeholder="What did you discuss? What happens next?" value={note} onChange={(e) => setNote(e.target.value)} />
                <div className="note-actions"><label>Follow-up on <input type="date" value={follow} onChange={(e) => setFollow(e.target.value)} /></label>
                  <button className="btn primary" disabled={!note.trim()}>Add note</button></div>
              </form>
              {lead.notes.length === 0 ? <p className="muted pad">No notes yet. Write down what you learn on every call.</p> :
                [...lead.notes].reverse().map((n) => <div key={n._id} className="note"><p>{n.text}</p><small>{n.by?.name} · {fmtDateTime(n.at)}</small></div>)}
            </>
          )}

          {tab === 'timeline' && activity.map((a) => <div key={a._id} className="feed"><span className="dot" /><div><p>{a.message}</p><small>{a.user?.name} · {fmtDateTime(a.at)}</small></div></div>)}

          {tab === 'bookings' && (bookings.length === 0 ? <p className="muted pad">No bookings for this lead yet.</p> : bookings.map((b) => (
            <div key={b._id} className="row-link static"><div><strong>{b.unit?.project?.name} / {b.unit?.building?.name} / {b.unit?.unitNumber}</strong><small>{b.unit?.type} · {fmtDateTime(b.createdAt)}</small></div>
              <div className="right"><b>{inr(b.amount)}</b><span className={'pill ' + b.status.toLowerCase()}>{b.status}</span></div></div>
          )))}
        </section>
      </div>

      {edit && <LeadForm lead={lead} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); reload(); }} />}
      {book && <BookModal lead={lead} onClose={() => setBook(false)} onDone={() => { setBook(false); reload(); }} />}
      {lost && <LostModal onClose={() => setLost(false)} onConfirm={(r) => { setLost(false); setStage('Lost', r); }} />}
    </>
  );
}
