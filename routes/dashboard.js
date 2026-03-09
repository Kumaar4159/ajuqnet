'use strict';
const express      = require('express');
const router       = express.Router();
const User         = require('../models/User');
const Order        = require('../models/Order');
const Booking      = require('../models/Booking');
const Message      = require('../models/Message');
const Announcement = require('../models/Announcement');
const Attendance   = require('../models/Attendance');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /dashboard → redirect to role dashboard
router.get('/', requireAuth, (req, res) => {
  const map = { admin: '/dashboard/admin', faculty: '/dashboard/faculty', student: '/dashboard/student', canteen: '/dashboard/canteen' };
  res.redirect(map[req.session.userRole] || '/dashboard/student');
});

// ── Admin Dashboard ────────────────────────────────────────────────────────────
router.get('/admin', requireRole('admin'), async (req, res) => {
  try {
    const [totalUsers, admins, faculty, students, lockedAccounts,
           pendingOrders, todayMessages] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ role: 'admin' }),
      User.countDocuments({ role: 'faculty' }),
      User.countDocuments({ role: 'student' }),
      User.countDocuments({ lockUntil: { $gt: new Date() } }),
      Order.countDocuments({ status: { $in: ['pending', 'confirmed', 'preparing'] } }),
      Message.countDocuments({ createdAt: { $gte: new Date(Date.now() - 86400000) }, isDeleted: false }),
    ]);

    // Department-wise student counts
    const deptStats = await User.aggregate([
      { $match: { role: 'student' } },
      { $group: { _id: '$department', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]);

    // Semester-wise counts per department
    const semStats = await User.aggregate([
      { $match: { role: 'student', semester: { $exists: true, $ne: '' } } },
      { $group: { _id: { department: '$department', semester: '$semester' }, count: { $sum: 1 } } },
      { $sort: { '_id.department': 1, '_id.semester': 1 } },
    ]);

    const recentUsers = await User.find().select('-password').sort({ createdAt: -1 }).limit(5);
    res.render('dashboard/admin', {
      title: 'Admin Dashboard',
      stats: { totalUsers, admins, faculty, students, lockedAccounts, pendingOrders, todayMessages },
      recentUsers,
      deptStats,
      semStats,
    });
  } catch (err) { console.error(err); res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// ── Faculty Dashboard ──────────────────────────────────────────────────────────
router.get('/faculty', requireRole(['admin', 'faculty']), async (req, res) => {
  try {
    const Subject = require('../models/Subject');
    const dept = req.session.user?.department || null;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [studentCount, deptStudentCount, attendanceMarked, announcementCount, announcements, mySubjects] = await Promise.all([
      User.countDocuments({ role: 'student' }),
      dept ? User.countDocuments({ role: 'student', department: dept }) : Promise.resolve(0),
      Attendance.countDocuments({ markedBy: req.session.userId, date: { $gte: sevenDaysAgo } }),
      Announcement.countDocuments({ createdBy: req.session.userId }),
      Announcement.getActive().limit(3),
      Subject.find({ assignedFaculty: req.session.userId, isActive: true }).sort({ semester: 1, code: 1 }),
    ]);

    // Semester-wise student breakdown for faculty's department
    const semBreakdown = dept ? await User.aggregate([
      { $match: { role: 'student', department: dept, semester: { $exists: true, $ne: '' } } },
      { $group: { _id: '$semester', count: { $sum: 1 } } },
      { $sort: { _id: 1 } },
    ]) : [];

    res.render('dashboard/faculty', {
      title: 'Faculty Dashboard',
      stats: { studentCount, deptStudentCount, attendanceMarked, announcements: announcementCount },
      announcements,
      mySubjects,
      semBreakdown,
      dept,
    });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// ── Student Dashboard ──────────────────────────────────────────────────────────
router.get('/student', requireRole(['admin', 'faculty', 'student']), async (req, res) => {
  try {
    const dept = req.session.user?.department || null;
    const [myOrders, activeOrders, myBookings, announcements, attendanceSummary] = await Promise.all([
      Order.countDocuments({ placedBy: req.session.userId }),
      Order.countDocuments({ placedBy: req.session.userId, status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } }),
      Booking.countDocuments({ bookedBy: req.session.userId, status: { $in: ['pending', 'confirmed'] } }),
      Announcement.getActive(dept).limit(3),
      Attendance.getSummary(req.session.userId),
    ]);
    const recentOrders = await Order.find({ placedBy: req.session.userId }).sort({ createdAt: -1 }).limit(3);
    res.render('dashboard/student', {
      title: 'Student Dashboard',
      stats: { myOrders, activeOrders, myBookings },
      recentOrders,
      announcements,
      attendanceSummary,
    });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// ── Canteen Dashboard ─────────────────────────────────────────────────────────
router.get('/canteen', requireRole(['admin', 'canteen']), async (req, res) => {
  try {
    const [pendingOrders, activeOrders, preparingOrders, readyOrders, todayBookings] = await Promise.all([
      Order.countDocuments({ status: 'pending' }),
      Order.countDocuments({ status: { $in: ['confirmed', 'preparing'] } }),
      Order.countDocuments({ status: 'preparing' }),
      Order.countDocuments({ status: 'ready' }),
      Booking.countDocuments({
        date: { $gte: new Date(new Date().setHours(0,0,0,0)), $lte: new Date(new Date().setHours(23,59,59,999)) },
        status: { $in: ['pending', 'confirmed', 'checked_in'] },
      }),
    ]);
    const recentOrders = await Order.find({ status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } })
      .populate('placedBy', 'name')
      .sort({ createdAt: -1 })
      .limit(8);
    res.render('dashboard/canteen', {
      title: 'Canteen Dashboard',
      stats: { pendingOrders, activeOrders, preparingOrders, readyOrders, todayBookings },
      recentOrders,
    });
  } catch (err) { console.error(err); res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// ── Profile (all roles) ────────────────────────────────────────────────────────
router.get('/profile', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('-password -loginAttempts -lockUntil');
    if (!user) { req.session.destroy(); return res.redirect('/auth/login'); }
    res.render('dashboard/profile', { title: 'My Profile', profileUser: user });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

module.exports = router;