const router = require('express').Router();
const { z } = require('zod');
const { Project, Building, Unit, UNIT_TYPES } = require('../models');
const { wrap, httpError, protect, allow, validate } = require('../middleware');

router.use(protect);

// Projects with their buildings and unit stats in one call
router.get('/projects', wrap(async (req, res) => {
  const [projects, buildings, stats] = await Promise.all([
    Project.find().sort('name').lean(),
    Building.find().sort('name').lean(),
    Unit.aggregate([{ $group: { _id: { building: '$building', status: '$status' }, n: { $sum: 1 } } }]),
  ]);
  const byBuilding = {};
  stats.forEach((s) => { (byBuilding[s._id.building] ||= {})[s._id.status] = s.n; });
  res.json(projects.map((p) => ({
    ...p,
    buildings: buildings.filter((b) => String(b.project) === String(p._id)).map((b) => ({ ...b, stats: byBuilding[b._id] || {} })),
  })));
}));

router.post('/projects', allow('admin'), validate(z.object({
  name: z.string().trim().min(2), location: z.string().trim().optional(), description: z.string().trim().optional(),
})), wrap(async (req, res) => res.status(201).json(await Project.create(req.body))));

router.post('/buildings', allow('admin'), validate(z.object({ project: z.string(), name: z.string().trim().min(1) })), wrap(async (req, res) => {
  if (!(await Project.exists({ _id: req.body.project }))) throw httpError(404, 'Project not found');
  res.status(201).json(await Building.create(req.body));
}));

router.get('/units', wrap(async (req, res) => {
  const { project, building, type, status, minPrice, maxPrice } = req.query;
  const f = {};
  if (project) f.project = project;
  if (building) f.building = building;
  if (type) f.type = type;
  if (status) f.status = status;
  if (minPrice || maxPrice) f.price = { ...(minPrice && { $gte: +minPrice }), ...(maxPrice && { $lte: +maxPrice }) };
  const units = await Unit.find(f).sort('floor unitNumber').limit(1000).populate('project', 'name').populate('building', 'name');
  res.json(units);
}));

// Generate many units at once: floors x unitsPerFloor
router.post('/units/bulk', allow('admin'), validate(z.object({
  building: z.string(),
  floors: z.coerce.number().int().min(1).max(60),
  perFloor: z.coerce.number().int().min(1).max(20),
  startFloor: z.coerce.number().int().min(0).max(60).default(1),
  type: z.enum(UNIT_TYPES),
  areaSqft: z.coerce.number().positive(),
  price: z.coerce.number().positive(),
})), wrap(async (req, res) => {
  const b = await Building.findById(req.body.building);
  if (!b) throw httpError(404, 'Building not found');
  const docs = [];
  for (let f = 0; f < req.body.floors; f++) {
    const floor = req.body.startFloor + f;
    for (let i = 1; i <= req.body.perFloor; i++) {
      docs.push({ project: b.project, building: b._id, floor, unitNumber: `${floor}${String(i).padStart(2, '0')}`,
        type: req.body.type, areaSqft: req.body.areaSqft, price: req.body.price });
    }
  }
  try { await Unit.insertMany(docs); }
  catch (e) { if (e.code === 11000) throw httpError(409, 'Some of these unit numbers already exist in this building'); throw e; }
  res.status(201).json({ created: docs.length });
}));

router.patch('/units/:id', allow('admin'), validate(z.object({
  price: z.coerce.number().positive().optional(), type: z.enum(UNIT_TYPES).optional(),
  areaSqft: z.coerce.number().positive().optional(), status: z.enum(['Available', 'Held']).optional(),
})), wrap(async (req, res) => {
  const unit = await Unit.findById(req.params.id);
  if (!unit) throw httpError(404, 'Unit not found');
  if (unit.status === 'Booked') throw httpError(409, 'Booked units cannot be edited. Cancel the booking first');
  Object.assign(unit, req.body);
  await unit.save();
  res.json(unit);
}));

module.exports = router;
