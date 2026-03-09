'use strict';
const { isConnected } = require('../config/database');

const checkDBConnection = (req, res, next) => {
  // Always allow these through — static files, login page, auth routes
  const allowedPaths = [
    '/auth/login',
    '/auth/logout',
    '/css',
    '/js',
    '/img',
    '/favicon',
  ];

  const isAllowed = allowedPaths.some(p => req.path.startsWith(p));
  if (isAllowed) return next();

  // If DB is connected, proceed normally
  if (isConnected()) return next();

  // DB is down — show friendly error page
  return res.status(503).render('error-db', {
    title: 'Connection Issue',
    user:  req.session?.user || null,
  });
};

module.exports = { checkDBConnection };