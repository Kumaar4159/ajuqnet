'use strict';
const express  = require('express');
const router   = express.Router();
const ChatRoom = require('../models/ChatRoom');
const Message  = require('../models/Message');
const User     = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');
const { encrypt, safeDecrypt }     = require('../utils/encryption');

function decryptMessages(messages) {
  return messages.map(msg => {
    const obj = msg.toObject ? msg.toObject() : { ...msg };
    obj.content = msg.isDeleted ? null : safeDecrypt(msg.encryptedContent);
    delete obj.encryptedContent;
    delete obj.editHistory;
    return obj;
  });
}

// GET /chat — room list
router.get('/', requireAuth, async (req, res) => {
  try {
    const rooms = await ChatRoom.find({
      isActive: true,
      allowedRoles: req.session.userRole,
      'members.user': req.session.userId,
    }).sort({ lastMessageAt: -1, createdAt: -1 });
    res.render('chat/index', { title: 'Chat Rooms', rooms });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// GET /chat/room/:id — enter a room (full-page chat)
router.get('/room/:id', requireAuth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.id).populate('members.user', 'name role');
    if (!room || !room.isActive) return res.redirect('/chat');
    if (!room.allowedRoles.includes(req.session.userRole)) return res.redirect('/chat');
    const isMember = room.members.some(m => m.user._id.toString() === req.session.userId);
    if (!isMember) return res.redirect('/chat');

    // Load last 40 messages
    const rawMessages = await Message.find({ room: room._id })
      .sort({ createdAt: -1 }).limit(40)
      .populate('replyTo', 'senderName encryptedContent isDeleted');
    const messages = decryptMessages(rawMessages.reverse());
    messages.forEach((msg, j) => {
      const raw = rawMessages[rawMessages.length - 1 - j];
      if (raw?.replyTo && !raw.replyTo.isDeleted) {
        msg.replyTo = {
          _id:        raw.replyTo._id,
          senderName: raw.replyTo.senderName,
          content:    safeDecrypt(raw.replyTo.encryptedContent),
        };
      }
    });

    // All accessible rooms for sidebar
    const allRooms = await ChatRoom.find({
      isActive: true,
      allowedRoles: req.session.userRole,
      'members.user': req.session.userId,
    }).sort({ lastMessageAt: -1 });

    res.render('chat/room', { title: room.name, room, messages, allRooms });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// POST /chat/rooms — create group room (admin/faculty)
router.post('/rooms', requireRole(['admin', 'faculty']), async (req, res) => {
  try {
    const { name, description, type = 'public' } = req.body;
    const allowedRoles = [].concat(req.body.allowedRoles || ['admin', 'faculty', 'student']);
    if (!name) return res.redirect('/chat?error=Room+name+required');
    await ChatRoom.create({ name, description, type, allowedRoles, createdBy: req.session.userId, members: [{ user: req.session.userId, role: req.session.userRole, isAdmin: true }] });
    res.redirect('/chat?success=Room+created');
  } catch (err) { res.redirect('/chat?error=' + encodeURIComponent(err.message)); }
});

// POST /chat/direct — open or find DM
router.post('/direct', requireAuth, async (req, res) => {
  try {
    const { targetUserId } = req.body;
    if (!targetUserId || targetUserId === req.session.userId) return res.redirect('/chat?error=Invalid+user');
    const [me, target] = await Promise.all([
      User.findById(req.session.userId).select('name role'),
      User.findById(targetUserId).select('name role'),
    ]);
    if (!target) return res.redirect('/chat?error=User+not+found');
    const { room } = await ChatRoom.findOrCreateDirect(me, target, me.name);
    res.redirect(`/chat/room/${room._id}`);
  } catch (err) { res.redirect('/chat?error=' + encodeURIComponent(err.message)); }
});

// ── JSON API endpoints used by the chat JS client ─────────────────────────────

// GET /chat/api/rooms/:id/messages?before=&limit=
router.get('/api/rooms/:id/messages', requireAuth, async (req, res) => {
  try {
    const room = await ChatRoom.findById(req.params.id);
    if (!room || !room.isActive || !room.allowedRoles.includes(req.session.userRole))
      return res.status(403).json({ success: false, message: 'Access denied' });
    const isMember = room.members.some(m => m.user.toString() === req.session.userId);
    if (!isMember) return res.status(403).json({ success: false, message: 'Not a member' });
    const limit = Math.min(parseInt(req.query.limit) || 40, 100);
    const query = { room: req.params.id };
    if (req.query.before) query._id = { $lt: req.query.before };
    const raw = await Message.find(query).sort({ createdAt: -1 }).limit(limit).populate('replyTo', 'senderName encryptedContent isDeleted');
    const messages = decryptMessages(raw.reverse());
    messages.forEach((msg, j) => {
      const r = raw[raw.length - 1 - j]?.replyTo;
      if (r && !r.isDeleted) msg.replyTo = { _id: r._id, senderName: r.senderName, content: safeDecrypt(r.encryptedContent) };
    });
    res.json({ success: true, messages, hasMore: raw.length === limit, cursor: raw.length > 0 ? raw[0]._id : null });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

// GET /chat/api/users/search?q=
router.get('/api/users/search', requireAuth, async (req, res) => {
  try {
    const q = req.query.q?.trim() || '';
    const filter = { isActive: true, _id: { $ne: req.session.userId } };
    if (q) filter.$or = [{ name: { $regex: q, $options: 'i' } }, { email: { $regex: q, $options: 'i' } }];
    const users = await User.find(filter).select('name email role department').limit(20).sort({ name: 1 });
    res.json({ success: true, users });
  } catch (err) { res.status(500).json({ success: false, message: err.message }); }
});

module.exports = router;