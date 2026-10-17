const router = require('express').Router();
const { z } = require('zod');
const { Lead, User, Activity, Booking, STAGES, SOURCES } = require('../models');
const { wrap, httpError, protect, allow, validate } = require('../middleware');

router.use(protect);

const optNum = z.preprocess((v) => (v === '' || v == null ? undefined : Number(v)), z.number().nonnegative().optional());
const optDate = z.preprocess((v) => (v === '' || v == null ? null : new Date(v)), z.date().nullable().optional());
const leadBody = z.object({
  name: z.string().trim().min(2, 'Enter the full name'),
  phone: z.string().trim().regex(/^[0-9+\-\s]{7,15}$/, 'Enter a valid phone number'),
  email: z.string().trim().email('Enter a valid email').optional().or(z.literal('')),
  source: z.enum(SOURCES).default('Other'),
  budget: optNum,
  assignedTo: z.string().optional().or(z.literal('')),
  nextFollowUp: optDate,
});

const scopeFilter = (user) => (user.role === 'sales' ? { assignedTo: user._id } : {});
const canAccess = (user, lead) => user.role === 'admin' || String(lead.assignedTo) === String(user._id);
const endOfDay = () => { const d = new Date(); d.setHours(23, 59, 59, 999); return d; };
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const log = (lead, user, type, message) => Activity.create({ lead, user, type, message });

async function getLead(req) {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw httpError(404, 'Lead not found');
  if (!canAccess(req.user, lead)) throw httpError(403, 'This lead is assigned to someone else');
  return lead;
}

router.get('/', wrap(async (req, res) => {
  const { search, stage, source, assignedTo, due, sort = '-createdAt' } = req.query;
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(200, parseInt(req.query.limit) || 10);
  const filter = scopeFilter(req.user);
  if (stage) filter.stage = stage;
  if (source) filter.source = source;
  if (assignedTo && req.user.role === 'admin') filter.assignedTo = assignedTo === 'unassigned' ? null : assignedTo;
  if (due === 'today') { filter.nextFollowUp = { $lte: endOfDay() }; filter.stage = { $nin: ['Booked', 'Lost'] }; }
  if (search) { const rx = new RegExp(esc(search), 'i'); filter.$or = [{ name: rx }, { phone: rx }, { email: rx }]; }
  const sortOk = ['createdAt', 'name', 'nextFollowUp', 'budget'].includes(sort.replace('-', '')) ? sort : '-createdAt';
  const [items, total] = await Promise.all([
    Lead.find(filter).select('-notes').populate('assignedTo', 'name').sort(sortOk).skip((page - 1) * limit).limit(limit),
    Lead.countDocuments(filter),
  ]);
  res.json({ items, total, page, pages: Math.max(1, Math.ceil(total / limit)) });
}));

router.post('/', validate(leadBody), wrap(async (req, res) => {
  const body = { ...req.body };
  if (await Lead.findOne({ phone: body.phone })) throw httpError(409, 'A lead with this phone number already exists');
  // Sales employees always own the leads they create; only admins can pick an assignee
  body.assignedTo = req.user.role === 'sales' ? req.user._id : body.assignedTo || req.user._id;
  if (!body.email) delete body.email;
  const lead = await Lead.create(body);
  await log(lead._id, req.user._id, 'created', 'Lead created');
  res.status(201).json(lead);
}));

router.get('/:id', wrap(async (req, res) => {
  const lead = await getLead(req);
  await lead.populate([{ path: 'assignedTo', select: 'name email' }, { path: 'notes.by', select: 'name' }]);
  const [activity, bookings] = await Promise.all([
    Activity.find({ lead: lead._id }).sort('-at').limit(50).populate('user', 'name'),
    Booking.find({ lead: lead._id }).sort('-createdAt').populate({ path: 'unit', populate: [{ path: 'project', select: 'name' }, { path: 'building', select: 'name' }] }),
  ]);
  res.json({ lead, activity, bookings });
}));

router.patch('/:id', validate(leadBody.partial()), wrap(async (req, res) => {
  const lead = await getLead(req);
  const { assignedTo, phone, ...rest } = req.body; // assignment has its own admin-only endpoint
  if (phone && phone !== lead.phone) {
    if (await Lead.findOne({ phone, _id: { $ne: lead._id } })) throw httpError(409, 'Another lead already uses this phone number');
    lead.phone = phone;
  }
  Object.assign(lead, rest);
  await lead.save();
  await log(lead._id, req.user._id, 'updated', 'Lead details updated');
  res.json(lead);
}));

router.patch('/:id/stage', validate(z.object({ stage: z.enum(STAGES), lostReason: z.string().trim().optional() })), wrap(async (req, res) => {
  const lead = await getLead(req);
  const { stage, lostReason } = req.body;
  if (stage === lead.stage) return res.json(lead);
  if (stage === 'Booked') throw httpError(400, 'A lead becomes Booked only by booking a unit');
  if (lead.stage === 'Booked') throw httpError(400, 'This lead has an active booking. Ask an admin to cancel it first');
  if (stage === 'Lost' && !lostReason) throw httpError(400, 'Tell us why this lead was lost');
  const from = lead.stage;
  lead.stage = stage;
  lead.lostReason = stage === 'Lost' ? lostReason : undefined;
  await lead.save();
  await log(lead._id, req.user._id, 'stage', `Stage changed: ${from} to ${stage}${stage === 'Lost' ? ` (${lostReason})` : ''}`);
  res.json(lead);
}));

router.patch('/:id/assign', allow('admin'), validate(z.object({ assignedTo: z.string() })), wrap(async (req, res) => {
  const lead = await Lead.findById(req.params.id);
  if (!lead) throw httpError(404, 'Lead not found');
  const user = await User.findById(req.body.assignedTo);
  if (!user || !user.active) throw httpError(400, 'Choose an active team member');
  lead.assignedTo = user._id;
  await lead.save();
  await log(lead._id, req.user._id, 'assign', `Assigned to ${user.name}`);
  res.json(lead);
}));

router.post('/:id/notes', validate(z.object({ text: z.string().trim().min(1, 'Write a note first'), nextFollowUp: optDate })), wrap(async (req, res) => {
  const lead = await getLead(req);
  lead.notes.push({ text: req.body.text, by: req.user._id });
  if (req.body.nextFollowUp) lead.nextFollowUp = req.body.nextFollowUp;
  await lead.save();
  await log(lead._id, req.user._id, 'note', req.body.nextFollowUp ? 'Added a note and set a follow-up' : 'Added a note');
  res.status(201).json(lead);
}));

module.exports = router;
