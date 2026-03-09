'use strict';

/**
 * Socket.io Authentication Middleware
 * ─────────────────────────────────────────────────────────────────────────────
 * Validates the Express session cookie on the WebSocket handshake.
 * Attaches user info to socket.data so all event handlers can trust it.
 *
 * Usage (in socket/index.js):
 *   io.use(socketAuthMiddleware(sessionMiddleware));
 */

const ChatRoom = require('../models/ChatRoom');

/**
 * Wraps the Express session middleware for Socket.io.
 * @param {Function} sessionMiddleware  — the result of session({...})
 * @returns {Function}  Socket.io use() middleware
 */
function socketAuthMiddleware(sessionMiddleware) {
  return (socket, next) => {
    // Pump the HTTP request through the Express session middleware
    // so req.session gets populated from the cookie store.
    sessionMiddleware(socket.request, socket.request.res || {}, (err) => {
      if (err) return next(err);

      const session = socket.request.session;

      if (!session || !session.userId) {
        return next(new Error('AUTH_REQUIRED: You must be logged in to use chat'));
      }

      if (!session.user) {
        return next(new Error('AUTH_REQUIRED: Session user data missing'));
      }

      // Attach verified identity to socket — handlers must read from here only
      socket.data.userId   = session.userId;
      socket.data.userRole = session.userRole;
      socket.data.user     = session.user; // { id, name, email, role, ... }

      next();
    });
  };
}

/**
 * Per-event authorization helper.
 * Call inside any event handler to verify room membership.
 *
 * @param {string}  roomId    — Mongoose ObjectId string
 * @param {string}  userId    — socket.data.userId
 * @param {string}  userRole  — socket.data.userRole
 * @returns {Promise<ChatRoom>}
 * @throws  Error with user-facing message on denial
 */
async function assertRoomAccess(roomId, userId, userRole) {
  const room = await ChatRoom.findById(roomId);
  if (!room || !room.isActive) {
    throw new Error('ROOM_NOT_FOUND: Chat room does not exist');
  }

  // Role-level gate
  if (!room.allowedRoles.includes(userRole)) {
    throw new Error('FORBIDDEN: Your role is not permitted in this room');
  }

  // Membership gate (for private / direct rooms)
  if (room.type !== 'public') {
    const isMember = room.members.some((m) => m.user.toString() === userId);
    if (!isMember) {
      throw new Error('FORBIDDEN: You are not a member of this room');
    }
  }

  return room;
}

module.exports = { socketAuthMiddleware, assertRoomAccess };
