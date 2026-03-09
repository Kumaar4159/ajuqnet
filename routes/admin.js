'use strict';
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const Order   = require('../models/Order');
const Booking = require('../models/Booking');
const Message = require('../models/Message');
const { requireRole } = require('../middleware/auth');

// GET /admin — audit panel
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { page = 1, role: filterRole, search } = req.query;
    const limit  = 20;
    const filter = {};
    if (filterRole) filter.role   = filterRole;
    if (search)     filter.$or    = [{ name: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }];

    const skip = (parseInt(page) - 1) * limit;
    const [users, total, orderStats, bookingStats, messageStats] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip(skip).limit(limit),
      User.countDocuments(filter),
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Booking.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Message.aggregate([{ $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, count: { $sum: 1 } } }, { $sort: { _id: -1 } }, { $limit: 7 }]),
    ]);

    const usersWithLock = users.map(u => ({ ...u.toObject(), isLockedNow: u.lockUntil && u.lockUntil > Date.now() }));
    const oStats = orderStats.reduce((a, s) => { a[s._id] = s.count; return a; }, {});
    const bStats = bookingStats.reduce((a, s) => { a[s._id] = s.count; return a; }, {});

    res.render('admin/panel', {
      title: 'Admin Audit Panel',
      users: usersWithLock, total, page: parseInt(page), pages: Math.ceil(total / limit),
      filterRole, search: search || '',
      oStats, bStats, messageStats,
    });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// POST /admin/users/:id/unlock
router.post('/users/:id/unlock', requireRole('admin'), async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { $set: { loginAttempts: 0 }, $unset: { lockUntil: 1 } });
    res.redirect('/admin?success=Account+unlocked');
  } catch { res.redirect('/admin?error=Unlock+failed'); }
});

// POST /admin/users/:id/deactivate
router.post('/users/:id/deactivate', requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.session.userId) return res.redirect('/admin?error=Cannot+deactivate+yourself');
    const user = await User.findById(req.params.id);
    if (!user) return res.redirect('/admin?error=User+not+found');
    await user.updateOne({ isActive: !user.isActive });
    res.redirect('/admin?success=Account+status+updated');
  } catch { res.redirect('/admin?error=Update+failed'); }
});

// POST /admin/users/:id/role
router.post('/users/:id/role', requireRole('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'faculty', 'student', 'canteen'].includes(role)) return res.redirect('/admin?error=Invalid+role');
    if (req.params.id === req.session.userId) return res.redirect('/admin?error=Cannot+change+own+role');
    await User.findByIdAndUpdate(req.params.id, { role });
    res.redirect('/admin?success=Role+updated');
  } catch { res.redirect('/admin?error=Role+update+failed'); }
});

// POST /admin/users/:id/delete
router.post('/users/:id/delete', requireRole('admin'), async (req, res) => {
  try {
    if (req.params.id === req.session.userId) return res.redirect('/admin?error=Cannot+delete+yourself');
    await User.findByIdAndDelete(req.params.id);
    res.redirect('/admin?success=User+deleted');
  } catch { res.redirect('/admin?error=Delete+failed'); }
});

module.exports = router;
