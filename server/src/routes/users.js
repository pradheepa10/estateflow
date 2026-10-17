const router = require('express').Router();
const bcrypt = require('bcryptjs');
const { z } = require('zod');
const { User } = require('../models');
const { wrap, httpError, protect, allow, validate } = require('../middleware');

router.use(protect);

// Names only - used for assignee pickers and avatars
router.get('/assignable', wrap(async (req, res) => {
  res.json(await User.find({ active: true }).select('name role').sort('name'));
}));

router.get('/', allow('admin'), wrap(async (req, res) => {
  res.json(await User.find().select('-passwordHash').sort('-createdAt'));
}));

router.post('/', allow('admin'), validate(z.object({
  name: z.string().trim().min(2),
  email: z.string().trim().email(),
  password: z.string().min(8, 'Use at least 8 characters'),
  role: z.enum(['admin', 'sales']).default('sales'),
})), wrap(async (req, res) => {
  const { password, ...rest } = req.body;
  if (await User.findOne({ email: rest.email.toLowerCase() })) throw httpError(409, 'A user with this email already exists');
  const user = await User.create({ ...rest, passwordHash: await bcrypt.hash(password, 10) });
  res.status(201).json({ _id: user._id, name: user.name, email: user.email, role: user.role, active: user.active });
}));

router.patch('/:id', allow('admin'), validate(z.object({
  active: z.boolean().optional(), role: z.enum(['admin', 'sales']).optional(),
})), wrap(async (req, res) => {
  if (String(req.user._id) === req.params.id) throw httpError(400, 'You cannot change your own role or status');
  const user = await User.findByIdAndUpdate(req.params.id, req.body, { new: true }).select('-passwordHash');
  if (!user) throw httpError(404, 'User not found');
  res.json(user);
}));

module.exports = router;
