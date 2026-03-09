const mongoose = require('mongoose');

const tableSchema = new mongoose.Schema(
  {
    tableNumber: {
      type: String,
      required: [true, 'Table number is required'],
      unique: true,
      trim: true,
      uppercase: true,
      maxlength: [10, 'Table number cannot exceed 10 characters'],
    },
    // Physical location in the venue
    section: {
      type: String,
      required: [true, 'Section is required'],
      enum: {
        values: ['indoor', 'outdoor', 'rooftop', 'private', 'cafeteria'],
        message: 'Invalid section. Choose: indoor, outdoor, rooftop, private, cafeteria',
      },
      default: 'indoor',
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
      max: [30, 'Capacity cannot exceed 30'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },
    amenities: [
      {
        type: String,
        enum: ['window_view', 'ac', 'wheelchair_accessible', 'power_outlet', 'projector', 'whiteboard'],
      },
    ],
    isActive: {
      type: Boolean,
      default: true,
    },
    // Temporarily out of service (maintenance, cleaning, etc.)
    isUnderMaintenance: {
      type: Boolean,
      default: false,
    },
    maintenanceNote: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    // Floor / room number (optional, for multi-floor setups)
    floor: {
      type: Number,
      default: 1,
    },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
tableSchema.index({ section: 1, isActive: 1 });
tableSchema.index({ tableNumber: 1 });
tableSchema.index({ capacity: 1 });

// ─── Virtual: Is bookable right now? ──────────────────────────────────────────
tableSchema.virtual('isBookable').get(function () {
  return this.isActive && !this.isUnderMaintenance;
});

// ─── Static: Find all bookable tables ─────────────────────────────────────────
tableSchema.statics.findBookable = function (filter = {}) {
  return this.find({ ...filter, isActive: true, isUnderMaintenance: false });
};

const Table = mongoose.model('Table', tableSchema);
module.exports = Table;
