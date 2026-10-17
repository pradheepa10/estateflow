import { useState } from 'react';
import api, { errMsg, fieldErrors, useFetch } from '../api';
import { useAuth } from '../auth.jsx';
import { Avatar, ErrorBox, Field, Icon, Modal, Skeleton, useToast } from '../ui.jsx';

export default function Team() {
  const { user } = useAuth();
  const toast = useToast();
  const { data, loading, error, reload } = useFetch('/users');
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', email: '', password: '', role: 'sales' });
  const [errs, setErrs] = useState({});

  const create = async (e) => {
    e.preventDefault(); setErrs({});
    try { await api.post('/users', f); toast('Team member added'); setOpen(false); setF({ name: '', email: '', password: '', role: 'sales' }); reload(); }
    catch (err) { const fe = fieldErrors(err); setErrs(fe); if (!Object.keys(fe).length) toast(errMsg(err), 'err'); }
  };
  const toggle = async (u) => {
    try { await api.patch(`/users/${u._id}`, { active: !u.active }); reload(); } catch (e) { toast(errMsg(e), 'err'); }
  };

  return (
    <>
      <div className="page-head"><div><h1 className="title">Team</h1><p className="muted">Admins and sales employees</p></div>
        <button className="btn primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} /> Add member</button></div>
      {error ? <ErrorBox message={error} onRetry={reload} /> : loading && !data ? <Skeleton /> : (
        <div className="table-wrap"><table>
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Status</th><th /></tr></thead>
          <tbody>{data.map((u) => (
            <tr key={u._id} className="static">
              <td><span className="who"><Avatar name={u.name} />{u.name}</span></td><td>{u.email}</td>
              <td>{u.role === 'admin' ? 'Admin' : 'Sales employee'}</td>
              <td><span className={'pill ' + (u.active ? 'active' : 'cancelled')}>{u.active ? 'Active' : 'Deactivated'}</span></td>
              <td>{u._id !== user._id && <button className="btn ghost" onClick={() => toggle(u)}>{u.active ? 'Deactivate' : 'Activate'}</button>}</td>
            </tr>))}</tbody>
        </table></div>
      )}
      {open && (
        <Modal title="Add team member" onClose={() => setOpen(false)}>
          <form onSubmit={create}>
            <div className="grid2">
              <Field label="Name" error={errs.name}><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus /></Field>
              <Field label="Email" error={errs.email}><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
              <Field label="Temporary password" error={errs.password}><input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
              <Field label="Role"><select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="sales">Sales employee</option><option value="admin">Admin</option></select></Field>
            </div>
            <div className="actions"><button type="button" className="btn" onClick={() => setOpen(false)}>Cancel</button><button className="btn primary">Add member</button></div>
          </form>
        </Modal>
      )}
    </>
  );
}
