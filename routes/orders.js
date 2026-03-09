'use strict';
const express  = require('express');
const router   = express.Router();
const Order    = require('../models/Order');
const MenuItem = require('../models/MenuItem');
const { requireAuth, requireRole } = require('../middleware/auth');
const { orderRules, collectErrors } = require('../middleware/validators');
const Notification = require('../models/Notification');   // ← ADD THIS LINE

function buildFilter(session, query = {}) {
  const filter = {};
  // students and faculty only see their own orders; canteen/admin see all
  if (session.userRole === 'student' || session.userRole === 'faculty') {
    filter.placedBy = session.userId;
  } else if (query.userId) {
    filter.placedBy = query.userId;
  }
  if (query.status) filter.status = query.status;
  return filter;
}

// GET /orders — list
router.get('/', requireAuth, async (req, res) => {
  try {
    const { page = 1, status } = req.query;
    const limit  = 15;
    const filter = buildFilter(req.session, req.query);
    const skip   = (parseInt(page) - 1) * limit;
    const [orders, total] = await Promise.all([
      Order.find(filter).populate('placedBy', 'name email').sort({ createdAt: -1 }).skip(skip).limit(limit),
      Order.countDocuments(filter),
    ]);
    const pages = Math.ceil(total / limit);
    res.render('orders/index', { title: 'My Orders', orders, page: parseInt(page), pages, total, status: status || '' });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// GET /orders/new — place order page (shows menu)
router.get('/new', requireAuth, async (req, res) => {
  try {
    const filter = { isAvailable: true };
    const items  = await MenuItem.find(filter).sort({ category: 1, name: 1 });
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
    res.render('orders/new', { title: 'Place Order', grouped, error: null });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// GET /orders/stats — stats page (admin/faculty)
router.get('/stats', requireRole(['admin', 'faculty']), async (req, res) => {
  try {
    const [statusCounts, revenueData, topItems] = await Promise.all([
      Order.aggregate([{ $group: { _id: '$status', count: { $sum: 1 }, revenue: { $sum: '$total' } } }]),
      Order.aggregate([{ $match: { status: 'delivered' } }, { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } }]),
      Order.aggregate([{ $unwind: '$items' }, { $group: { _id: '$items.name', totalQty: { $sum: '$items.quantity' }, totalRevenue: { $sum: '$items.subtotal' } } }, { $sort: { totalQty: -1 } }, { $limit: 5 }]),
    ]);
    const byStatus = statusCounts.reduce((acc, s) => { acc[s._id] = { count: s.count, revenue: s.revenue }; return acc; }, {});
    res.render('orders/stats', { title: 'Order Stats', byStatus, totalRevenue: revenueData[0]?.total || 0, topItems });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// GET /orders/:id — detail
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('placedBy', 'name email role');
    if (!order) return res.redirect('/orders');
    if (req.session.userRole === 'student' && order.placedBy._id.toString() !== req.session.userId) return res.redirect('/orders');
    res.render('orders/detail', { title: `Order #${order.orderNumber}`, order, userRole: req.session.userRole });
  } catch (err) { res.redirect('/orders'); }
});

// POST /orders — place
router.post('/', requireAuth, orderRules, async (req, res) => {
  try {
    if (collectErrors(req, res)) {
      const menuItems = await MenuItem.find({ isAvailable: true }).sort({ category: 1, name: 1 });
      const grouped   = menuItems.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});
      return res.render('orders/new', { title: 'Place Order', grouped, error: res.locals.validationError });
    }

    // items[] comes as JSON string from form
    let items = [];
    try { items = JSON.parse(req.body.items || '[]'); } catch { /* ignore */ }
    // Also accept individual form fields: itemId[], qty[]
    if (!items.length && req.body.itemId) {
      const ids  = [].concat(req.body.itemId);
      const qtys = [].concat(req.body.qty);
      const notes = [].concat(req.body.specialNote || []);
      ids.forEach((id, i) => {
        if (parseInt(qtys[i]) > 0) items.push({ menuItemId: id, quantity: parseInt(qtys[i]), specialInstructions: notes[i] || '' });
      });
    }
    if (!items.length) {
      const menuItems = await MenuItem.find({ isAvailable: true }).sort({ category: 1, name: 1 });
      const grouped   = menuItems.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});
      return res.render('orders/new', { title: 'Place Order', grouped, error: 'Please add at least one item.' });
    }

    const orderItems = [];
    let   subtotal   = 0;
    for (const entry of items) {
      const menuItem = await MenuItem.findById(entry.menuItemId);
      if (!menuItem || !menuItem.isAvailable) continue;
      if (menuItem.stock !== null && menuItem.stock < entry.quantity) {
        const menuItems = await MenuItem.find({ isAvailable: true }).sort({ category: 1, name: 1 });
        const grouped   = menuItems.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});
        return res.render('orders/new', { title: 'Place Order', grouped, error: `Only ${menuItem.stock} units of "${menuItem.name}" available.` });
      }
      const itemSub = menuItem.price * entry.quantity;
      subtotal += itemSub;
      orderItems.push({ menuItem: menuItem._id, name: menuItem.name, price: menuItem.price, quantity: entry.quantity, subtotal: itemSub, specialInstructions: entry.specialInstructions || '' });
    }

    const tax   = parseFloat((subtotal * 0.05).toFixed(2));
    const total = parseFloat((subtotal + tax).toFixed(2));

    const order = await Order.create({
      placedBy: req.session.userId, placedByName: req.session.user.name, placedByRole: req.session.userRole,
      items: orderItems, subtotal, tax, total,
      deliveryLocation: req.body.deliveryLocation || '',
      notes: req.body.notes || '',
      estimatedReadyAt: new Date(Date.now() + 20 * 60000),
      statusHistory: [{ status: 'pending', changedBy: req.session.userId, changedByName: req.session.user.name, note: 'Order placed' }],
    });

    for (const entry of orderItems) {
      const mi = await MenuItem.findById(entry.menuItem);
      if (mi) await mi.decrementStock(entry.quantity).catch(() => {});
    }

    res.redirect(`/orders/${order._id}?success=Order+placed`);
  } catch (err) {
    console.error('Place order error:', err);
    const menuItems = await MenuItem.find({ isAvailable: true }).sort({ category: 1, name: 1 });
    const grouped   = menuItems.reduce((acc, item) => { if (!acc[item.category]) acc[item.category] = []; acc[item.category].push(item); return acc; }, {});
    res.render('orders/new', { title: 'Place Order', grouped, error: err.message });
  }
});

// GET /orders/:id/pay — payment page
router.get('/:id/pay', requireAuth, async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).populate('placedBy', 'name email role');
    if (!order) return res.redirect('/orders');
    if (order.placedBy._id.toString() !== req.session.userId) return res.redirect('/orders');
    if (order.paymentStatus === 'paid') return res.redirect(`/orders/${order._id}?success=Already+paid`);
    res.render('orders/payment', { title: `Pay for Order #${order.orderNumber}`, order });
  } catch (err) { res.redirect('/orders'); }
});

// POST /orders/:id/pay — simulate payment
router.post('/:id/pay', requireAuth, async (req, res) => {
  try {
    const { paymentMethod } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.redirect('/orders');
    if (order.placedBy.toString() !== req.session.userId) return res.redirect('/orders');
    if (order.paymentStatus === 'paid') return res.json({ ok: true, redirect: `/orders/${order._id}` });

    const allowed = ['upi', 'card', 'netbanking', 'cash'];
    const method  = allowed.includes(paymentMethod) ? paymentMethod : 'cash';

    await Order.findByIdAndUpdate(req.params.id, {
      paymentStatus: 'paid',
      paymentMethod: method,
      paidAt:        new Date(),
    });

    const io = req.app.get('io');
    try {
      await Notification.send({
        recipientId: req.session.userId,
        title: `Payment confirmed — ${order.orderNumber}`,
        body:  `₹${order.total.toFixed(2)} paid via ${method}. Your order is being processed.`,
        type:  'order',
        link:  `/orders/${order._id}`,
        io,
      });
    } catch(notifErr) { console.warn('Notification failed:', notifErr.message); }

    res.json({ ok: true, redirect: `/orders/${order._id}` });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// POST /orders/:id/status — update status
router.post('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status, note } = req.body;
    const order = await Order.findById(req.params.id);
    if (!order) return res.redirect('/orders');
    const isOwn = order.placedBy.toString() === req.session.userId;
    if (!order.canTransitionTo(status, req.session.userRole, isOwn))
      return res.redirect(`/orders/${req.params.id}?error=Invalid+status+transition`);

    const now = new Date();
    const tsMap = { confirmed: { confirmedAt: now }, ready: { readyAt: now }, delivered: { deliveredAt: now }, cancelled: { cancelledAt: now, cancelledBy: req.session.userId, cancellationReason: note || '' } };
    await Order.findByIdAndUpdate(req.params.id, { status, ...(tsMap[status] || {}), $push: { statusHistory: { status, changedBy: req.session.userId, changedByName: req.session.user.name, note: note || '', timestamp: now } } });

    if (status === 'cancelled') {
      for (const item of order.items) {
        const mi = await MenuItem.findById(item.menuItem);
        if (mi) await mi.restoreStock(item.quantity).catch(() => {});
      }
    }
// ── Emit real-time update + notification to order owner ──────────────────
    const io      = req.app.get('io');
    const ownerId = order.placedBy.toString();
    if (io) {
      io.to(`user:${ownerId}`).emit('order:statusUpdate', {
        orderId:       req.params.id,
        status,
        note:          note || '',
        changedByName: req.session.user.name,
        timestamp:     now.toISOString(),
      });
    }

    if (ownerId !== req.session.userId) {
      const statusLabels = { confirmed: 'confirmed', preparing: 'being prepared', ready: 'ready for pickup', delivered: 'delivered', cancelled: 'cancelled' };
      await Notification.send({
        recipientId: ownerId,
        title: `Order ${order.orderNumber} ${statusLabels[status] || status}`,
        body:  note ? `${req.session.user.name}: ${note}` : `Your order status was updated to "${status}".`,
        type:  'order',
        link:  `/orders/${req.params.id}`,
        io,
      });
    }

    res.redirect(`/orders/${req.params.id}?success=Status+updated`);
  } catch (err) { res.redirect(`/orders/${req.params.id}?error=${encodeURIComponent(err.message)}`); }
});

module.exports = router;