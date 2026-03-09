'use strict';
const express = require('express');
const router  = express.Router();
const Table   = require('../models/Table');
const Booking = require('../models/Booking');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /tables
router.get('/', requireAuth, async (req, res) => {
  try {
    const { section, minCapacity } = req.query;
    const filter = {};
    if (req.session.userRole === 'student') { filter.isActive = true; filter.isUnderMaintenance = false; }
    if (section)     filter.section  = section;
    if (minCapacity) filter.capacity = { $gte: parseInt(minCapacity) };
    const tables = await Table.find(filter).sort({ section: 1, tableNumber: 1 });
    // Get all currently active bookings to show booked status on listing
    const activeBookings = await Booking.find({
      status: { $in: ['pending', 'confirmed', 'checked_in'] },
      startTime: { $lte: new Date() },
      endTime:   { $gte: new Date() },
    }).select('table').lean();
    const bookedTableIds = new Set(activeBookings.map(b => b.table.toString()));
    const sections = ['indoor', 'outdoor', 'rooftop', 'private', 'cafeteria'];
    res.render('tables/index', { title: 'Tables', tables, sections, filter: { section, minCapacity }, bookedTableIds: [...bookedTableIds] });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// GET /tables/new — admin only
router.get('/new', requireRole('admin'), (req, res) => {
  res.render('tables/form', { title: 'Add Table', table: null, error: null });
});

// GET /tables/:id/edit — admin only
router.get('/:id/edit', requireRole('admin'), async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.redirect('/tables');
    res.render('tables/form', { title: 'Edit Table', table, error: null });
  } catch { res.redirect('/tables'); }
});

// GET /tables/:id — detail / availability
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const table = await Table.findById(req.params.id);
    if (!table) return res.redirect('/tables');
    if (req.session.userRole === 'student' && !table.isActive) return res.redirect('/tables');
    // upcoming confirmed bookings for this table
    const bookings = await Booking.find({
      table: table._id,
      startTime: { $gte: new Date() },
      status: { $in: ['pending', 'confirmed', 'checked_in'] },
    }).populate('bookedBy', 'name').sort({ startTime: 1 }).limit(10);
    res.render('tables/detail', { title: `Table ${table.tableNumber}`, table, bookings });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// POST /tables — create
router.post('/', requireRole('admin'), async (req, res) => {
  try {
    const { tableNumber, section, capacity, description, floor } = req.body;
    const amenities = [].concat(req.body.amenities || []);
    if (!tableNumber || !section || !capacity)
      return res.render('tables/form', { title: 'Add Table', table: null, error: 'Table number, section and capacity are required.' });
    await Table.create({ tableNumber, section, capacity: parseInt(capacity), description, amenities, floor: parseInt(floor) || 1, createdBy: req.session.userId });
    res.redirect('/tables?success=Table+added');
  } catch (err) {
    const msg = err.code === 11000 ? `Table "${req.body.tableNumber}" already exists.` : (err.name === 'ValidationError' ? Object.values(err.errors).map(e => e.message).join(' ') : err.message);
    res.render('tables/form', { title: 'Add Table', table: null, error: msg });
  }
});

// POST /tables/:id/update
router.post('/:id/update', requireRole('admin'), async (req, res) => {
  try {
    const { section, capacity, description, floor, isActive } = req.body;
    const amenities = [].concat(req.body.amenities || []);
    await Table.findByIdAndUpdate(req.params.id, { section, capacity: parseInt(capacity), description, amenities, floor: parseInt(floor) || 1, isActive: !!isActive, updatedBy: req.session.userId }, { runValidators: true });
    res.redirect('/tables?success=Table+updated');
  } catch (err) {
    const table = await Table.findById(req.params.id).catch(() => null);
    res.render('tables/form', { title: 'Edit Table', table, error: err.message });
  }
});

// POST /tables/:id/maintenance — toggle maintenance
router.post('/:id/maintenance', requireRole(['admin']), async (req, res) => {
  try {
    const { isUnderMaintenance, maintenanceNote } = req.body;
    await Table.findByIdAndUpdate(req.params.id, { isUnderMaintenance: isUnderMaintenance === '1', maintenanceNote: maintenanceNote || '', updatedBy: req.session.userId });
    res.redirect('/tables?success=Table+updated');
  } catch (err) { res.redirect('/tables?error=' + encodeURIComponent(err.message)); }
});

// POST /tables/:id/delete
router.post('/:id/delete', requireRole('admin'), async (req, res) => {
  try {
    const active = await Booking.countDocuments({ table: req.params.id, status: { $in: ['pending', 'confirmed', 'checked_in'] } });
    if (active > 0) return res.redirect('/tables?error=Table+has+active+bookings');
    await Table.findByIdAndDelete(req.params.id);
    res.redirect('/tables?success=Table+deleted');
  } catch { res.redirect('/tables?error=Delete+failed'); }
});

module.exports = router;
