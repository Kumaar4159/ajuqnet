'use strict';

const { Server }              = require('socket.io');
const { socketAuthMiddleware } = require('./authMiddleware');
const { registerChatHandlers } = require('./chatHandlers');

/**
 * Initialize Socket.io on the HTTP server.
 *
 * @param {http.Server}   httpServer       — from http.createServer(app)
 * @param {Function}      sessionMiddleware — the express-session instance
 * @returns {Server}  the io instance
 */
function initSocket(httpServer, sessionMiddleware) {
  const io = new Server(httpServer, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? (process.env.CLIENT_ORIGIN || 'http://localhost:3000')
      : true,          // allow any origin in development
    credentials: true, // required for session cookies
  },
    // Prefer WebSocket, fall back to polling
    transports: ['websocket', 'polling'],
    // Ping every 25 s, drop after 60 s of silence
    pingInterval: 25000,
    pingTimeout:  60000,
  });

  // ── Auth gate: every connection must carry a valid session cookie ───────────
  io.use(socketAuthMiddleware(sessionMiddleware));

  // ── Register per-socket event handlers ─────────────────────────────────────
  io.on('connection', (socket) => {
    const { userId, user, userRole } = socket.data;
    console.log(`[socket] ${user.name} (${userRole}) connected — id: ${socket.id}`);

    // ── Personal room: every user automatically joins "user:<id>" ───────────
    // Routes can emit to a specific user with: io.to(`user:${userId}`).emit(...)
    socket.join(`user:${userId}`);

    registerChatHandlers(io, socket);
  });

  return io;
}

module.exports = { initSocket };