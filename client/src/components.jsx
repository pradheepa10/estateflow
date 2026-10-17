import { useEffect, useState } from 'react';
import api, { errMsg, fieldErrors, useFetch } from './api';
import { Field, Modal, SOURCES, inr, toInput, useToast } from './ui.jsx';
import { useAuth } from './auth.jsx';

export function LostModal({ onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  return (
    <Modal title="Why was this lead lost?" onClose={onClose}>
      <p className="muted">A reason helps the team learn from lost deals.</p>
      <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Budget too low" autoFocus /></Field>
      <div className="actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn danger" disabled={reason.trim().length < 3} onClick={() => onConfirm(reason.trim())}>Mark as lost</button>
      </div>
    </Modal>
  );
}

export function LeadForm({ lead, onClose, onSaved }) {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const users = useFetch(isAdmin && !lead ? '/users/assignable' : null);
  const [f, setF] = useState({
    name: lead?.name || '', phone: lead?.phone || '', email: lead?.email || '', source: lead?.source || 'Website',
    budget: lead?.budget ?? '', assignedTo: '', nextFollowUp: toInput(lead?.nextFollowUp),
  });
  const [errs, setErrs] = useState({});
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErrs({});
    try {
      const body = { ...f };
      if (!body.assignedTo) delete body.assignedTo;
      const { data } = lead ? await api.patch(`/leads/${lead._id}`, body) : await api.post('/leads', body);
      toast(lead ? 'Lead updated' : 'Lead created');
      onSaved(data);
    } catch (err) {
      const fe = fieldErrors(err);
      setErrs(fe);
      if (!Object.keys(fe).length) toast(errMsg(err), 'err');
    } finally { setBusy(false); }
  };

  return (
    <Modal title={lead ? 'Edit lead' : 'New lead'} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid2">
          <Field label="Full name" error={errs.name}><input value={f.name} onChange={set('name')} autoFocus /></Field>
          <Field label="Phone" error={errs.phone}><input value={f.phone} onChange={set('phone')} inputMode="tel" /></Field>
          <Field label="Email" error={errs.email}><input value={f.email} onChange={set('email')} /></Field>
          <Field label="Source"><select value={f.source} onChange={set('source')}>{SOURCES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="Budget (₹)" error={errs.budget}><input type="number" min="0" value={f.budget} onChange={set('budget')} /></Field>
          <Field label="Next follow-up"><input type="date" value={f.nextFollowUp} onChange={set('nextFollowUp')} /></Field>
          {isAdmin && !lead && (
            <Field label="Assign to">
              <select value={f.assignedTo} onChange={set('assignedTo')}><option value="">Me</option>{users.data?.map((u) => <option key={u._id} value={u._id}>{u.name}</option>)}</select>
            </Field>
          )}
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy}>{busy ? 'Saving...' : lead ? 'Save changes' : 'Create lead'}</button>
        </div>
      </form>
    </Modal>
  );
}

// Books a unit for a lead. Pass `lead` and/or `unit` when already known.
export function BookModal({ lead, unit, onClose, onDone }) {
  const toast = useToast();
  const [leadId, setLeadId] = useState(lead?._id || '');
  const [unitId, setUnitId] = useState(unit?._id || '');
  const [type, setType] = useState('');
  const [amount, setAmount] = useState(unit?.price || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const leads = useFetch(lead ? null : '/leads', { limit: 200 });
  const units = useFetch(unit ? null : '/units', { status: 'Available', type });
  const chosen = unit || units.data?.find((u) => u._id === unitId);

  useEffect(() => { if (chosen && !unit) setAmount(chosen.price); }, [unitId]); // eslint-disable-line

  const submit = async () => {
    setBusy(true); setError('');
    try {
      await api.post('/bookings', { leadId, unitId: unit?._id || unitId, amount });
      toast('Unit booked');
      onDone();
    } catch (e) {
      setError(errMsg(e));
      if (e.response?.status === 409) { setUnitId(''); units.reload(); }
    } finally { setBusy(false); }
  };

  return (
    <Modal title="Book a unit" onClose={onClose} wide>
      {lead ? <p>Lead: <strong>{lead.name}</strong></p> : (
        <Field label="Lead">
          <select value={leadId} onChange={(e) => setLeadId(e.target.value)}>
            <option value="">Choose a lead</option>
            {leads.data?.items.filter((l) => l.stage !== 'Lost').map((l) => <option key={l._id} value={l._id}>{l.name} - {l.phone}</option>)}
          </select>
        </Field>
      )}
      {unit ? (
        <p>Unit: <strong>{unit.project?.name} / {unit.building?.name} / {unit.unitNumber}</strong> ({unit.type})</p>
      ) : (
        <>
          <Field label="Unit type">
            <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{['1BHK', '2BHK', '3BHK', 'Villa', 'Shop'].map((t) => <option key={t}>{t}</option>)}</select>
          </Field>
          <Field label="Available unit">
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              <option value="">{units.loading ? 'Loading units...' : 'Choose a unit'}</option>
              {units.data?.map((u) => <option key={u._id} value={u._id}>{u.project?.name} / {u.building?.name} / {u.unitNumber} - {u.type} - {inr(u.price)}</option>)}
            </select>
          </Field>
        </>
      )}
      <Field label="Booking amount (₹)"><input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} /></Field>
      {error && <div className="form-error" role="alert">{error}</div>}
      <div className="actions">
        <button className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy || !leadId || !(unit || unitId)} onClick={submit}>{busy ? 'Booking...' : 'Confirm booking'}</button>
      </div>
    </Modal>
  );
}
