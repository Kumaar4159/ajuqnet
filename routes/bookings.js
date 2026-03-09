'use strict';
const express  = require('express');
const router   = express.Router();
const Booking  = require('../models/Booking');
const Table    = require('../models/Table');
const { requireAuth, requireRole } = require('../middleware/auth');
const Notification = require('../models/Notification');   // ← ADD THIS LINE

// GET /bookings
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, status } = req.query;
    const limit  = 15;
    const filter = {};
    if (req.session.userRole === 'student' || req.session.userRole === 'faculty') filter.bookedBy = req.session.userId;
    if (status) filter.status = status;
    const skip = (parseInt(page) - 1) * limit;
    const [bookings, total] = await Promise.all([
      Booking.find(filter).populate('bookedBy', 'name email').populate('table', 'tableNumber section capacity').sort({ startTime: -1 }).skip(skip).limit(limit),
      Booking.countDocuments(filter),
    ]);
    res.render('bookings/index', { title: 'Table Bookings', bookings, page: parseInt(page), pages: Math.ceil(total / limit), total, status: status || '' });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// GET /bookings/new
router.get('/new', requireAuth, async (req, res) => {
  try {
    const tables = await Table.find({ isActive: true, isUnderMaintenance: false }).sort({ section: 1, tableNumber: 1 });
    res.render('bookings/new', { title: 'New Booking', tables, error: null, prefill: req.query });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// GET /bookings/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const booking = await Booking.findById(req.params.id).populate('bookedBy', 'name email role').populate('table', 'tableNumber section capacity amenities');
    if (!booking) return res.redirect('/bookings');
    if ((req.session.userRole === 'student' || req.session.userRole === 'faculty') && booking.bookedBy._id.toString() !== req.session.userId) return res.redirect('/bookings');
    res.render('bookings/detail', { title: `Booking ${booking.bookingReference}`, booking, userRole: req.session.userRole, userId: req.session.userId });
  } catch { res.redirect('/bookings'); }
});

// POST /bookings — create with conflict detection (no transaction needed without replica set)
router.post('/', requireAuth, async (req, res) => {
  const { tableId, guestCount, purpose, specialRequests, date, startTime, endTime, durationMinutes } = req.body;

  // Reload tables for error re-render
  const getTables = () => Table.find({ isActive: true, isUnderMaintenance: false }).sort({ section: 1, tableNumber: 1 });

  try {
    if (!tableId || !date || !startTime)
      return res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: 'Table, date, and start time are required.', prefill: req.body });

    const start = new Date(startTime);
    let   end   = endTime ? new Date(endTime) : new Date(start.getTime() + (parseInt(durationMinutes) || 60) * 60000);

    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end <= start)
      return res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: 'Invalid time range.', prefill: req.body });

    const dur = Math.round((end - start) / 60000);
    if (dur < 15) return res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: 'Minimum booking duration is 15 minutes.', prefill: req.body });
    if (dur > 480) return res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: 'Maximum booking duration is 8 hours.', prefill: req.body });
    if (start < new Date(Date.now() - 5 * 60000))
      return res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: 'Cannot book a time slot in the past.', prefill: req.body });

    const table = await Table.findById(tableId);
    if (!table || !table.isActive || table.isUnderMaintenance)
      return res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: 'Table is unavailable.', prefill: req.body });

    const guests = parseInt(guestCount) || 1;
    if (guests > table.capacity)
      return res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: `Guest count (${guests}) exceeds table capacity (${table.capacity}).`, prefill: req.body });

    // Conflict detection
    const conflicts = await Booking.find({ table: tableId, status: { $in: ['pending', 'confirmed', 'checked_in'] }, startTime: { $lt: end }, endTime: { $gt: start } });
    if (conflicts.length > 0)
      return res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: `Time slot conflict: ${conflicts.length} booking(s) overlap this time on Table ${table.tableNumber}.`, prefill: req.body });

    const booking = await Booking.create({
      bookedBy: req.session.userId, bookedByName: req.session.user.name, bookedByRole: req.session.userRole,
      table: table._id, tableNumber: table.tableNumber,
      date: new Date(date), startTime: start, endTime: end, durationMinutes: dur,
      guestCount: guests, purpose: purpose || 'dining', specialRequests,
      statusHistory: [{ status: 'pending', changedBy: req.session.userId, changedByName: req.session.user.name, note: 'Booking created' }],
    });

    const io = req.app.get('io');
    await Notification.send({
      recipientId: req.session.userId,
      title: `Table ${table.tableNumber} booked`,
      body:  `Your booking (${booking.bookingReference}) is confirmed for ${start.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}.`,
      type:  'booking',
      link:  `/bookings/${booking._id}`,
      io,
    });

    res.redirect(`/bookings/${booking._id}?success=Booking+confirmed`);
  } catch (err) {
    const msg = err.name === 'ValidationError' ? Object.values(err.errors).map(e => e.message).join(' ') : err.message;
    res.render('bookings/new', { title: 'New Booking', tables: await getTables(), error: msg, prefill: req.body });
  }
});

// POST /bookings/:id/status
router.post('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, note, cancellationReason } = req.body;
    const booking = await Booking.findById(req.params.id);
    if (!booking) return res.redirect('/bookings');
    const isOwn = booking.bookedBy.toString() === req.session.userId;
    // Only canteen/admin can confirm/check-in; students/faculty can only cancel their own
    const canManage = ['canteen','admin'].includes(req.session.userRole);
    if (!canManage && status !== 'cancelled') return res.redirect(`/bookings/${req.params.id}?error=Only+canteen+staff+can+update+booking+status`);
    if (!booking.canTransitionTo(status, req.session.userRole, isOwn))
      return res.redirect(`/bookings/${req.params.id}?error=Invalid+status+transition`);

    const now = new Date();
    const tsMap = {
      checked_in: { checkedInAt: now },
      completed:  { completedAt: now },
      cancelled:  { cancelledAt: now, cancelledBy: req.session.userId, cancellationReason: cancellationReason || note || '' },
    };
    await Booking.findByIdAndUpdate(req.params.id, { status, ...(tsMap[status] || {}), $push: { statusHistory: { status, changedBy: req.session.userId, changedByName: req.session.user.name, note: note || '', timestamp: now } } });
    if (booking.bookedBy.toString() !== req.session.userId) {
      const bookingIo = req.app.get('io');
      await Notification.send({
        recipientId: booking.bookedBy.toString(),
        title: `Booking ${booking.bookingReference} ${status.replace('_', ' ')}`,
        body:  note ? `${req.session.user.name}: ${note}` : `Your table booking status changed to "${status}".`,
        type:  'booking',
        link:  `/bookings/${req.params.id}`,
        io: bookingIo,
      });
    }
    res.redirect(`/bookings/${req.params.id}?success=Status+updated`);
  } catch (err) { res.redirect(`/bookings/${req.params.id}?error=${encodeURIComponent(err.message)}`); }
});

module.exports = router;
