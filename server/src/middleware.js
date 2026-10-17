const jwt = require('jsonwebtoken');
const { ZodError } = require('zod');
const { User } = require('./models');

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const httpError = (status, message) => Object.assign(new Error(message), { status });

const protect = wrap(async (req, res, next) => {
  const h = req.headers.authorization || '';
  const token = h.startsWith('Bearer ') ? h.slice(7) : null;
  if (!token) throw httpError(401, 'Please sign in to continue');
  let payload;
  try { payload = jwt.verify(token, process.env.JWT_SECRET); }
  catch { throw httpError(401, 'Session expired. Sign in again'); }
  const user = await User.findById(payload.id).select('-passwordHash');
  if (!user || !user.active) throw httpError(401, 'This account is not active');
  req.user = user;
  next();
});

const allow = (...roles) => (req, res, next) =>
  roles.includes(req.user.role) ? next() : next(httpError(403, 'You do not have permission to do this'));

const validate = (schema) => (req, res, next) => { req.body = schema.parse(req.body); next(); };

// eslint-disable-next-line no-unused-vars
const errorHandler = (err, req, res, next) => {
  if (err instanceof ZodError) {
    const errors = err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
    return res.status(400).json({ message: errors.map((e) => `${e.path || 'input'}: ${e.message}`).join('; '), errors });
  }
  if (err.name === 'CastError') return res.status(400).json({ message: 'Invalid id' });
  if (err.code === 11000) return res.status(409).json({ message: 'This record already exists or the unit is already booked' });
  if (err.status) return res.status(err.status).json({ message: err.message });
  console.error(err);
  res.status(500).json({ message: 'Server error. Please try again' });
};

module.exports = { wrap, httpError, protect, allow, validate, errorHandler };
