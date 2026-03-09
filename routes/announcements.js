'use strict';
const express      = require('express');
const router       = express.Router();
const Announcement = require('../models/Announcement');
const Notification = require('../models/Notification');
const User         = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

// ── GET /announcements — list active announcements ────────────────────────────
router.get('/', requireAuth, async (req, res) => {
  try {
    const dept          = req.session.user?.department || null;
    const announcements = await Announcement.getActive(dept).limit(50);
    res.render('announcements/index', {
      title: 'Announcements',
      announcements,
      canCreate: ['admin', 'faculty'].includes(req.session.userRole),
      success:   req.query.success || null,
      error:     req.query.error   || null,
    });
  } catch (err) {
    res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user });
  }
});

// ── GET /announcements/new — create form (faculty + admin) ────────────────────
router.get('/new', requireRole(['faculty', 'admin']), (req, res) => {
  res.render('announcements/new', {
    title: 'New Announcement',
    error: null,
    prefill: {},
  });
});

// ── POST /announcements — create ──────────────────────────────────────────────
router.post('/', requireRole(['faculty', 'admin']), async (req, res) => {
  try {
    const { title, message, department, priority, expiresAt, pinned } = req.body;

    if (!title?.trim() || !message?.trim())
      return res.render('announcements/new', {
        title:   'New Announcement',
        error:   'Title and message are required.',
        prefill: req.body,
      });

    // Handle file attachment (base64 from client)
    let attachment = { filename: null, contentType: null, data: null, size: null };
    if (req.body.attachData && req.body.attachName) {
      const dataUrl = req.body.attachData;
      const base64  = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl;
      attachment = {
        filename:    req.body.attachName,
        contentType: req.body.attachType || 'application/octet-stream',
        data:        base64,
        size:        parseInt(req.body.attachSize) || 0,
      };
    }

    const ann = await Announcement.create({
      title:         title.trim(),
      message:       message.trim(),
      department:    department?.trim() || 'all',
      priority:      priority || 'info',
      expiresAt:     expiresAt ? new Date(expiresAt) : null,
      pinned:        pinned === 'on',
      createdBy:     req.session.userId,
      createdByName: req.session.user.name,
      createdByRole: req.session.userRole,
      attachment,
    });

    // Push a notification to every student (or department-targeted students)
    const io       = req.app.get('io');
    const filter   = { role: 'student', isActive: true };
    if (ann.department !== 'all') filter.department = ann.department;
    const students = await User.find(filter).select('_id').lean();

    await Promise.all(
      students.map(s =>
        Notification.send({
          recipientId: s._id.toString(),
          title:       `📢 ${ann.title}`,
          body:        ann.message.substring(0, 120) + (ann.message.length > 120 ? '…' : ''),
          type:        'system',
          link:        '/announcements',
          io,
        }).catch(() => {})   // don't fail if one notification errors
      )
    );

    res.redirect('/announcements?success=Announcement+published');
  } catch (err) {
    res.render('announcements/new', {
      title:   'New Announcement',
      error:   err.message,
      prefill: req.body,
    });
  }
});

// ── DELETE /announcements/:id — remove (admin only) ───────────────────────────
router.post('/:id/delete', requireRole(['admin', 'faculty']), async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id);
    if (!ann) return res.redirect('/announcements?error=Not+found');

    // Faculty can only delete their own; admin can delete any
    if (req.session.userRole === 'faculty' && ann.createdBy.toString() !== req.session.userId)
      return res.redirect('/announcements?error=Not+authorised');

    await Announcement.findByIdAndDelete(req.params.id);
    res.redirect('/announcements?success=Announcement+deleted');
  } catch (err) {
    res.redirect(`/announcements?error=${encodeURIComponent(err.message)}`);
  }
});

// GET /announcements/:id/attachment — download attachment
router.get('/:id/attachment', requireAuth, async (req, res) => {
  try {
    const ann = await Announcement.findById(req.params.id).select('attachment');
    if (!ann || !ann.attachment?.data) return res.status(404).send('No attachment found');
    const buf = Buffer.from(ann.attachment.data, 'base64');
    res.set('Content-Type', ann.attachment.contentType || 'application/octet-stream');
    res.set('Content-Disposition', 'attachment; filename="' + (ann.attachment.filename || 'file') + '"');
    res.send(buf);
  } catch (err) {
    res.status(500).send(err.message);
  }
});

module.exports = router;