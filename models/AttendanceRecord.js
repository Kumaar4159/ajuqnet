'use strict';
const mongoose = require('mongoose');

const attendanceRecordSchema = new mongoose.Schema(
  {
    sessionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'AttendanceSession',
      required: true,
    },
    studentId:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    studentName: { type: String, required: true },

    timestamp: { type: Date, default: Date.now },

    // What verifications passed
    verificationType: {
      face:     { type: Boolean, default: false },
      location: { type: Boolean, default: false },
    },

    // present = both checks passed; rejected = one or both failed
    status: {
      type:    String,
      enum:    ['present', 'rejected'],
      default: 'rejected',
    },

    // Distance from teacher at submission time (metres)
    distanceMetres: { type: Number, default: null },

    // Face match score (0–1)
    faceScore: { type: Number, default: null },

    // IP for audit trail
    ipAddress: { type: String, default: null },
  },
  { timestamps: true }
);

// One record per student per session (prevents double submission)
attendanceRecordSchema.index({ sessionId: 1, studentId: 1 }, { unique: true });
attendanceRecordSchema.index({ studentId: 1, timestamp: -1 });

// ── Static: analytics for a student ──────────────────────────────────────────
attendanceRecordSchema.statics.getStudentAnalytics = async function (studentId) {
  const ObjectId = mongoose.Types.ObjectId;
  const sid = new ObjectId(studentId);

  // All present records with session info
  const records = await this.find({ studentId: sid, status: 'present' })
    .populate('sessionId', 'subject department semester startTime')
    .lean();

  const total   = await this.countDocuments({ studentId: sid });
  const present = records.length;
  const pct     = total > 0 ? Math.round((present / total) * 100) : null;

  // Subject breakdown
  const bySubject = {};
  records.forEach(r => {
    const subj = r.sessionId?.subject || 'Unknown';
    if (!bySubject[subj]) bySubject[subj] = { present: 0, total: 0 };
    bySubject[subj].present++;
  });

  // Count total per subject (including absences)
  const allRecords = await this.find({ studentId: sid })
    .populate('sessionId', 'subject')
    .lean();
  allRecords.forEach(r => {
    const subj = r.sessionId?.subject || 'Unknown';
    if (!bySubject[subj]) bySubject[subj] = { present: 0, total: 0 };
    bySubject[subj].total++;
  });

  const subjects = Object.entries(bySubject).map(([name, d]) => ({
    name,
    present: d.present,
    total:   d.total,
    pct:     d.total > 0 ? Math.round((d.present / d.total) * 100) : 0,
  }));

  // 30-day trend: array of { date, present }
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const trend = await this.aggregate([
    { $match: { studentId: sid, timestamp: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id:     { $dateToString: { format: '%Y-%m-%d', date: '$timestamp' } },
        present: { $sum: { $cond: [{ $eq: ['$status', 'present'] }, 1, 0] } },
        total:   { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  return { total, present, pct, subjects, trend };
};

// ── Static: analytics for a faculty session list ──────────────────────────────
attendanceRecordSchema.statics.getSessionAnalytics = async function (sessionId) {
  const ObjectId = mongoose.Types.ObjectId;
  const sid      = new ObjectId(sessionId);

  const records = await this.find({ sessionId: sid })
    .populate('studentId', 'name studentId department')
    .lean();

  const total   = records.length;
  const present = records.filter(r => r.status === 'present').length;
  const pct     = total > 0 ? Math.round((present / total) * 100) : 0;

  return { total, present, pct, records };
};

const AttendanceRecord = mongoose.model('AttendanceRecord', attendanceRecordSchema);
module.exports = AttendanceRecord;