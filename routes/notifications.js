'use strict';
const express      = require('express');
const router       = express.Router();
const Notification = require('../models/Notification');
const { requireAuth } = require('../middleware/auth');

// GET /notifications — fetch latest 30 (JSON)
router.get('/', requireAuth, async (req, res) => {
  try {
    const notifications = await Notification.find({ recipient: req.session.userId })
      .sort({ createdAt: -1 }).limit(30).lean();
    const unreadCount = await Notification.countDocuments({ recipient: req.session.userId, read: false });
    res.json({ notifications, unreadCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// POST /notifications/mark-read — mark one or all as read
router.post('/mark-read', requireAuth, async (req, res) => {
  try {
    const { id } = req.body;
    const filter = id
      ? { _id: id, recipient: req.session.userId }
      : { recipient: req.session.userId, read: false };
    await Notification.updateMany(filter, { $set: { read: true } });
    const unreadCount = await Notification.countDocuments({ recipient: req.session.userId, read: false });
    res.json({ ok: true, unreadCount });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE /notifications/clear — delete all read notifications
router.delete('/clear', requireAuth, async (req, res) => {
  try {
    await Notification.deleteMany({ recipient: req.session.userId, read: true });
    res.json({ ok: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;