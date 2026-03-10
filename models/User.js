const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 12;
const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 3;
const LOCK_TIME = (parseInt(process.env.LOCK_TIME_MINUTES) || 30) * 60 * 1000;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
    },
    role: {
      type: String,
      enum: {
        values: ['admin', 'faculty', 'student', 'canteen'],
	message: 'Role must be admin, faculty, student, or canteen',
      },
      default: 'student',
    },
    department: {
      type: String,
      trim: true,
      enum: {
        values: ['Computer Science', 'Electrical & Electronics', 'Mechanical', 'Administration', 'Canteen Services', ''],
        message: 'Invalid department',
      },
    },
    // For students: which semester they are in
    semester: {
      type: String,
      trim: true,
      enum: { values: ['1', '2', '3', '4', '5', '6', ''], message: 'Invalid semester' },
      default: '',
    },
    studentId: {
      type: String,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: false,
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
    },
    // Account locking fields
    loginAttempts: {
      type: Number,
      default: 0,
    },
    lockUntil: {
      type: Date,
      default: null,
    },
    lastLogin: {
      type: Date,
      default: null,
    },
    lastFailedLogin: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Virtual: Is account currently locked?
userSchema.virtual('isLocked').get(function () {
  return this.lockUntil && this.lockUntil > Date.now();
});

// Pre-save hook: Hash password
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    next();
  } catch (err) {
    next(err);
  }
});

// Method: Compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method: Increment login attempts and lock if needed
userSchema.methods.incLoginAttempts = async function () {
  // If lock has expired, reset
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1, lastFailedLogin: new Date() },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = {
    $inc: { loginAttempts: 1 },
    $set: { lastFailedLogin: new Date() },
  };

  // Lock the account if max attempts reached
  if (this.loginAttempts + 1 >= MAX_ATTEMPTS) {
    updates.$set.lockUntil = new Date(Date.now() + LOCK_TIME);
  }

  return this.updateOne(updates);
};

// Method: Reset login attempts on successful login
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0, lastLogin: new Date() },
    $unset: { lockUntil: 1 },
  });
};

// Method: Safe user object (no password)
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject({ virtuals: true });
  delete obj.password;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  delete obj.__v;
  return obj;
};

// Static: Find by email (for login)
userSchema.statics.findByEmail = function (email) {
  return this.findOne({ email: email.toLowerCase().trim() });
};

const User = mongoose.model('User', userSchema);
module.exports = User;
