'use strict';
const express  = require('express');
const router   = express.Router();
const Subject  = require('../models/Subject');
const User     = require('../models/User');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /subjects — admin: list all subjects with assignment info
router.get('/', requireRole('admin'), async (req, res) => {
  try {
    const { department, semester } = req.query;
    const filter = {};
    if (department) filter.department = department;
    if (semester)   filter.semester   = semester;

    const subjects = await Subject.find(filter)
      .populate('assignedFaculty', 'name email')
      .sort({ department: 1, semester: 1, code: 1 });

    const faculty = await User.find({ role: 'faculty' }).select('name email department').sort({ name: 1 });

    res.render('subjects/index', {
      title:      'Subject Management',
      subjects,
      faculty,
      departments: ['Computer Science', 'Electrical & Electronics', 'Mechanical'],
      semesters:   ['1','2','3','4','5','6'],
      filterDept: department || '',
      filterSem:  semester   || '',
    });
  } catch (err) {
    res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user });
  }
});

// POST /subjects/create — admin: create a new subject
router.post('/create', requireRole('admin'), async (req, res) => {
  try {
    const { name, code, department, semester } = req.body;
    if (!name || !code || !department || !semester)
      return res.redirect('/subjects?error=All+fields+are+required+to+create+a+subject');

    const exists = await Subject.findOne({ code: code.toUpperCase().trim(), department });
    if (exists)
      return res.redirect('/subjects?error=A+subject+with+this+code+already+exists+in+that+department');

    await Subject.create({ name: name.trim(), code: code.toUpperCase().trim(), department, semester });
    res.redirect('/subjects?success=Subject+created+successfully');
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(' ');
      return res.redirect(`/subjects?error=${encodeURIComponent(msg)}`);
    }
    res.redirect(`/subjects?error=${encodeURIComponent(err.message)}`);
  }
});

// POST /subjects/:id/assign — admin: assign a faculty to a subject
router.post('/:id/assign', requireRole('admin'), async (req, res) => {
  try {
    const { facultyId } = req.body;
    const subject = await Subject.findById(req.params.id);
    if (!subject) return res.redirect('/subjects?error=Subject+not+found');

    if (facultyId) {
      const fac = await User.findById(facultyId);
      if (!fac || fac.role !== 'faculty') return res.redirect('/subjects?error=Invalid+faculty');
      subject.assignedFaculty     = fac._id;
      subject.assignedFacultyName = fac.name;
    } else {
      subject.assignedFaculty     = null;
      subject.assignedFacultyName = null;
    }
    await subject.save();
    res.redirect('/subjects?success=Subject+assignment+updated');
  } catch (err) {
    res.redirect(`/subjects?error=${encodeURIComponent(err.message)}`);
  }
});

// POST /subjects/:id/delete — admin: delete a subject
router.post('/:id/delete', requireRole('admin'), async (req, res) => {
  try {
    await Subject.findByIdAndDelete(req.params.id);
    res.redirect('/subjects?success=Subject+deleted+successfully');
  } catch (err) {
    res.redirect(`/subjects?error=${encodeURIComponent(err.message)}`);
  }
});

// GET /subjects/api/my-subjects — faculty: get their subjects for dept+semester (JSON)
router.get('/api/my-subjects', requireRole(['faculty', 'admin']), async (req, res) => {
  try {
    const { department, semester } = req.query;
    if (!department || !semester) return res.json({ subjects: [] });

    const subjects = await Subject.find({
      assignedFaculty: req.session.userId,
      department,
      semester,
      isActive: true,
    }).select('name code').sort({ code: 1 });

    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /subjects/api/dept-subjects — get subjects for a dept+semester (JSON, any auth)
router.get('/api/dept-subjects', requireAuth, async (req, res) => {
  try {
    const { department, semester } = req.query;
    if (!department || !semester) return res.json({ subjects: [] });

    const subjects = await Subject.find({ department, semester, isActive: true })
      .select('name code assignedFacultyName')
      .sort({ code: 1 });

    res.json({ subjects });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
