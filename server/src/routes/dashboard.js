const router = require('express').Router();
const mongoose = require('mongoose');
const { Lead, Unit, Booking, Activity } = require('../models');
const { wrap, protect } = require('../middleware');

router.use(protect);

router.get('/', wrap(async (req, res) => {
  const isSales = req.user.role === 'sales';
  const me = req.user._id;
  const scope = isSales ? { assignedTo: me } : {};
  const bookingScope = isSales ? { bookedBy: me } : {};
  const weekAgo = new Date(Date.now() - 7 * 864e5);
  const monthStart = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const startToday = new Date(); startToday.setHours(0, 0, 0, 0);
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const open = { stage: { $nin: ['Booked', 'Lost'] } };

  const [total, newThisWeek, byStage, bySource, dueList, overdue, dueToday, bookingAgg, unitAgg, activity, leaderboard, unassigned] = await Promise.all([
    Lead.countDocuments(scope),
    Lead.countDocuments({ ...scope, createdAt: { $gte: weekAgo } }),
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$stage', count: { $sum: 1 } } }]),
    Lead.aggregate([{ $match: scope }, { $group: { _id: '$source', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
    Lead.find({ ...scope, ...open, nextFollowUp: { $lte: endToday } }).sort('nextFollowUp').limit(8).select('name phone stage nextFollowUp assignedTo').populate('assignedTo', 'name'),
    Lead.countDocuments({ ...scope, ...open, nextFollowUp: { $lt: startToday } }),
    Lead.countDocuments({ ...scope, ...open, nextFollowUp: { $gte: startToday, $lte: endToday } }),
    Booking.aggregate([{ $match: { ...bookingScope, status: 'Active' } }, { $group: {
      _id: null, count: { $sum: 1 }, revenue: { $sum: '$amount' },
      thisMonth: { $sum: { $cond: [{ $gte: ['$createdAt', monthStart] }, 1, 0] } } } }]),
    Unit.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Activity.find(isSales ? { user: me } : {}).sort('-at').limit(8).populate('user', 'name').populate('lead', 'name'),
    isSales ? [] : Booking.aggregate([{ $match: { status: 'Active' } },
      { $group: { _id: '$bookedBy', bookings: { $sum: 1 }, revenue: { $sum: '$amount' } } }, { $sort: { revenue: -1 } }, { $limit: 5 },
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'user' } }, { $unwind: '$user' },
      { $project: { name: '$user.name', bookings: 1, revenue: 1 } }]),
    isSales ? 0 : Lead.countDocuments({ assignedTo: null, stage: { $nin: ['Booked', 'Lost'] } }),
  ]);

  const b = bookingAgg[0] || { count: 0, revenue: 0, thisMonth: 0 };
  res.json({
    role: req.user.role,
    totals: { leads: total, newThisWeek, activeBookings: b.count, revenue: b.revenue, bookingsThisMonth: b.thisMonth, overdue, dueToday, unassigned },
    byStage, bySource,
    units: Object.fromEntries(unitAgg.map((u) => [u._id, u.count])),
    dueList, activity, leaderboard,
  });
}));

module.exports = router;
