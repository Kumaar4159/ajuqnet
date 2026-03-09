'use strict';
const express    = require('express');
const router     = express.Router();
const Attendance = require('../models/Attendance');
const User       = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

// ── GET /attendance — role-based redirect ─────────────────────────────────────
router.get('/', requireAuth, (req, res) => {
  const role = req.session.userRole;
  if (role === 'student') return res.redirect('/attendance/view');
  if (role === 'faculty' || role === 'admin') return res.redirect('/attendance/mark');
  res.redirect('/dashboard');
});

// ── GET /attendance/mark — faculty: show mark form ────────────────────────────
router.get('/mark', requireRole(['faculty', 'admin']), async (req, res) => {
  try {
    const facultyDept = req.session.user?.department || null;
    const { department: filterDept, semester: filterSem } = req.query;

    // Build student filter — faculty see their dept by default
    const studentFilter = { role: 'student' };
    const activeDept = filterDept || (req.session.userRole === 'faculty' ? facultyDept : null);
    if (activeDept) studentFilter.department = activeDept;
    if (filterSem)  studentFilter.semester   = filterSem;

    const students = await User.find(studentFilter)
      .select('name email department studentId semester')
      .sort({ name: 1 });

    // Recent records this faculty marked (last 7 days)
    const since   = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const recent  = await Attendance.find({ markedBy: req.session.userId, date: { $gte: since } })
      .populate('student', 'name')
      .sort({ date: -1, createdAt: -1 })
      .limit(30);

    res.render('attendance/mark', {
      title:      'Mark Attendance',
      students,
      recent,
      today:      new Date().toISOString().slice(0, 10),
      success:    req.query.success || null,
      error:      req.query.error   || null,
      departments: ['Computer Science', 'Electrical & Electronics', 'Mechanical'],
      semesters:   ['1','2','3','4','5','6'],
      filterDept: activeDept || '',
      filterSem:  filterSem  || '',
    });
  } catch (err) {
    res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user });
  }
});

// ── POST /attendance/mark — faculty: save attendance records ──────────────────
router.post('/mark', requireRole(['faculty', 'admin']), async (req, res) => {
  try {
    const { subject, department, date, records } = req.body;

// Express parses bracket-notation fields (records[0][studentId]) as a keyed
// object, not an array. Normalise to a flat array regardless.
let recordsArr = [];
if (Array.isArray(records)) {
  recordsArr = records;
} else if (records && typeof records === 'object') {
  recordsArr = Object.values(records);
}

if (!subject || !date || !recordsArr.length)
  return res.redirect('/attendance/mark?error=Subject%2C+date+and+at+least+one+student+required');

const dateObj = new Date(date);
if (isNaN(dateObj.getTime()))
  return res.redirect('/attendance/mark?error=Invalid+date');

const ops = recordsArr.map(r => ({
      updateOne: {
        filter: {
          student: r.studentId,
          subject: subject.trim(),
          date:    dateObj,
        },
        update: {
          $set: {
            student:      r.studentId,
            studentName:  r.studentName || 'Unknown',
            markedBy:     req.session.userId,
            markedByName: req.session.user.name,
            subject:      subject.trim(),
            department:   department || '',
            date:         dateObj,
            status:       r.status || 'present',
            note:         r.note   || '',
          },
        },
        upsert: true,
      },
    }));

    await Attendance.bulkWrite(ops);
    res.redirect(`/attendance/mark?success=Attendance+saved+for+${ops.length}+student(s)`);
  } catch (err) {
    res.redirect(`/attendance/mark?error=${encodeURIComponent(err.message)}`);
  }
});

// ── GET /attendance/view — student: see own attendance ────────────────────────
router.get('/view', requireAuth, async (req, res) => {
  try {
    // Faculty/admin can also view — show all students list instead
    if (req.session.userRole === 'faculty' || req.session.userRole === 'admin') {
      return res.redirect('/attendance/report');
    }

    const { subject } = req.query;
    const summary = await Attendance.getSummary(req.session.userId, subject || null);

    // Raw records for the table (last 60 days)
    const since   = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
    const filter  = { student: req.session.userId, date: { $gte: since } };
    if (subject) filter.subject = subject;

    const records = await Attendance.find(filter).sort({ date: -1 }).limit(60).lean();

    res.render('attendance/view', {
      title:   'My Attendance',
      summary,
      records,
      subject: subject || '',
      success: req.query.success || null,
    });
  } catch (err) {
    res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user });
  }
});

// ── GET /attendance/report — faculty/admin: view any student's attendance ─────
router.get('/report', requireRole(['faculty', 'admin']), async (req, res) => {
  try {
    const { studentId, subject } = req.query;
    let summary = null;
    let records = [];
    let selectedStudent = null;

    const students = await User.find({ role: 'student' })
      .select('name email department studentId semester')
      .sort({ name: 1 });

    if (studentId) {
      selectedStudent = students.find(s => s._id.toString() === studentId);
      summary  = await Attendance.getSummary(studentId, subject || null);
      const filter = { student: studentId };
      if (subject) filter.subject = subject;
      records  = await Attendance.find(filter).sort({ date: -1 }).limit(100).lean();
    }

    res.render('attendance/report', {
      title:           'Attendance Report',
      students,
      selectedStudent,
      summary,
      records,
      subject:         subject || '',
      selectedStudentId: studentId || '',
    });
  } catch (err) {
    res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user });
  }
});

module.exports = router;