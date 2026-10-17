const router = require('express').Router();
const { z } = require('zod');
const { Booking, Unit, Lead, Activity } = require('../models');
const { wrap, httpError, protect, allow, validate } = require('../middleware');

router.use(protect);

router.get('/', wrap(async (req, res) => {
  const f = req.user.role === 'sales' ? { bookedBy: req.user._id } : {};
  if (req.query.status) f.status = req.query.status;
  res.json(await Booking.find(f).sort('-createdAt').limit(300)
    .populate('lead', 'name phone').populate('bookedBy', 'name')
    .populate({ path: 'unit', populate: [{ path: 'project', select: 'name' }, { path: 'building', select: 'name' }] }));
}));

router.post('/', validate(z.object({ leadId: z.string(), unitId: z.string(), amount: z.coerce.number().positive().optional() })), wrap(async (req, res) => {
  const { leadId, unitId } = req.body;
  const lead = await Lead.findById(leadId);
  if (!lead) throw httpError(404, 'Lead not found');
  if (req.user.role === 'sales' && String(lead.assignedTo) !== String(req.user._id)) throw httpError(403, 'You can only book for your own leads');
  if (lead.stage === 'Lost') throw httpError(400, 'This lead is marked Lost. Move it back to an active stage first');

  // 1) Atomic claim: only ONE concurrent request can flip Available -> Booked
  const unit = await Unit.findOneAndUpdate({ _id: unitId, status: 'Available' }, { status: 'Booked' }, { new: true });
  if (!unit) throw httpError(409, 'This unit is no longer available. Pick another one');

  try {
    // 2) The partial unique index on Booking is a second safety net
    const booking = await Booking.create({ lead: lead._id, unit: unit._id, bookedBy: req.user._id, amount: req.body.amount || unit.price });
    lead.stage = 'Booked';
    lead.lostReason = undefined;
    await lead.save();
    await Activity.create({ lead: lead._id, user: req.user._id, type: 'booking', message: `Booked unit ${unit.unitNumber}` });
    res.status(201).json(booking);
  } catch (err) {
    await Unit.findByIdAndUpdate(unit._id, { status: 'Available' }); // roll back the claim
    throw err;
  }
}));

router.patch('/:id/cancel', allow('admin'), validate(z.object({ reason: z.string().trim().min(3, 'Give a short reason') })), wrap(async (req, res) => {
  const booking = await Booking.findOneAndUpdate({ _id: req.params.id, status: 'Active' },
    { status: 'Cancelled', cancelledBy: req.user._id, cancelReason: req.body.reason }, { new: true });
  if (!booking) throw httpError(404, 'Active booking not found');
  const unit = await Unit.findByIdAndUpdate(booking.unit, { status: 'Available' });
  const stillBooked = await Booking.exists({ lead: booking.lead, status: 'Active' });
  if (!stillBooked) await Lead.findByIdAndUpdate(booking.lead, { stage: 'Negotiation' });
  await Activity.create({ lead: booking.lead, user: req.user._id, type: 'booking', message: `Cancelled booking of unit ${unit?.unitNumber} (${req.body.reason})` });
  res.json(booking);
}));

module.exports = router;
