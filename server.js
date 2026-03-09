'use strict';

require('dns').setServers(['8.8.8.8','8.8.4.4']);
require('dns').setDefaultResultOrder('ipv4first');
require('dotenv').config();
const http       = require('http');
const path       = require('path');
const express    = require('express');
const session    = require('express-session');
const MongoStore = require('connect-mongo');
const connectDB  = require('./config/database');

const { checkDBConnection } = require('./middleware/dbCheck');
const { attachUserLocals }  = require('./middleware/auth'); // FIX ADDED

const { initSocket }       = require('./socket/index');
const { selfTest }         = require('./utils/encryption');

const rateLimit            = require('express-rate-limit');
const helmet               = require('helmet');


// ── Encryption self-test ─────────────────────────────────────────────
try {
  selfTest();
  console.log('✅ AES-256-GCM self-test passed');
} catch (err) {
  console.error('❌ Encryption self-test FAILED:', err.message);
  process.exit(1);
}

const app  = express();
const PORT = process.env.PORT || 3000;

connectDB();


// ── View engine ──────────────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));


// ── Static files ─────────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));


// ── Body parsing ─────────────────────────────────────────────────────
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


// ── Session setup ────────────────────────────────────────────────────
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET || 'change_me_in_production_min_64_chars',
  resave: false,
  saveUninitialized: false,

  store: MongoStore.create({
   mongoUrl: process.env.MONGODB_URI || process.env.MONGO_URI,
    collectionName: 'sessions',
    ttl: parseInt(process.env.SESSION_MAX_AGE) / 1000 || 3600,
    autoRemove: 'native'
  }),

  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_MAX_AGE) || 3600000,
    sameSite: 'lax'
  },

  name: 'campus.sid'
});

app.use(sessionMiddleware);
app.use(attachUserLocals);
app.use(checkDBConnection);


// ── Security headers ─────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc:  ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      styleSrc:   ["'self'", "'unsafe-inline'", "cdn.jsdelivr.net"],
      fontSrc:    ["'self'", "cdn.jsdelivr.net"],
      imgSrc:     ["'self'", "data:"],
      connectSrc: ["'self'", "ws:", "wss:", "https://cdn.jsdelivr.net"],
      mediaSrc:   ["'self'"],
      frameSrc:   ["'none'"],
      objectSrc:  ["'none'"]
    }
  },

  frameguard: { action: 'sameorigin' },

  hsts: process.env.NODE_ENV === 'production'
    ? { maxAge: 31536000, includeSubDomains: true }
    : false
}));


// ── Flash messages ───────────────────────────────────────────────────
app.use((req, res, next) => {

  res.locals.flash = {
    success: req.query.success || null,
    error: req.query.error || null
  };

  next();
});


// ── Global rate limiter ──────────────────────────────────────────────
const globalLimiter = rateLimit({

  windowMs: 15 * 60 * 1000,
  max: 500,

  standardHeaders: true,
  legacyHeaders: false,

  message: {
    error: 'Too many requests — please try again in 15 minutes.'
  }
});

app.use(globalLimiter);


// ── Routes ───────────────────────────────────────────────────────────
app.get('/', (req, res) => {

  if (req.session?.userId)
    return res.redirect('/dashboard');

  res.redirect('/auth/login');
});


app.use('/auth', require('./routes/auth'));
app.use('/dashboard', require('./routes/dashboard'));
app.use('/menu', require('./routes/menu'));
app.use('/orders', require('./routes/orders'));
app.use('/tables', require('./routes/tables'));
app.use('/bookings', require('./routes/bookings'));
app.use('/chat', require('./routes/chat'));
app.use('/announcements', require('./routes/announcements'));
app.use('/admin', require('./routes/admin'));
app.use('/canteen', require('./routes/canteen'));
app.use('/notifications', require('./routes/notifications'));
app.use('/attendance', require('./routes/attendance'));
app.use('/smart-attendance', require('./routes/smart-attendance'));
app.use('/dashboard/profile', require('./routes/face-embedding'));
app.use('/subjects', require('./routes/subjects'));


// ── 404 handler ──────────────────────────────────────────────────────
app.use((req, res) => {

  res.status(404).render('error', {
    title: 'Page Not Found',
    code: 404,
    message: `The page "${req.path}" does not exist.`,
    user: req.session?.user || null
  });

});


// ── Global error handler ─────────────────────────────────────────────
app.use((err, req, res, next) => {

  console.error('Unhandled error:', err);

  res.status(500).render('error', {
    title: 'Server Error',
    code: 500,
    message: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
    user: req.session?.user || null
  });

});


// ── HTTP server + Socket.io ──────────────────────────────────────────
const httpServer = http.createServer(app);

const io = initSocket(httpServer, sessionMiddleware);

app.set('io', io);


// ── Start server ─────────────────────────────────────────────────────
httpServer.listen(PORT, () => {

  console.log(`\n🚀  http://localhost:${PORT}`);
  console.log(`🎓  AJUQNET v10.0.3 — Arka Jain University Quick Network System`);
  console.log(`🔐  Session + bcrypt + AES-256-GCM encryption`);
  console.log(`💬  Real-time chat via Socket.io\n`);

});


module.exports = app;