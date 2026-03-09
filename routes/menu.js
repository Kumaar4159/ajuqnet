'use strict';
const express  = require('express');
const router   = express.Router();
const MenuItem = require('../models/MenuItem');
const Order    = require('../models/Order');
const { requireAuth, requireRole } = require('../middleware/auth');

// GET /menu — browse menu
router.get('/', requireAuth, async (req, res) => {
  try {
    const { category, vegetarian } = req.query;
    const filter = req.session.userRole === 'student' ? { isAvailable: true } : {};
    if (category)            filter.category     = category;
    if (vegetarian === '1')  filter.isVegetarian = true;

    const items   = await MenuItem.find(filter).populate('createdBy', 'name').sort({ category: 1, name: 1 });
    const grouped = items.reduce((acc, item) => {
      if (!acc[item.category]) acc[item.category] = [];
      acc[item.category].push(item);
      return acc;
    }, {});
    const categories = ['breakfast', 'lunch', 'dinner', 'snacks', 'beverages', 'desserts', 'specials'];
    res.render('menu/index', { title: 'Canteen Menu', grouped, categories, filter: { category, vegetarian } });
  } catch (err) { res.render('error', { title: 'Error', code: 500, message: err.message, user: req.session.user }); }
});

// GET /menu/new — add item form (admin/faculty)
router.get('/new', requireRole(['admin']), (req, res) => {
  res.render('menu/form', { title: 'Add Menu Item', item: null, error: null });
});

// GET /menu/:id/edit — edit form
router.get('/:id/edit', requireRole(['admin']), async (req, res) => {
  try {
    const item = await MenuItem.findById(req.params.id);
    if (!item) return res.redirect('/menu');
    res.render('menu/form', { title: 'Edit Menu Item', item, error: null });
  } catch (err) { res.redirect('/menu'); }
});

// POST /menu — create
router.post('/', requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, category, price, isVegetarian, preparationTime, stock } = req.body;
    if (!name || !category || !price)
      return res.render('menu/form', { title: 'Add Menu Item', item: null, error: 'Name, category, and price are required.' });
    await MenuItem.create({ name, description, category, price: parseFloat(price), isVegetarian: !!isVegetarian, preparationTime: parseInt(preparationTime) || 15, stock: stock ? parseInt(stock) : null, createdBy: req.session.userId });
    res.redirect('/menu?success=Item+added');
  } catch (err) {
    const msg = err.name === 'ValidationError' ? Object.values(err.errors).map(e => e.message).join(' ') : err.message;
    res.render('menu/form', { title: 'Add Menu Item', item: null, error: msg });
  }
});

// POST /menu/:id/update — update (form uses POST with _method override)
router.post('/:id/update', requireRole(['admin']), async (req, res) => {
  try {
    const { name, description, category, price, isVegetarian, preparationTime, stock, isAvailable } = req.body;
    await MenuItem.findByIdAndUpdate(req.params.id, { name, description, category, price: parseFloat(price), isVegetarian: !!isVegetarian, preparationTime: parseInt(preparationTime) || 15, stock: stock ? parseInt(stock) : null, isAvailable: !!isAvailable, updatedBy: req.session.userId }, { runValidators: true });
    res.redirect('/menu?success=Item+updated');
  } catch (err) {
    const item = await MenuItem.findById(req.params.id).catch(() => null);
    const msg  = err.name === 'ValidationError' ? Object.values(err.errors).map(e => e.message).join(' ') : err.message;
    res.render('menu/form', { title: 'Edit Menu Item', item, error: msg });
  }
});

// POST /menu/:id/delete
router.post('/:id/delete', requireRole('admin'), async (req, res) => {
  try {
    const active = await Order.countDocuments({ 'items.menuItem': req.params.id, status: { $in: ['pending', 'confirmed', 'preparing', 'ready'] } });
    if (active > 0) return res.redirect('/menu?error=Item+has+active+orders');
    await MenuItem.findByIdAndDelete(req.params.id);
    res.redirect('/menu?success=Item+deleted');
  } catch (err) { res.redirect('/menu?error=Delete+failed'); }
});

module.exports = router;
