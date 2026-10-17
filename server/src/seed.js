const bcrypt = require('bcryptjs');
const { User, Lead, Project, Building, Unit, Booking, Activity } = require('./models');

let s = 7;
const rnd = () => (s = (s * 9301 + 49297) % 233280) / 233280;
const pick = (a) => a[Math.floor(rnd() * a.length)];
const day = (n) => { const d = new Date(); d.setDate(d.getDate() + n); d.setHours(10, 0, 0, 0); return d; };

module.exports = async function seed() {
  if (await User.countDocuments()) return;
  console.log('Seeding demo data...');
  const adminHash = await bcrypt.hash('Admin@123', 10);
  const salesHash = await bcrypt.hash('Sales@123', 10);
  const [admin, ...sales] = await User.create([
    { name: 'Karthik Raj', email: 'admin@crm.com', passwordHash: adminHash, role: 'admin' },
    { name: 'Priya Nair', email: 'priya@crm.com', passwordHash: salesHash },
    { name: 'Arun Kumar', email: 'arun@crm.com', passwordHash: salesHash },
    { name: 'Meena Sundar', email: 'meena@crm.com', passwordHash: salesHash },
  ]);

  const [sky, palm] = await Project.create([
    { name: 'Skyline Residency', location: 'OMR, Chennai', description: 'Premium apartments with sea-facing towers' },
    { name: 'Palm Grove Villas', location: 'ECR, Chennai', description: 'Gated villa community' },
  ]);
  const [bA, bB, bV] = await Building.create([
    { project: sky._id, name: 'Tower A' }, { project: sky._id, name: 'Tower B' }, { project: palm._id, name: 'Phase 1' },
  ]);

  const units = [];
  const gen = (b, project, floors, per, types, area, base) => {
    for (let f = 1; f <= floors; f++) for (let i = 1; i <= per; i++) {
      const type = types[(i - 1) % types.length];
      const a = area[type] || 1000;
      units.push({ project, building: b._id, floor: f, unitNumber: `${f}${String(i).padStart(2, '0')}`, type, areaSqft: a, price: Math.round((a * (base + f * 60)) / 1e4) * 1e4 });
    }
  };
  gen(bA, sky._id, 5, 4, ['1BHK', '2BHK', '2BHK', '3BHK'], { '1BHK': 650, '2BHK': 1050, '3BHK': 1500 }, 7200);
  gen(bB, sky._id, 3, 4, ['2BHK', '3BHK'], { '2BHK': 1100, '3BHK': 1600 }, 7600);
  gen(bV, palm._id, 1, 8, ['Villa'], { Villa: 2400 }, 9500);
  const createdUnits = await Unit.insertMany(units);

  const first = ['Arjun', 'Divya', 'Rahul', 'Sneha', 'Vikram', 'Lakshmi', 'Suresh', 'Anitha', 'Ganesh', 'Revathi', 'Manoj', 'Kavya', 'Naveen', 'Pooja', 'Dinesh'];
  const last = ['Iyer', 'Krishnan', 'Sharma', 'Pillai', 'Reddy', 'Menon', 'Das', 'Rao', 'Nair', 'Gupta'];
  const stages = ['New', 'Contacted', 'Site Visit', 'Interested', 'Negotiation', 'Lost'];
  const sources = ['Website', 'Referral', 'Walk-in', 'Social', 'Ads'];
  const lostWhy = ['Budget too low', 'Chose a competitor', 'Not responding', 'Postponed purchase'];

  const leads = [];
  for (let i = 0; i < 30; i++) {
    const stage = i < 4 ? 'Booked' : pick(stages);
    const closed = stage === 'Booked' || stage === 'Lost';
    leads.push({
      name: `${pick(first)} ${pick(last)}`, phone: `98${String(40000000 + Math.floor(rnd() * 5e7))}`,
      email: i % 3 ? `lead${i}@example.com` : undefined, source: pick(sources),
      budget: Math.round((4500000 + rnd() * 9000000) / 1e5) * 1e5, stage,
      lostReason: stage === 'Lost' ? pick(lostWhy) : undefined,
      assignedTo: sales[i % 3]._id,
      nextFollowUp: closed ? undefined : day(Math.floor(rnd() * 8) - 3),
      notes: i % 2 ? [{ text: 'Spoke on call. Interested in a sea-facing 2BHK.', by: sales[i % 3]._id }] : [],
      createdAt: day(-Math.floor(rnd() * 25)),
    });
  }
  const created = await Lead.insertMany(leads);
  await Activity.insertMany(created.map((l) => ({ lead: l._id, user: l.assignedTo, type: 'created', message: 'Lead created', at: l.createdAt })));

  const free = createdUnits.filter((u) => u.type !== 'Villa');
  for (let i = 0; i < 4; i++) {
    const unit = free[i * 5 + 1];
    await Booking.create({ lead: created[i]._id, unit: unit._id, bookedBy: created[i].assignedTo, amount: unit.price });
    await Unit.findByIdAndUpdate(unit._id, { status: 'Booked' });
    await Activity.create({ lead: created[i]._id, user: created[i].assignedTo, type: 'booking', message: `Booked unit ${unit.unitNumber}` });
  }
  await Unit.findByIdAndUpdate(free[3]._id, { status: 'Held' });
  console.log('Seed complete. Admin: admin@crm.com / Admin@123  Sales: priya@crm.com / Sales@123');
};
