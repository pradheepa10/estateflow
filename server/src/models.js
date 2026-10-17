const mongoose = require('mongoose');
const { Schema } = mongoose;
const ref = (name, extra = {}) => ({ type: Schema.Types.ObjectId, ref: name, ...extra });

const STAGES = ['New', 'Contacted', 'Site Visit', 'Interested', 'Negotiation', 'Booked', 'Lost'];
const SOURCES = ['Website', 'Referral', 'Walk-in', 'Social', 'Ads', 'Other'];
const UNIT_TYPES = ['1BHK', '2BHK', '3BHK', 'Villa', 'Shop'];

const User = mongoose.model('User', new Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['admin', 'sales'], default: 'sales' },
  active: { type: Boolean, default: true },
}, { timestamps: true }));

const Lead = mongoose.model('Lead', new Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true, index: true },
  email: { type: String, trim: true },
  source: { type: String, enum: SOURCES, default: 'Other' },
  budget: Number,
  stage: { type: String, enum: STAGES, default: 'New', index: true },
  lostReason: String,
  assignedTo: ref('User', { index: true }),
  nextFollowUp: { type: Date, index: true },
  notes: [{ text: String, by: ref('User'), at: { type: Date, default: Date.now } }],
}, { timestamps: true }));

const Project = mongoose.model('Project', new Schema({
  name: { type: String, required: true, unique: true, trim: true },
  location: String,
  description: String,
}, { timestamps: true }));

const Building = mongoose.model('Building', (() => {
  const s = new Schema({
    project: ref('Project', { required: true, index: true }),
    name: { type: String, required: true, trim: true },
  }, { timestamps: true });
  s.index({ project: 1, name: 1 }, { unique: true });
  return s;
})());

const Unit = mongoose.model('Unit', (() => {
  const s = new Schema({
    project: ref('Project', { required: true, index: true }),
    building: ref('Building', { required: true, index: true }),
    unitNumber: { type: String, required: true },
    floor: { type: Number, default: 0 },
    type: { type: String, enum: UNIT_TYPES, required: true },
    areaSqft: Number,
    price: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Available', 'Held', 'Booked'], default: 'Available', index: true },
  }, { timestamps: true });
  s.index({ building: 1, unitNumber: 1 }, { unique: true });
  return s;
})());

const Booking = mongoose.model('Booking', (() => {
  const s = new Schema({
    lead: ref('Lead', { required: true, index: true }),
    unit: ref('Unit', { required: true }),
    bookedBy: ref('User', { required: true }),
    amount: { type: Number, required: true },
    status: { type: String, enum: ['Active', 'Cancelled'], default: 'Active' },
    cancelledBy: ref('User'),
    cancelReason: String,
  }, { timestamps: true });
  // Safety net: the DB itself refuses two ACTIVE bookings for one unit
  s.index({ unit: 1 }, { unique: true, partialFilterExpression: { status: 'Active' } });
  return s;
})());

const Activity = mongoose.model('Activity', new Schema({
  lead: ref('Lead', { index: true }),
  user: ref('User'),
  type: String,
  message: String,
  at: { type: Date, default: Date.now },
}));

module.exports = { User, Lead, Project, Building, Unit, Booking, Activity, STAGES, SOURCES, UNIT_TYPES };
