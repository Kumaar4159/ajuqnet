const mongoose = require('mongoose');

const menuItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Item name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, 'Description cannot exceed 500 characters'],
    },
    category: {
      type: String,
      required: [true, 'Category is required'],
      enum: {
        values: ['breakfast', 'lunch', 'dinner', 'snacks', 'beverages', 'desserts', 'specials'],
        message: 'Invalid category',
      },
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    currency: {
      type: String,
      default: 'INR',
      enum: ['INR', 'USD', 'EUR'],
    },
    isAvailable: {
      type: Boolean,
      default: true,
    },
    isVegetarian: {
      type: Boolean,
      default: false,
    },
    allergens: [
      {
        type: String,
        enum: ['gluten', 'dairy', 'nuts', 'eggs', 'soy', 'shellfish'],
      },
    ],
    preparationTime: {
      type: Number, // minutes
      default: 15,
      min: 1,
    },
    stock: {
      type: Number,
      default: null, // null = unlimited
      min: 0,
    },
    image: {
      type: String, // URL
      trim: true,
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
  },
  {
    timestamps: true,
  }
);

// Index for fast menu lookups
menuItemSchema.index({ category: 1, isAvailable: 1 });
menuItemSchema.index({ name: 'text', description: 'text' });

// Virtual: Is out of stock?
menuItemSchema.virtual('isOutOfStock').get(function () {
  return this.stock !== null && this.stock <= 0;
});

// Method: Decrement stock
menuItemSchema.methods.decrementStock = async function (qty) {
  if (this.stock !== null) {
    if (this.stock < qty) throw new Error(`Insufficient stock for "${this.name}"`);
    return this.updateOne({ $inc: { stock: -qty } });
  }
};

// Method: Restore stock (on order cancellation)
menuItemSchema.methods.restoreStock = async function (qty) {
  if (this.stock !== null) {
    return this.updateOne({ $inc: { stock: qty } });
  }
};

const MenuItem = mongoose.model('MenuItem', menuItemSchema);
module.exports = MenuItem;
