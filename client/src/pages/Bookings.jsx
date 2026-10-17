import { useState } from 'react';
import { Link } from 'react-router-dom';
import api, { errMsg, useFetch } from '../api';
import { useAuth } from '../auth.jsx';
import { Empty, ErrorBox, Field, Modal, Skeleton, fmtDateTime, inr, useToast } from '../ui.jsx';

export default function Bookings() {
  const { isAdmin } = useAuth();
  const toast = useToast();
  const [status, setStatus] = useState('');
  const { data, loading, error, reload } = useFetch('/bookings', { status });
  const [cancel, setCancel] = useState(null);
  const [reason, setReason] = useState('');

  const doCancel = async () => {
    try { await api.patch(`/bookings/${cancel._id}/cancel`, { reason }); toast('Booking cancelled. The unit is available again'); setCancel(null); setReason(''); reload(); }
    catch (e) { toast(errMsg(e), 'err'); }
  };

  return (
    <>
      <div className="page-head"><div><h1 className="title">{isAdmin ? 'Bookings' : 'My bookings'}</h1><p className="muted">{isAdmin ? 'All bookings' : 'Bookings you made'}</p></div></div>
      <div className="filters"><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">All</option><option>Active</option><option>Cancelled</option></select></div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading && !data ? <Skeleton rows={6} /> : data.length === 0 ? (
        <Empty title="No bookings yet" hint="Open a lead and choose Book a unit, or pick an available unit in Properties." />
      ) : (
        <div className="table-wrap"><table>
          <thead><tr><th>Lead</th><th>Unit</th><th>Amount</th><th>Booked by</th><th>Date</th><th>Status</th>{isAdmin && <th />}</tr></thead>
          <tbody>{data.map((b) => (
            <tr key={b._id} className="static">
              <td><Link to={`/leads/${b.lead?._id}`}><strong>{b.lead?.name}</strong></Link><small>{b.lead?.phone}</small></td>
              <td>{b.unit?.unitNumber}<small>{b.unit?.project?.name} / {b.unit?.building?.name}</small></td>
              <td>{inr(b.amount)}</td><td>{b.bookedBy?.name}</td><td>{fmtDateTime(b.createdAt)}</td>
              <td><span className={'pill ' + b.status.toLowerCase()}>{b.status}</span>{b.cancelReason && <small>{b.cancelReason}</small>}</td>
              {isAdmin && <td>{b.status === 'Active' && <button className="btn danger ghost" onClick={() => setCancel(b)}>Cancel</button>}</td>}
            </tr>))}</tbody>
        </table></div>
      )}
      {cancel && (
        <Modal title="Cancel this booking?" onClose={() => setCancel(null)}>
          <p className="muted">Unit {cancel.unit?.unitNumber} will become available again for other leads.</p>
          <Field label="Reason"><input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus /></Field>
          <div className="actions"><button className="btn" onClick={() => setCancel(null)}>Keep booking</button>
            <button className="btn danger" disabled={reason.trim().length < 3} onClick={doCancel}>Cancel booking</button></div>
        </Modal>
      )}
    </>
  );
}
