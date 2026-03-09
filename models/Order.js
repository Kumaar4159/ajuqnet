const mongoose = require('mongoose');

// ─── Embedded Order Item ───────────────────────────────────────────────────────
const orderItemSchema = new mongoose.Schema(
  {
    menuItem: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'MenuItem',
      required: true,
    },
    name: { type: String, required: true },   // snapshot at order time
    price: { type: Number, required: true },  // snapshot at order time
    quantity: {
      type: Number,
      required: true,
      min: [1, 'Quantity must be at least 1'],
      max: [20, 'Cannot order more than 20 of one item'],
    },
    subtotal: { type: Number, required: true },
    specialInstructions: {
      type: String,
      trim: true,
      maxlength: 200,
    },
  },
  { _id: false }
);

// ─── Status History Entry ──────────────────────────────────────────────────────
const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    changedByName: { type: String },
    note: { type: String, trim: true, maxlength: 300 },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// ─── Order Schema ──────────────────────────────────────────────────────────────
const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      unique: true,
    },
    placedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    placedByName: { type: String, required: true },
    placedByRole: { type: String, required: true },

    items: {
      type: [orderItemSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: 'Order must contain at least one item',
      },
    },

    status: {
      type: String,
      enum: {
        values: ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
        message: 'Invalid order status',
      },
      default: 'pending',
    },

    statusHistory: [statusHistorySchema],

    subtotal: { type: Number, required: true },
    tax: { type: Number, default: 0 },
    discount: { type: Number, default: 0 },
    total: { type: Number, required: true },

    deliveryLocation: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },

    // ── Payment ──────────────────────────────────────────────────────────────
    paymentStatus: {
      type:    String,
      enum:    ['unpaid', 'paid', 'refunded'],
      default: 'unpaid',
    },
    paymentMethod: {
      type:    String,
      enum:    ['upi', 'card', 'netbanking', 'cash', null],
      default: null,
    },
    paidAt: { type: Date, default: null },

    estimatedReadyAt: { type: Date },
    confirmedAt: { type: Date },
    readyAt: { type: Date },
    deliveredAt: { type: Date },
    cancelledAt: { type: Date },
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancellationReason: { type: String, trim: true },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
orderSchema.index({ placedBy: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ orderNumber: 1 });

// ─── Auto-generate order number ───────────────────────────────────────────────
orderSchema.pre('save', async function (next) {
  if (!this.orderNumber) {
    const date = new Date();
    const prefix = `ORD-${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(date.getDate()).padStart(2, '0')}`;
    const count = await mongoose.model('Order').countDocuments();
    this.orderNumber = `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }
  next();
});

// ─── Valid status transitions ──────────────────────────────────────────────────
const STATUS_TRANSITIONS = {
  pending:    ['confirmed', 'cancelled'],
  confirmed:  ['preparing', 'cancelled'],
  preparing:  ['ready', 'cancelled'],
  ready:      ['delivered'],
  delivered:  [],
  cancelled:  [],
};

// ─── Role-based transition permissions ────────────────────────────────────────
const ROLE_ALLOWED_TRANSITIONS = {
  admin:   ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
  faculty: ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
  canteen: ['confirmed', 'preparing', 'ready', 'delivered', 'cancelled'],
  student: ['cancelled'],
};

orderSchema.methods.canTransitionTo = function (newStatus, userRole, isOwnOrder) {
  const allowed = STATUS_TRANSITIONS[this.status];
  if (!allowed.includes(newStatus)) return false;

  const roleAllowed = ROLE_ALLOWED_TRANSITIONS[userRole] || [];
  if (!roleAllowed.includes(newStatus)) return false;

  // Students can only cancel their own pending orders
  if (userRole === 'student' && newStatus === 'cancelled') {
    return isOwnOrder && this.status === 'pending';
  }

  return true;
};

orderSchema.statics.STATUS_TRANSITIONS = STATUS_TRANSITIONS;
orderSchema.statics.ROLE_ALLOWED_TRANSITIONS = ROLE_ALLOWED_TRANSITIONS;

const Order = mongoose.model('Order', orderSchema);
module.exports = Order;
