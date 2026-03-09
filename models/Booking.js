const mongoose = require('mongoose');

// ─── Status history sub-document ──────────────────────────────────────────────
const bookingStatusHistorySchema = new mongoose.Schema(
  {
    status:        { type: String, required: true },
    changedBy:     { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String },
    note:          { type: String, trim: true, maxlength: 300 },
    timestamp:     { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Booking Schema ────────────────────────────────────────────────────────────
const bookingSchema = new mongoose.Schema(
  {
    bookingReference: {
      type: String,
      unique: true,
    },

    // Who booked
    bookedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    bookedByName: { type: String, required: true },
    bookedByRole: { type: String, required: true },

    // Which table
    table: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Table',
      required: [true, 'Table is required'],
    },
    tableNumber: { type: String, required: true }, // snapshot

    // Time slot — core conflict prevention fields
    date: {
      type: Date,
      required: [true, 'Booking date is required'],
    },
    startTime: {
      type: Date,
      required: [true, 'Start time is required'],
    },
    endTime: {
      type: Date,
      required: [true, 'End time is required'],
    },
    durationMinutes: {
      type: Number,
      required: true,
    },

    // Guest details
    guestCount: {
      type: Number,
      required: [true, 'Guest count is required'],
      min: [1, 'Must have at least 1 guest'],
    },
    purpose: {
      type: String,
      enum: {
        values: ['dining', 'meeting', 'study', 'event', 'other'],
        message: 'Invalid purpose',
      },
      default: 'dining',
    },
    specialRequests: {
      type: String,
      trim: true,
      maxlength: [500, 'Special requests cannot exceed 500 characters'],
    },

    // Workflow status
    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'],
        message: 'Invalid booking status',
      },
      default: 'pending',
    },
    statusHistory: [bookingStatusHistorySchema],

    // Cancellation
    cancelledAt:        { type: Date },
    cancelledBy:        { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true, maxlength: 300 },

    // Check-in / check-out
    checkedInAt:  { type: Date },
    completedAt:  { type: Date },

    // Admin/Faculty notes
    internalNote: { type: String, trim: true, maxlength: 300 },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
// Critical: used for conflict detection query — must be compound
bookingSchema.index({ table: 1, startTime: 1, endTime: 1, status: 1 });
bookingSchema.index({ bookedBy: 1, date: 1 });
bookingSchema.index({ date: 1, status: 1 });
bookingSchema.index({ bookingReference: 1 });

// ─── Auto-generate booking reference ──────────────────────────────────────────
bookingSchema.pre('save', async function (next) {
  if (!this.bookingReference) {
    const d = this.date;
    const prefix = `BKG-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    const count = await mongoose.model('Booking').countDocuments();
    this.bookingReference = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// ─── CORE: Time-slot conflict detection (static) ───────────────────────────────
//
//  Two bookings conflict when their time intervals overlap:
//
//    Booking A: [startA ─────────── endA]
//    Booking B:       [startB ────────────── endB]
//
//  Overlap condition (negation of NO-overlap):
//    NOT (endB <= startA OR startB >= endA)
//    => startB < endA AND endB > startA
//
//  We exclude the booking being edited (excludeId) and
//  only check active bookings (non-cancelled, non-completed).
//
bookingSchema.statics.findConflicts = async function ({
  tableId,
  startTime,
  endTime,
  excludeId = null,
}) {
  const activeStatuses = ['pending', 'confirmed', 'checked_in'];

  const query = {
    table:     tableId,
    status:    { $in: activeStatuses },
    startTime: { $lt:  endTime   }, // existing booking starts before new one ends
    endTime:   { $gt:  startTime }, // existing booking ends after new one starts
  };

  if (excludeId) {
    query._id = { $ne: excludeId };
  }

  return this.find(query)
    .populate('bookedBy', 'name email role')
    .sort({ startTime: 1 });
};

// ─── Status transition rules ──────────────────────────────────────────────────
const BOOKING_STATUS_TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['checked_in', 'cancelled', 'no_show'],
  checked_in: ['completed'],
  completed:  [],
  cancelled:  [],
  no_show:    [],
};

// Roles allowed to make each transition
const BOOKING_ROLE_TRANSITIONS = {
  admin:   ['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'],
  faculty: ['confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'],
  student: ['cancelled'],
};

bookingSchema.methods.canTransitionTo = function (newStatus, userRole, isOwnBooking) {
  const validNext = BOOKING_STATUS_TRANSITIONS[this.status] || [];
  if (!validNext.includes(newStatus)) return false;

  const roleAllowed = BOOKING_ROLE_TRANSITIONS[userRole] || [];
  if (!roleAllowed.includes(newStatus)) return false;

  // Students may only cancel their own pending/confirmed bookings
  if (userRole === 'student' && newStatus === 'cancelled') {
    return isOwnBooking && ['pending', 'confirmed'].includes(this.status);
  }

  return true;
};

bookingSchema.statics.BOOKING_STATUS_TRANSITIONS = BOOKING_STATUS_TRANSITIONS;
bookingSchema.statics.BOOKING_ROLE_TRANSITIONS    = BOOKING_ROLE_TRANSITIONS;

const Booking = mongoose.model('Booking', bookingSchema);
module.exports = Booking;
