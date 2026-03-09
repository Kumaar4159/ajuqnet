'use strict';
const mongoose = require('mongoose');
const crypto   = require('crypto');

const attendanceSessionSchema = new mongoose.Schema(
  {
    subject:    { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: String, required: true, trim: true, maxlength: 100 },
    semester:   { type: String, required: true, trim: true, maxlength: 20  },
    room:       { type: String, required: true, trim: true, maxlength: 50  },

    facultyId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    facultyName: { type: String, required: true },

    startTime:       { type: Date, default: Date.now },
    durationMinutes: { type: Number, required: true, min: 10, max: 300 },

    // QR token: short random hex used in QR payload — expires after durationMinutes
    qrToken: { type: String, required: true, unique: true, index: true },

    teacherLocation: {
      lat: { type: Number, default: null },
      lng: { type: Number, default: null },
    },

    // Active = QR is still valid; closed manually or after expiry
    status: {
      type: String,
      enum: ['active', 'closed'],
      default: 'active',
    },
  },
  { timestamps: true }
);

// Virtual: has the QR window expired?
attendanceSessionSchema.virtual('isExpired').get(function () {
  const expiresAt = new Date(this.startTime.getTime() + this.durationMinutes * 60 * 1000);
  return Date.now() > expiresAt.getTime();
});

// Virtual: expiry date
attendanceSessionSchema.virtual('expiresAt').get(function () {
  return new Date(this.startTime.getTime() + this.durationMinutes * 60 * 1000);
});

// Static: generate a unique QR token
attendanceSessionSchema.statics.generateToken = function () {
  return crypto.randomBytes(24).toString('hex');
};

// Static: find a currently valid (active + not expired) session by token
attendanceSessionSchema.statics.findValid = function (token) {
  return this.findOne({ qrToken: token, status: 'active' });
};

const AttendanceSession = mongoose.model('AttendanceSession', attendanceSessionSchema);
module.exports = AttendanceSession;