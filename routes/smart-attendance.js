'use strict';

const express          = require('express');
const router           = express.Router();
const QRCode           = require('qrcode');
const { requireAuth, requireRole } = require('../middleware/auth');
const AttendanceSession = require('../models/AttendanceSession');
const AttendanceRecord  = require('../models/AttendanceRecord');
const User              = require('../models/User');

// ── Helper: haversine distance in metres ─────────────────────────────────────
function haversineMetres(lat1, lng1, lat2, lng2) {
  const R  = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a  = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── STUDENT: GET face setup page ──────────────────────────────────────────────
router.get('/face-setup',
  requireAuth,
  requireRole('student'),
  (req, res) => {
    res.render('smart-attendance/face-setup', {
      title: 'Face Profile Setup',
      flash: res.locals.flash,
    });
  }
);

// ── FACULTY: GET start-session form ──────────────────────────────────────────
router.get('/start-session',
  requireAuth,
  requireRole(['faculty', 'admin']),
  (req, res) => {
    res.render('smart-attendance/start-session', {
      title: 'Start Class Session',
      flash: res.locals.flash,
    });
  }
);

// ── FACULTY: POST create session + generate QR ───────────────────────────────
router.post('/start-session',
  requireAuth,
  requireRole(['faculty', 'admin']),
  async (req, res) => {
    try {
      const { subject, department, semester, room, duration, teacherLat, teacherLng } = req.body;

      if (!subject || !department || !semester || !room || !duration) {
        return res.redirect('/smart-attendance/start-session?error=All+fields+are+required');
      }

      const durationMinutes = parseInt(duration, 10);
      if (isNaN(durationMinutes) || durationMinutes < 10 || durationMinutes > 300) {
        return res.redirect('/smart-attendance/start-session?error=Duration+must+be+10–300+minutes');
      }

      const qrToken = AttendanceSession.generateToken();

      const session = await AttendanceSession.create({
        subject:    subject.trim(),
        department: department.trim(),
        semester:   semester.trim(),
        room:       room.trim(),
        facultyId:  req.session.userId,
        facultyName: req.session.user.name,
        durationMinutes,
        qrToken,
        teacherLocation: {
          lat: parseFloat(teacherLat) || null,
          lng: parseFloat(teacherLng) || null,
        },
      });

      res.redirect(`/smart-attendance/qr/${session._id}`);
    } catch (err) {
      console.error('[smart-attendance] start-session POST error:', err);
      res.redirect('/smart-attendance/start-session?error=Failed+to+create+session');
    }
  }
);

// ── FACULTY: GET QR display page ─────────────────────────────────────────────
router.get('/qr/:sessionId',
  requireAuth,
  requireRole(['faculty', 'admin']),
  async (req, res) => {
    try {
      const session = await AttendanceSession.findById(req.params.sessionId).lean({ virtuals: true });
      if (!session) return res.redirect('/smart-attendance/start-session?error=Session+not+found');

      // Only the faculty who created it (or admin) may view
      if (session.facultyId.toString() !== req.session.userId && req.session.userRole !== 'admin') {
        return res.redirect('/smart-attendance/start-session?error=Not+authorised');
      }

      // Build QR payload
      const qrPayload = JSON.stringify({
        sessionId: session._id.toString(),
        token:     session.qrToken,
        lat:       session.teacherLocation?.lat,
        lng:       session.teacherLocation?.lng,
        ts:        session.startTime,
      });

      // Generate a data-URL QR image
      const qrDataUrl = await QRCode.toDataURL(qrPayload, {
        errorCorrectionLevel: 'H',
        width: 400,
        margin: 2,
        color: { dark: '#1e293b', light: '#ffffff' },
      });

      res.render('smart-attendance/qr-display', {
        title: 'Class QR Code',
        session,
        qrDataUrl,
        flash: res.locals.flash,
      });
    } catch (err) {
      console.error('[smart-attendance] qr GET error:', err);
      res.redirect('/smart-attendance/start-session?error=Failed+to+load+QR');
    }
  }
);

// ── FACULTY: POST close session early ────────────────────────────────────────
router.post('/close/:sessionId',
  requireAuth,
  requireRole(['faculty', 'admin']),
  async (req, res) => {
    try {
      const session = await AttendanceSession.findById(req.params.sessionId);
      if (!session) return res.json({ ok: false, error: 'Not found' });
      if (session.facultyId.toString() !== req.session.userId && req.session.userRole !== 'admin') {
        return res.json({ ok: false, error: 'Not authorised' });
      }
      session.status = 'closed';
      await session.save();
      res.json({ ok: true });
    } catch (err) {
      res.json({ ok: false, error: err.message });
    }
  }
);

// ── FACULTY: POST delete session ─────────────────────────────────────────────
router.post('/delete/:sessionId',
  requireAuth,
  requireRole(['faculty', 'admin']),
  async (req, res) => {
    try {
      const session = await AttendanceSession.findById(req.params.sessionId);
      if (!session) return res.redirect('/smart-attendance/my-sessions?error=Session+not+found');
      if (session.facultyId.toString() !== req.session.userId && req.session.userRole !== 'admin') {
        return res.redirect('/smart-attendance/my-sessions?error=Not+authorised');
      }
      await AttendanceSession.findByIdAndDelete(req.params.sessionId);
      res.redirect('/smart-attendance/my-sessions?success=Session+deleted');
    } catch (err) {
      res.redirect('/smart-attendance/my-sessions?error=' + encodeURIComponent(err.message));
    }
  }
);

// ── STUDENT: GET scan page (from QR link or manual) ──────────────────────────
router.get('/scan',
  requireAuth,
  requireRole('student'),
  (req, res) => {
    res.render('smart-attendance/scan-attendance', {
      title: 'Scan Attendance QR',
      flash: res.locals.flash,
      prefillToken: req.query.token || '',
      prefillSession: req.query.session || '',
    });
  }
);

// ── STUDENT: POST submit attendance ──────────────────────────────────────────
router.post('/submit',
  requireAuth,
  requireRole('student'),
  async (req, res) => {
    try {
      const { sessionId, qrToken, studentLat, studentLng, faceVerified, faceScore } = req.body;

      // 1. Load session
      const session = await AttendanceSession.findById(sessionId);
      if (!session) {
        return res.json({ ok: false, error: 'Session not found. Ask your teacher to re-share the QR.' });
      }

      // 2. Token check
      if (session.qrToken !== qrToken) {
        return res.json({ ok: false, error: 'Invalid QR token.' });
      }

      // 3. Expiry check
      const expiresAt = new Date(session.startTime.getTime() + session.durationMinutes * 60 * 1000);
      if (Date.now() > expiresAt.getTime()) {
        return res.json({ ok: false, error: 'This QR code has expired. The class session has ended.' });
      }

      // 4. Session status check
      if (session.status !== 'active') {
        return res.json({ ok: false, error: 'This session has been closed by your teacher.' });
      }

      // 5. Duplicate check
      const existing = await AttendanceRecord.findOne({ sessionId, studentId: req.session.userId });
      if (existing) {
        return res.json({
          ok: false,
          error: existing.status === 'present'
            ? 'You have already marked attendance for this class.'
            : 'You already attempted attendance for this class (rejected). Contact your teacher.',
        });
      }

      // 6. Location verification
      const RADIUS_METRES = parseInt(process.env.ATTENDANCE_RADIUS_METRES) || 100;
      let locationOk   = false;
      let distanceMetres = null;

      const sLat = parseFloat(studentLat);
      const sLng = parseFloat(studentLng);
      const tLat = session.teacherLocation?.lat;
      const tLng = session.teacherLocation?.lng;

      if (tLat && tLng && !isNaN(sLat) && !isNaN(sLng)) {
        distanceMetres = Math.round(haversineMetres(sLat, sLng, tLat, tLng));
        locationOk = distanceMetres <= RADIUS_METRES;
      } else if (!tLat || !tLng) {
        // Teacher didn't share GPS — skip location check
        locationOk = true;
      }

      // 7. Face verification (client sends result)
      const faceOk    = faceVerified === 'true' || faceVerified === true;
      const faceScoreNum = parseFloat(faceScore) || null;

      // 8. Determine status
      const bothPassed = faceOk && locationOk;
      const status     = bothPassed ? 'present' : 'rejected';

      // 9. Save record
      const student = await User.findById(req.session.userId).lean();
      await AttendanceRecord.create({
        sessionId,
        studentId:   req.session.userId,
        studentName: student.name,
        verificationType: { face: faceOk, location: locationOk },
        status,
        distanceMetres,
        faceScore:   faceScoreNum,
        ipAddress:   req.ip,
      });

      if (bothPassed) {
        return res.json({ ok: true, message: 'Attendance marked successfully! ✅' });
      }

      const reasons = [];
      if (!faceOk)      reasons.push('face not recognised');
      if (!locationOk)  reasons.push(`location too far (${distanceMetres}m from classroom)`);
      return res.json({
        ok:     false,
        error:  `Attendance rejected: ${reasons.join(' and ')}. Your attempt has been recorded.`,
        detail: { faceOk, locationOk, distanceMetres },
      });

    } catch (err) {
      console.error('[smart-attendance] submit error:', err);
      if (err.code === 11000) {
        return res.json({ ok: false, error: 'You have already submitted attendance for this class.' });
      }
      res.json({ ok: false, error: 'Server error. Please try again.' });
    }
  }
);

// ── STUDENT: GET analytics report ────────────────────────────────────────────
router.get('/student-report',
  requireAuth,
  requireRole('student'),
  async (req, res) => {
    try {
      const analytics = await AttendanceRecord.getStudentAnalytics(req.session.userId);
      res.render('smart-attendance/student-report', {
        title:     'My Smart Attendance',
        analytics,
        flash:     res.locals.flash,
      });
    } catch (err) {
      console.error('[smart-attendance] student-report error:', err);
      res.redirect('/dashboard?error=Failed+to+load+attendance');
    }
  }
);

// ── FACULTY: GET report for a specific session ────────────────────────────────
router.get('/faculty-report/:sessionId',
  requireAuth,
  requireRole(['faculty', 'admin']),
  async (req, res) => {
    try {
      const session = await AttendanceSession.findById(req.params.sessionId).lean({ virtuals: true });
      if (!session) return res.redirect('/smart-attendance/my-sessions?error=Session+not+found');

      const analytics = await AttendanceRecord.getSessionAnalytics(req.params.sessionId);

      res.render('smart-attendance/faculty-report', {
        title:     `Report: ${session.subject}`,
        session,
        analytics,
        flash:     res.locals.flash,
      });
    } catch (err) {
      console.error('[smart-attendance] faculty-report error:', err);
      res.redirect('/smart-attendance/my-sessions?error=Failed+to+load+report');
    }
  }
);

// ── FACULTY: GET list of my sessions ─────────────────────────────────────────
router.get('/my-sessions',
  requireAuth,
  requireRole(['faculty', 'admin']),
  async (req, res) => {
    try {
      const query = req.session.userRole === 'admin'
        ? {}
        : { facultyId: req.session.userId };

      const sessions = await AttendanceSession.find(query)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean({ virtuals: true });

      // Attach attendance counts
      const sessionIds = sessions.map(s => s._id);
      const counts = await AttendanceRecord.aggregate([
        { $match: { sessionId: { $in: sessionIds } } },
        { $group: { _id: '$sessionId', total: { $sum: 1 }, present: { $sum: { $cond: [{ $eq: ['$status','present'] }, 1, 0] } } } },
      ]);
      const countMap = {};
      counts.forEach(c => { countMap[c._id.toString()] = c; });
      sessions.forEach(s => {
        const c = countMap[s._id.toString()] || { total: 0, present: 0 };
        s.attendanceCount   = c.total;
        s.presentCount      = c.present;
        s.attendancePct     = c.total > 0 ? Math.round(c.present / c.total * 100) : null;
      });

      res.render('smart-attendance/my-sessions', {
        title:    'My Class Sessions',
        sessions,
        flash:    res.locals.flash,
      });
    } catch (err) {
      console.error('[smart-attendance] my-sessions error:', err);
      res.redirect('/dashboard?error=Failed+to+load+sessions');
    }
  }
);

// ── ADMIN: GET analytics dashboard ───────────────────────────────────────────
router.get('/admin-analytics',
  requireAuth,
  requireRole('admin'),
  async (req, res) => {
    try {
      // Department breakdown
      const deptStats = await AttendanceRecord.aggregate([
        {
          $lookup: {
            from:         'attendancesessions',
            localField:   'sessionId',
            foreignField: '_id',
            as:           'session',
          },
        },
        { $unwind: '$session' },
        {
          $group: {
            _id:     '$session.department',
            total:   { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Daily trend (last 14 days)
      const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const dailyTrend = await AttendanceRecord.aggregate([
        { $match: { timestamp: { $gte: fourteenDaysAgo } } },
        {
          $group: {
            _id:     { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
            total:   { $sum: 1 },
            present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
          },
        },
        { $sort: { _id: 1 } },
      ]);

      // Top sessions today
      const todayStart = new Date(); todayStart.setHours(0,0,0,0);
      const todaySessions = await AttendanceSession.find({ startTime: { $gte: todayStart } })
        .sort({ startTime: -1 })
        .limit(10)
        .lean();

      const totalSessions = await AttendanceSession.countDocuments();
      const totalRecords  = await AttendanceRecord.countDocuments();
      const presentCount  = await AttendanceRecord.countDocuments({ status: 'present' });

      res.render('smart-attendance/admin-analytics', {
        title:         'Attendance Analytics',
        deptStats,
        dailyTrend,
        todaySessions,
        totalSessions,
        totalRecords,
        presentCount,
        overallPct: totalRecords > 0 ? Math.round(presentCount / totalRecords * 100) : 0,
        flash: res.locals.flash,
      });
    } catch (err) {
      console.error('[smart-attendance] admin-analytics error:', err);
      res.redirect('/dashboard?error=Failed+to+load+analytics');
    }
  }
);

// ── API: check session status (used by QR page auto-refresh) ─────────────────
router.get('/api/session-status/:sessionId',
  requireAuth,
  async (req, res) => {
    try {
      const session = await AttendanceSession.findById(req.params.sessionId).lean({ virtuals: true });
      if (!session) return res.json({ ok: false });
      res.json({
        ok:        true,
        status:    session.status,
        isExpired: session.isExpired,
        expiresAt: session.expiresAt,
        present:   await AttendanceRecord.countDocuments({ sessionId: session._id, status: 'present' }),
        total:     await AttendanceRecord.countDocuments({ sessionId: session._id }),
      });
    } catch (err) {
      res.json({ ok: false });
    }
  }
);

module.exports = router;