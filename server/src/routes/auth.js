const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { z } = require('zod');
const { User } = require('../models');
const { wrap, httpError, protect, validate } = require('../middleware');

router.post('/login', validate(z.object({ email: z.string().email(), password: z.string().min(1) })), wrap(async (req, res) => {
  const user = await User.findOne({ email: req.body.email.toLowerCase() });
  const ok = user && user.active && (await bcrypt.compare(req.body.password, user.passwordHash));
  if (!ok) throw httpError(401, 'Incorrect email or password');
  const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ token, user: { _id: user._id, name: user.name, email: user.email, role: user.role } });
}));

router.get('/me', protect, (req, res) => res.json({ user: req.user }));
module.exports = router;
