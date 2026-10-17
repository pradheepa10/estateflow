require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const connect = require('./config/db');
const seed = require('./seed');
const { errorHandler } = require('./middleware');

if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'dev-secret-change-me';
  console.warn('JWT_SECRET not set - using an insecure dev secret');
}

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : true }));
app.use(express.json({ limit: '100kb' }));
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ ok: true }));
app.use('/api/auth', require('./routes/auth'));
app.use('/api/users', require('./routes/users'));
app.use('/api/leads', require('./routes/leads'));
app.use('/api', require('./routes/properties'));
app.use('/api/bookings', require('./routes/bookings'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use((req, res) => res.status(404).json({ message: 'Route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
connect()
  .then(async () => {
    if (process.env.AUTO_SEED !== 'false') await seed();
    app.listen(PORT, () => console.log(`API running on :${PORT}`));
  })
  .catch((e) => { console.error('Startup failed', e); process.exit(1); });
