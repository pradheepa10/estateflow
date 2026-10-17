import { useState } from 'react';
import api, { errMsg, fieldErrors, useFetch } from '../api';
import { useAuth } from '../auth.jsx';
import { BookModal } from '../components.jsx';
import { Empty, ErrorBox, Field, Icon, Modal, Skeleton, UNIT_TYPES, inr, inrShort, useToast } from '../ui.jsx';

function SimpleForm({ title, fields, url, extra, onClose, onSaved }) {
  const toast = useToast();
  const [f, setF] = useState(Object.fromEntries(fields.map((x) => [x.k, x.def ?? ''])));
  const [errs, setErrs] = useState({});
  const submit = async (e) => {
    e.preventDefault(); setErrs({});
    try { await api.post(url, { ...extra, ...f }); toast('Saved'); onSaved(); }
    catch (err) { const fe = fieldErrors(err); setErrs(fe); if (!Object.keys(fe).length) toast(errMsg(err), 'err'); }
  };
  return (
    <Modal title={title} onClose={onClose}>
      <form onSubmit={submit}>
        <div className="grid2">
          {fields.map((x) => (
            <Field key={x.k} label={x.label} error={errs[x.k]}>
              {x.options ? <select value={f[x.k]} onChange={(e) => setF({ ...f, [x.k]: e.target.value })}>{x.options.map((o) => <option key={o}>{o}</option>)}</select>
                : <input type={x.type || 'text'} value={f[x.k]} onChange={(e) => setF({ ...f, [x.k]: e.target.value })} />}
            </Field>
          ))}
        </div>
        <div className="actions"><button type="button" className="btn" onClick={onClose}>Cancel</button><button className="btn primary">Save</button></div>
      </form>
    </Modal>
  );
}

function UnitModal({ unit, isAdmin, onClose, onChanged }) {
  const toast = useToast();
  const [price, setPrice] = useState(unit.price);
  const [book, setBook] = useState(false);
  const save = async (body) => {
    try { await api.patch(`/units/${unit._id}`, body); toast('Unit updated'); onChanged(); }
    catch (e) { toast(errMsg(e), 'err'); }
  };
  if (book) return <BookModal unit={unit} onClose={() => setBook(false)} onDone={() => { setBook(false); onChanged(); }} />;
  return (
    <Modal title={`Unit ${unit.unitNumber}`} onClose={onClose}>
      <dl className="dl">
        <dt>Tower</dt><dd>{unit.building?.name}</dd><dt>Type</dt><dd>{unit.type}</dd><dt>Floor</dt><dd>{unit.floor}</dd>
        <dt>Area</dt><dd>{unit.areaSqft} sq ft</dd><dt>Price</dt><dd>{inr(unit.price)}</dd><dt>Status</dt><dd><span className={'pill ' + unit.status.toLowerCase()}>{unit.status}</span></dd>
      </dl>
      {isAdmin && unit.status !== 'Booked' && (
        <div className="inline-edit">
          <input type="number" value={price} onChange={(e) => setPrice(e.target.value)} />
          <button className="btn" onClick={() => save({ price })}>Update price</button>
          <button className="btn" onClick={() => save({ status: unit.status === 'Held' ? 'Available' : 'Held' })}>{unit.status === 'Held' ? 'Release hold' : 'Put on hold'}</button>
        </div>
      )}
      <div className="actions"><button className="btn" onClick={onClose}>Close</button>
        {unit.status === 'Available' && <button className="btn primary" onClick={() => setBook(true)}>Book this unit</button>}</div>
    </Modal>
  );
}

export default function Properties() {
  const { isAdmin } = useAuth();
  const projects = useFetch('/projects');
  const [pid, setPid] = useState('');
  const [bid, setBid] = useState('');
  const [type, setType] = useState('');
  const [status, setStatus] = useState('');
  const [modal, setModal] = useState(null);
  const [unit, setUnit] = useState(null);

  const project = projects.data?.find((p) => p._id === pid) || projects.data?.[0];
  const building = project?.buildings.find((b) => b._id === bid) || project?.buildings[0];
  const units = useFetch(building ? '/units' : null, { building: building?._id, type, status });
  const refresh = () => { projects.reload(); units.reload(); };

  if (projects.loading && !projects.data) return <Skeleton rows={8} />;
  if (projects.error) return <ErrorBox message={projects.error} onRetry={projects.reload} />;

  const floors = {};
  units.data?.forEach((u) => (floors[u.floor] ||= []).push(u));

  return (
    <>
      <div className="page-head">
        <div><h1 className="title">{isAdmin ? 'Properties' : 'Inventory'}</h1><p className="muted">{isAdmin ? 'Manage projects, buildings and units' : 'Browse available units and book for your leads'}</p></div>
        {isAdmin && <div className="head-actions">
          <button className="btn" onClick={() => setModal('project')}><Icon name="plus" size={16} /> Project</button>
          {project && <button className="btn" onClick={() => setModal('building')}><Icon name="plus" size={16} /> Building</button>}
          {building && <button className="btn primary" onClick={() => setModal('units')}><Icon name="plus" size={16} /> Add units</button>}
        </div>}
      </div>

      {!project ? <Empty title="No projects yet" hint={isAdmin ? 'Create a project to start adding buildings and units.' : 'An admin needs to add projects first.'} /> : (
        <>
          <div className="tabs big">{projects.data.map((p) => <button key={p._id} className={p._id === project._id ? 'on' : ''} onClick={() => { setPid(p._id); setBid(''); }}>{p.name}<small>{p.location}</small></button>)}</div>
          <div className="filters">
            <select value={building?._id || ''} onChange={(e) => setBid(e.target.value)}>
              {project.buildings.map((b) => <option key={b._id} value={b._id}>{b.name} ({b.stats.Available || 0} available)</option>)}
              {project.buildings.length === 0 && <option>No buildings</option>}
            </select>
            <select value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{UNIT_TYPES.map((t) => <option key={t}>{t}</option>)}</select>
            <select value={status} onChange={(e) => setStatus(e.target.value)}><option value="">Any status</option><option>Available</option><option>Held</option><option>Booked</option></select>
            <ul className="legend inline"><li><i className="k avail" />Available</li><li><i className="k held" />On hold</li><li><i className="k booked" />Booked</li></ul>
          </div>

          {!building ? <Empty title="No buildings in this project" /> : units.error ? <ErrorBox message={units.error} onRetry={units.reload} /> :
            units.loading && !units.data ? <Skeleton rows={6} /> : units.data?.length === 0 ? <Empty title="No units match" hint="Change the filters or add units to this building." /> : (
              <div className="floors">
                {Object.keys(floors).sort((a, b) => b - a).map((fl) => (
                  <div key={fl} className="floor"><span className="floor-label">Floor {fl}</span>
                    <div className="units">{floors[fl].map((u) => (
                      <button key={u._id} className={'unit ' + u.status.toLowerCase()} onClick={() => setUnit(u)} aria-label={`Unit ${u.unitNumber}, ${u.status}`}>
                        <b>{u.unitNumber}</b><span>{u.type}</span><small>{inrShort(u.price)}</small>
                      </button>))}</div></div>
                ))}
              </div>
            )}
        </>
      )}

      {modal === 'project' && <SimpleForm title="New project" url="/projects" onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }}
        fields={[{ k: 'name', label: 'Name' }, { k: 'location', label: 'Location' }, { k: 'description', label: 'Description' }]} />}
      {modal === 'building' && <SimpleForm title={`New building in ${project.name}`} url="/buildings" extra={{ project: project._id }} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }}
        fields={[{ k: 'name', label: 'Building name' }]} />}
      {modal === 'units' && <SimpleForm title={`Add units to ${building.name}`} url="/units/bulk" extra={{ building: building._id }} onClose={() => setModal(null)} onSaved={() => { setModal(null); refresh(); }}
        fields={[{ k: 'floors', label: 'Number of floors', type: 'number', def: 1 }, { k: 'startFloor', label: 'Starting floor', type: 'number', def: 1 }, { k: 'perFloor', label: 'Units per floor', type: 'number', def: 4 },
          { k: 'type', label: 'Type', options: UNIT_TYPES, def: '2BHK' }, { k: 'areaSqft', label: 'Area (sq ft)', type: 'number' }, { k: 'price', label: 'Price per unit (₹)', type: 'number' }]} />}
      {unit && <UnitModal unit={unit} isAdmin={isAdmin} onClose={() => setUnit(null)} onChanged={() => { setUnit(null); refresh(); }} />}
    </>
  );
}
