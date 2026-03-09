'use strict';
const express  = require('express');
const router   = express.Router();
const Order    = require('../models/Order');
const Booking  = require('../models/Booking');
const MenuItem = require('../models/MenuItem');
const { requireRole } = require('../middleware/auth');
const Notification = require('../models/Notification');

const CANTEEN_ROLES = ['admin', 'canteen'];

// ── GET /canteen/orders ───────────────────────────────────────────────────────
router.get('/orders', requireRole(CANTEEN_ROLES), async (req, res) => {
  try {
    const { status = '', page = 1 } = req.query;
    const limit  = 20;
    const skip   = (parseInt(page) - 1) * limit;
    const filter = status ? { status } : { status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } };

    const [orders, total] = await Promise.all([
      Order.find(filter)
        .populate('placedBy', 'name email role')
        .sort({ createdAt: 1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(filter),
    ]);

    const pages = Math.ceil(total / limit);
    res.render('canteen/orders', {
      title: 'Orders Management',
      orders, status, page: parseInt(page), pages, total,
    });
  } catch (err) {
    res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user });
  }
});

// ── POST /canteen/orders/:id/status ──────────────────────────────────────────
router.post('/orders/:id/status', requireRole(CANTEEN_ROLES), async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.redirect('/canteen/orders?error=Order+not+found');

    const isOwn = order.placedBy.toString() === req.session.userId;
    if (!order.canTransitionTo(status, req.session.userRole, isOwn))
      return res.redirect('/canteen/orders?error=Invalid+status+transition');

    const now   = new Date();
    const tsMap = { confirmed: { confirmedAt: now }, ready: { readyAt: now }, delivered: { deliveredAt: now } };

    await Order.findByIdAndUpdate(req.params.id, {
      status,
      ...(tsMap[status] || {}),
      $push: {
        statusHistory: {
          status, changedBy: req.session.userId,
          changedByName: req.session.user.name,
          note: note || '', timestamp: now,
        },
      },
    });

    const io = req.app.get('io');
    if (io) {
      io.to(`user:${order.placedBy.toString()}`).emit('order:statusUpdate', {
        orderId: req.params.id, status, note: note || '',
        changedByName: req.session.user.name, timestamp: now.toISOString(),
      });
    }

    if (order.placedBy.toString() !== req.session.userId) {
      const statusLabels = { confirmed: 'confirmed', preparing: 'being prepared', ready: 'ready for pickup', delivered: 'delivered' };
      await Notification.send({
        recipientId: order.placedBy.toString(),
        title: `Order ${order.orderNumber} ${statusLabels[status] || status}`,
        body:  note ? `Canteen: ${note}` : `Your order is now "${status}".`,
        type:  'order',
        link:  `/orders/${req.params.id}`,
        io,
      });
    }

    res.redirect('/canteen/orders?success=Status+updated');
  } catch (err) {
    res.redirect(`/canteen/orders?error=${encodeURIComponent(err.message)}`);
  }
});

// ── GET /canteen/bookings ─────────────────────────────────────────────────────
router.get('/bookings', requireRole(CANTEEN_ROLES), async (req, res) => {
  try {
    const { date: dateParam, page = 1 } = req.query;
    const limit      = 20;
    const skip       = (parseInt(page) - 1) * limit;
    const targetDate = dateParam ? new Date(dateParam) : new Date();
    const dayStart   = new Date(targetDate.setHours(0,  0,  0,   0));
    const dayEnd     = new Date(targetDate.setHours(23, 59, 59, 999));

    const [bookings, total] = await Promise.all([
      Booking.find({ date: { $gte: dayStart, $lte: dayEnd } })
        .populate('bookedBy', 'name email role studentId')
        .populate('table',    'tableNumber capacity location')
        .sort({ startTime: 1 })
        .skip(skip)
        .limit(limit),
      Booking.countDocuments({ date: { $gte: dayStart, $lte: dayEnd } }),
    ]);

    res.render('canteen/bookings', {
      title: 'Table Bookings',
      bookings, selectedDate: dayStart.toISOString().slice(0, 10),
      page: parseInt(page), pages: Math.ceil(total / limit), total,
    });
  } catch (err) {
    res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user });
  }
});

module.exports = router;