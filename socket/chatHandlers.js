'use strict';

/**
 * Socket.io Event Handlers
 * ─────────────────────────────────────────────────────────────────────────────
 * All messages are encrypted with AES-256-GCM before being saved to MongoDB.
 * Plaintext is ONLY held in server memory during the request/response cycle —
 * it never touches the database.
 *
 * Encryption flow:
 *   Client sends plaintext
 *     → server encrypts → stores envelope in DB
 *     → server decrypts → broadcasts plaintext to room members
 *
 * Events emitted TO clients:
 *   chat:message       — new message (decrypted)
 *   chat:message_edited  — edited message (decrypted)
 *   chat:message_deleted — tombstone
 *   chat:reaction      — reaction added/removed
 *   chat:typing        — typing indicator
 *   chat:read          — read receipts
 *   chat:history       — paginated history (decrypted)
 *   chat:members       — online members list
 *   chat:error         — error feedback
 *   chat:online        — user came online
 *   chat:offline       — user went offline
 */

const ChatRoom     = require('../models/ChatRoom');
const Notification = require('../models/Notification');
const Message  = require('../models/Message');
const { encrypt, safeDecrypt } = require('../utils/encryption');
const { assertRoomAccess }     = require('./authMiddleware');

// ── In-memory online tracking: roomId → Set<userId> ──────────────────────────
const onlineUsers = new Map();

// ─── Helper: decrypt a Message document → plain object for the wire ────────────
function toWireMessage(msg) {
  const obj = msg.toObject ? msg.toObject() : { ...msg };

  // Decrypt current content
  obj.content = msg.isDeleted
    ? null
    : safeDecrypt(msg.encryptedContent);

  // Strip the raw encrypted envelope from the wire object
  delete obj.encryptedContent;

  // Strip edit history envelopes (don't leak prior encrypted blobs)
  if (obj.editHistory) delete obj.editHistory;

  return obj;
}

// ─── Helper: emit error back to caller only ───────────────────────────────────
function emitError(socket, message, code = 'ERROR') {
  socket.emit('chat:error', { code, message });
}

// ─── Main handler — called once per socket connection ─────────────────────────
function registerChatHandlers(io, socket) {
  const { userId, userRole, user } = socket.data;

  // ── JOIN a room ────────────────────────────────────────────────────────────
  socket.on('chat:join', async ({ roomId }) => {
    try {
      if (!roomId) return emitError(socket, 'roomId is required', 'VALIDATION');

      const room = await assertRoomAccess(roomId, userId, userRole);

      // Add user to the Socket.io room
      await socket.join(roomId);

      // Track online presence
      if (!onlineUsers.has(roomId)) onlineUsers.set(roomId, new Set());
      onlineUsers.get(roomId).add(userId);

      // Notify others
      socket.to(roomId).emit('chat:online', {
        userId,
        name:   user.name,
        role:   userRole,
        roomId,
      });

      // Emit the current online member list to the joining user
      socket.emit('chat:members', {
        roomId,
        online: [...(onlineUsers.get(roomId) || [])],
      });

      console.log(`[chat] ${user.name} (${userRole}) joined room "${room.name}"`);
    } catch (err) {
      emitError(socket, err.message);
    }
  });

  // ── LEAVE a room ────────────────────────────────────────────────────────────
  socket.on('chat:leave', async ({ roomId }) => {
    try {
      socket.leave(roomId);
      onlineUsers.get(roomId)?.delete(userId);

      socket.to(roomId).emit('chat:offline', { userId, name: user.name, roomId });
    } catch (err) {
      emitError(socket, err.message);
    }
  });

  // ── SEND MESSAGE ────────────────────────────────────────────────────────────
  socket.on('chat:send', async ({ roomId, content, replyToId }) => {
    try {
      if (!roomId)   return emitError(socket, 'roomId is required',    'VALIDATION');
      if (!content?.trim()) return emitError(socket, 'content is required', 'VALIDATION');
      if (content.length > 4000) return emitError(socket, 'Message too long (max 4000 chars)', 'VALIDATION');

      // Verify room access every time (not just on join)
      await assertRoomAccess(roomId, userId, userRole);

      // ── Encrypt before saving ──────────────────────────────────────────
      const encryptedContent = encrypt(content.trim());

      const message = await Message.create({
        room:             roomId,
        sender:           userId,
        senderName:       user.name,
        senderRole:       userRole,
        encryptedContent,
        messageType:      'text',
        replyTo:          replyToId || null,
      });

      // Update room's lastMessageAt
      await ChatRoom.findByIdAndUpdate(roomId, { lastMessageAt: message.createdAt });

      // ── Decrypt for broadcast ───────────────────────────────────────────
      const wireMsg = toWireMessage(message);

      // Populate replyTo snippet if present
      if (message.replyTo) {
        const parent = await Message.findById(message.replyTo).select('senderName encryptedContent isDeleted');
        if (parent) {
          wireMsg.replyTo = {
            _id:        parent._id,
            senderName: parent.senderName,
            content:    parent.isDeleted ? null : safeDecrypt(parent.encryptedContent),
          };
        }
      }

      // Broadcast to ALL sockets in the room (including sender)
      io.to(roomId).emit('chat:message', wireMsg);

      // ── Send notification to room members not currently in the room ────
      try {
        const room = await ChatRoom.findById(roomId).select('type members name').lean();
        if (room) {
          const onlineInRoom = onlineUsers.get(roomId) || new Set();
          const recipientIds = room.members
            .map(m => m.user.toString())
            .filter(id => id !== userId && !onlineInRoom.has(id));
          const notifTitle = room.type === 'direct'
            ? `💬 New message from ${user.name}`
            : `💬 ${user.name} in ${room.name}`;
          const notifBody = content.trim().substring(0, 100) + (content.length > 100 ? '…' : '');
          await Promise.all(recipientIds.map(rid =>
            Notification.send({ recipientId: rid, title: notifTitle, body: notifBody, type: 'chat', link: '/chat/room/' + roomId, io }).catch(() => {})
          ));
        }
      } catch(notifErr) { console.warn('[chat:send] notification error:', notifErr.message); }

    } catch (err) {
      console.error('[chat:send]', err.message);
      emitError(socket, err.message);
    }
  });

  // ── EDIT MESSAGE ─────────────────────────────────────────────────────────────
  socket.on('chat:edit', async ({ messageId, newContent }) => {
    try {
      if (!messageId)        return emitError(socket, 'messageId is required', 'VALIDATION');
      if (!newContent?.trim()) return emitError(socket, 'newContent is required', 'VALIDATION');
      if (newContent.length > 4000) return emitError(socket, 'Message too long', 'VALIDATION');

      const message = await Message.findById(messageId);
      if (!message || message.isDeleted) {
        return emitError(socket, 'Message not found', 'NOT_FOUND');
      }

      // Only sender or admin can edit
      const canEdit =
        message.sender.toString() === userId || userRole === 'admin';
      if (!canEdit) return emitError(socket, 'You cannot edit this message', 'FORBIDDEN');

      await assertRoomAccess(message.room.toString(), userId, userRole);

      // Archive the old encrypted content
      const previousEnvelope = message.encryptedContent;

      // Encrypt the new content
      const newEncrypted = encrypt(newContent.trim());

      message.editHistory.push({ encryptedContent: previousEnvelope });
      message.encryptedContent = newEncrypted;
      message.isEdited         = true;
      message.editedAt         = new Date();
      await message.save();

      const wireMsg = toWireMessage(message);
      io.to(message.room.toString()).emit('chat:message_edited', wireMsg);

    } catch (err) {
      console.error('[chat:edit]', err.message);
      emitError(socket, err.message);
    }
  });

  // ── DELETE MESSAGE ────────────────────────────────────────────────────────────
  socket.on('chat:delete', async ({ messageId }) => {
    try {
      if (!messageId) return emitError(socket, 'messageId is required', 'VALIDATION');

      const message = await Message.findById(messageId);
      if (!message || message.isDeleted) {
        return emitError(socket, 'Message not found', 'NOT_FOUND');
      }

      const canDelete =
        message.sender.toString() === userId || ['admin', 'faculty'].includes(userRole);
      if (!canDelete) return emitError(socket, 'You cannot delete this message', 'FORBIDDEN');

      // Soft delete — keeps the document for audit; clears the encrypted content
      message.isDeleted         = true;
      message.deletedAt         = new Date();
      message.deletedBy         = userId;
      message.encryptedContent  = encrypt('[deleted]'); // overwrite envelope too
      await message.save();

      io.to(message.room.toString()).emit('chat:message_deleted', {
        messageId,
        roomId:    message.room.toString(),
        deletedBy: user.name,
      });

    } catch (err) {
      console.error('[chat:delete]', err.message);
      emitError(socket, err.message);
    }
  });

  // ── REACT to a message ────────────────────────────────────────────────────────
  socket.on('chat:react', async ({ messageId, emoji }) => {
    try {
      if (!messageId) return emitError(socket, 'messageId is required', 'VALIDATION');
      if (!emoji)     return emitError(socket, 'emoji is required',     'VALIDATION');

      const message = await Message.findById(messageId);
      if (!message || message.isDeleted) {
        return emitError(socket, 'Message not found', 'NOT_FOUND');
      }

      // Toggle: if user already reacted with this emoji, remove it
      const existingIdx = message.reactions.findIndex(
        (r) => r.emoji === emoji && r.userId.toString() === userId
      );

      if (existingIdx !== -1) {
        message.reactions.splice(existingIdx, 1);
      } else {
        message.reactions.push({ emoji, userId, name: user.name });
      }
      await message.save();

      io.to(message.room.toString()).emit('chat:reaction', {
        messageId,
        reactions: message.reactions,
      });

    } catch (err) {
      console.error('[chat:react]', err.message);
      emitError(socket, err.message);
    }
  });

  // ── TYPING indicator ───────────────────────────────────────────────────────
  socket.on('chat:typing', ({ roomId, isTyping }) => {
    if (!roomId) return;
    socket.to(roomId).emit('chat:typing', {
      userId,
      name: user.name,
      roomId,
      isTyping: !!isTyping,
    });
  });

  // ── READ receipt ──────────────────────────────────────────────────────────
  socket.on('chat:read', async ({ roomId, lastMessageId }) => {
    try {
      if (!roomId || !lastMessageId) return;

      // Mark all unread messages up to lastMessageId as read by this user
      await Message.updateMany(
        {
          room:       roomId,
          _id:        { $lte: lastMessageId },
          'readBy.user': { $ne: userId },
          isDeleted:  false,
        },
        { $push: { readBy: { user: userId, readAt: new Date() } } }
      );

      socket.to(roomId).emit('chat:read', {
        userId,
        name:          user.name,
        roomId,
        lastMessageId,
      });
    } catch (err) {
      // Non-critical — swallow silently
    }
  });

  // ── HISTORY — paginated message retrieval ──────────────────────────────────
  socket.on('chat:history', async ({ roomId, before, limit = 40 }) => {
    try {
      if (!roomId) return emitError(socket, 'roomId is required', 'VALIDATION');

      await assertRoomAccess(roomId, userId, userRole);

      const pageSize = Math.min(Math.max(parseInt(limit) || 40, 1), 100);
      const query    = { room: roomId };
      if (before) query._id = { $lt: before }; // cursor-based pagination

      const messages = await Message.find(query)
        .sort({ createdAt: -1 })
        .limit(pageSize)
        .populate('replyTo', 'senderName encryptedContent isDeleted');

      // Decrypt all messages
      const decrypted = messages.reverse().map((msg) => {
        const wire = toWireMessage(msg);
        // Decrypt replyTo snippet if populated
        if (msg.replyTo && !msg.replyTo.isDeleted) {
          wire.replyTo = {
            _id:        msg.replyTo._id,
            senderName: msg.replyTo.senderName,
            content:    safeDecrypt(msg.replyTo.encryptedContent),
          };
        }
        return wire;
      });

      socket.emit('chat:history', {
        roomId,
        messages: decrypted,
        hasMore:  messages.length === pageSize,
        cursor:   messages.length > 0 ? messages[0]._id : null,
      });

    } catch (err) {
      console.error('[chat:history]', err.message);
      emitError(socket, err.message);
    }
  });

  // ── DISCONNECT cleanup ─────────────────────────────────────────────────────
socket.on('disconnect', () => {
  // Remove from all rooms this socket was tracking
  for (const [roomId, users] of onlineUsers.entries()) {
    if (users.has(userId)) {
      users.delete(userId);
      io.to(roomId).emit('chat:offline', { userId, name: user.name, roomId });
    }
  }
  console.log(`[chat] ${user.name} disconnected`);
});
}

module.exports = { registerChatHandlers };
