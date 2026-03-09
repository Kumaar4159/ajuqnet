'use strict';
const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema(
  {
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      required: true,
      index: true,
    },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    body:  { type: String, required: true, trim: true, maxlength: 500 },
    type: {
      type: String,
      enum: ['order', 'booking', 'chat', 'admin', 'system'],
      default: 'system',
    },
    link: { type: String, trim: true, default: null },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

notificationSchema.index({ recipient: 1, read: 1, createdAt: -1 });

notificationSchema.statics.send = async function ({ recipientId, title, body, type = 'system', link = null, io = null }) {
  const notification = await this.create({ recipient: recipientId, title, body, type, link });
  if (io) {
    const unreadCount = await this.countDocuments({ recipient: recipientId, read: false });
    io.to(`user:${recipientId}`).emit('notification:new', {
      _id:       notification._id.toString(),
      title:     notification.title,
      body:      notification.body,
      type:      notification.type,
      link:      notification.link,
      createdAt: notification.createdAt.toISOString(),
      unreadCount,
    });
  }
  return notification;
};

const Notification = mongoose.model('Notification', notificationSchema);
module.exports = Notification;