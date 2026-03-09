'use strict';

const requireAuth = (req, res, next) => {
  if (!req.session?.userId) {
    req.session.returnTo = req.originalUrl;
    return res.redirect('/auth/login');
  }
  next();
};

const requireRole = (roles) => {
  const allowed = Array.isArray(roles) ? roles : [roles];
  return (req, res, next) => {
    if (!req.session?.userId) {
      req.session.returnTo = req.originalUrl;
      return res.redirect('/auth/login');
    }
    if (!allowed.includes(req.session.userRole)) {
      return res.status(403).render('error', {
        title: 'Access Denied',
        code: 403,
        message: 'You do not have permission to view this page.',
        user: req.session.user || null,
      });
    }
    next();
  };
};

const redirectIfAuthenticated = (req, res, next) => {
  if (req.session?.userId) return res.redirect('/dashboard');
  next();
};

const attachUserLocals = (req, res, next) => {
  res.locals.user            = req.session?.user || null;
  res.locals.isAuthenticated = !!req.session?.userId;
  res.locals.currentPath     = req.path;
  next();
};

module.exports = { requireAuth, requireRole, redirectIfAuthenticated, attachUserLocals };
