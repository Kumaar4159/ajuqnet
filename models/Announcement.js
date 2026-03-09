'use strict';
const mongoose = require('mongoose');

const announcementSchema = new mongoose.Schema(
  {
    title: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 150,
    },
    message: {
      type:     String,
      required: true,
      trim:     true,
      maxlength: 2000,
    },

    // 'all' means visible to everyone; otherwise department-targeted
    department: {
      type:    String,
      trim:    true,
      default: 'all',
    },

    // Priority changes the colour of the badge
    priority: {
      type:    String,
      enum:    ['info', 'warning', 'urgent'],
      default: 'info',
    },

    // Optional expiry: hide announcement after this date
    expiresAt: {
      type:    Date,
      default: null,
    },

    createdBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    createdByName: { type: String, required: true },
    createdByRole: { type: String, required: true },

    pinned: { type: Boolean, default: false },

    // Optional file attachment (stored as base64)
    attachment: {
      filename:    { type: String, default: null },
      contentType: { type: String, default: null },
      data:        { type: String, default: null }, // base64
      size:        { type: Number, default: null },
    },
  },
  { timestamps: true }
);

announcementSchema.index({ createdAt: -1 });
announcementSchema.index({ department: 1, createdAt: -1 });

// ── Static helper: fetch active announcements for a given department ──────────
announcementSchema.statics.getActive = function (department = null) {
  const now = new Date();

  if (department) {
    return this.find({
      $and: [
        { $or: [{ department: 'all' }, { department: department }] },
        { $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] },
      ],
    }).sort({ pinned: -1, createdAt: -1 });
  }

  return this.find({
    $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }],
  }).sort({ pinned: -1, createdAt: -1 });
};

const Announcement = mongoose.model('Announcement', announcementSchema);
module.exports = Announcement;