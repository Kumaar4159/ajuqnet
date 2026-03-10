'use strict';
const express = require('express');
const router  = express.Router();
const User    = require('../models/User');
const { redirectIfAuthenticated } = require('../middleware/auth');
const { loginRules, registerRules, collectErrors } = require('../middleware/validators');

// GET /auth/login
router.get('/login', redirectIfAuthenticated, (req, res) => {
  res.render('auth/login', { title: 'Login', error: req.query.error || null, info: req.query.info || null });
});

// GET /auth/register
router.get('/register', redirectIfAuthenticated, (req, res) => {
  res.render('auth/register', { title: 'Register', error: null });
});

// POST /auth/login
router.post('/login', redirectIfAuthenticated, loginRules, async (req, res) => {
  try {
    if (collectErrors(req, res))
      return res.render('auth/login', { title: 'Login', error: res.locals.validationError, info: null });

    const { email, password } = req.body;
    if (!email || !password)
      return res.render('auth/login', { title: 'Login', error: 'Email and password are required.', info: null });

    const user = await User.findByEmail(email);
    if (!user)
      return res.render('auth/login', { title: 'Login', error: 'Invalid email or password.', info: null });

    if (user.approvalStatus: 'pending', isActive: false)
      return res.render('auth/login', { title: 'Login', error: 'Your account is pending admin approval.', info: null });
    if (user.approvalStatus === 'rejected')
      return res.render('auth/login', { title: 'Login', error: 'Your account registration was rejected. Contact an administrator.', info: null });
    if (!user.isActive)
      return res.render('auth/login', { title: 'Login', error: 'Your account has been deactivated. Contact an administrator.', info: null });

    if (user.isLocked) {
      const mins = Math.ceil((new Date(user.lockUntil) - Date.now()) / 60000);
      return res.render('auth/login', { title: 'Login', error: `Account locked. Try again in ${mins} minute(s).`, info: null });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incLoginAttempts();
      const updated = await User.findById(user._id);
      const max     = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;
      if (updated.isLocked) {
        const mins = parseInt(process.env.LOCK_TIME_MINUTES) || 30;
        return res.render('auth/login', { title: 'Login', error: `Account locked for ${mins} minute(s) after too many failed attempts.`, info: null });
      }
      const rem = Math.max(0, max - updated.loginAttempts);
      return res.render('auth/login', { title: 'Login', error: `Invalid email or password. ${rem} attempt(s) remaining.`, info: null });
    }

    await user.resetLoginAttempts();

    req.session.regenerate((err) => {
      if (err) return res.render('auth/login', { title: 'Login', error: 'Login failed. Please try again.', info: null });
      req.session.userId   = user._id.toString();
      req.session.userRole = user.role;
      req.session.user     = { id: user._id.toString(), name: user.name, email: user.email, role: user.role, department: user.department, studentId: user.studentId, semester: user.semester };
      const returnTo = req.session.returnTo || '/dashboard';
      delete req.session.returnTo;
      res.redirect(returnTo);
    });
  } catch (err) {
    console.error('Login error:', err);
    res.render('auth/login', { title: 'Login', error: 'An unexpected error occurred.', info: null });
  }
});

// POST /auth/register
router.post('/register', redirectIfAuthenticated, registerRules, async (req, res) => {
  try {
    if (collectErrors(req, res))
      return res.render('auth/register', { title: 'Register', error: res.locals.validationError, errors: res.locals.validationErrors });

    const { name, email, password, role, department, studentId, semester } = req.body;
    if (!name || !email || !password)
      return res.render('auth/register', { title: 'Register', error: 'Name, email, and password are required.' });
    if (password.length < 8)
      return res.render('auth/register', { title: 'Register', error: 'Password must be at least 8 characters.' });

    const assignedRole = role || 'student';
    if (assignedRole === 'admin')
      return res.render('auth/register', { title: 'Register', error: 'Admin accounts cannot be self-registered.' });

    if (await User.findByEmail(email))
      return res.render('auth/register', { title: 'Register', error: 'An account with this email already exists.' });

    await User.create({ name, email, password, role: assignedRole, department, studentId, semester: assignedRole === 'student' ? (semester || '') : '', isActive: false, approvalStatus: 'pending' });
    res.redirect('/auth/login?info=Account+created.+Please+wait+for+admin+approval.');
  } catch (err) {
    if (err.name === 'ValidationError') {
      const msg = Object.values(err.errors).map(e => e.message).join(' ');
      return res.render('auth/register', { title: 'Register', error: msg });
    }
    console.error('Register error:', err);
    res.render('auth/register', { title: 'Register', error: 'An unexpected error occurred.' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  req.session.destroy(() => {
    res.clearCookie('campus.sid');
    res.redirect('/auth/login?info=You+have+been+logged+out.');
  });
});

module.exports = router;
