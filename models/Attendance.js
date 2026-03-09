'use strict';
const mongoose = require('mongoose');

const attendanceSchema = new mongoose.Schema(
  {
    // The student whose attendance is being recorded
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      required: true,
    },
    studentName: { type: String, required: true },

    // Faculty who marked the attendance
    markedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'User',
      required: true,
    },
    markedByName: { type: String, required: true },

    subject:    { type: String, required: true, trim: true, maxlength: 100 },
    department: { type: String, trim: true, maxlength: 100 },

    date: {
      type:     Date,
      required: true,
    },

    status: {
      type: String,
      enum: ['present', 'absent', 'late'],
      default: 'present',
    },

    note: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// Prevent duplicate records: one entry per student per subject per date
attendanceSchema.index({ student: 1, subject: 1, date: 1 }, { unique: true });
attendanceSchema.index({ markedBy: 1, date: -1 });
attendanceSchema.index({ student: 1, date: -1 });

// ── Static: compute attendance summary for a student ─────────────────────────
attendanceSchema.statics.getSummary = async function (studentId, subject = null) {
  const match = { student: new mongoose.Types.ObjectId(studentId) };
  if (subject) match.subject = subject;

  const records = await this.find(match).lean();
  const total   = records.length;
  const present = records.filter(r => r.status === 'present' || r.status === 'late').length;
  const pct     = total > 0 ? Math.round((present / total) * 100) : null;

  // Group by subject
  const bySubject = {};
  records.forEach(r => {
    if (!bySubject[r.subject]) bySubject[r.subject] = { total: 0, present: 0 };
    bySubject[r.subject].total++;
    if (r.status !== 'absent') bySubject[r.subject].present++;
  });

  const subjects = Object.entries(bySubject).map(([name, data]) => ({
    name,
    total:   data.total,
    present: data.present,
    pct:     Math.round((data.present / data.total) * 100),
  }));

  return { total, present, pct, subjects };
};

const Attendance = mongoose.model('Attendance', attendanceSchema);
module.exports = Attendance;