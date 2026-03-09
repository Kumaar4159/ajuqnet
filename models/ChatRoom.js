const mongoose = require('mongoose');

const chatRoomSchema = new mongoose.Schema(
  {
    // ── Identity ────────────────────────────────────────────────────────────
    name: {
      type: String,
      required: [true, 'Room name is required'],
      trim: true,
      maxlength: [100, 'Room name cannot exceed 100 characters'],
    },
    slug: {
      type: String,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: [300, 'Description cannot exceed 300 characters'],
    },

    // ── Type ────────────────────────────────────────────────────────────────
    type: {
      type: String,
      enum: {
        values: ['public', 'private', 'direct'],
        message: 'Type must be public, private, or direct',
      },
      default: 'public',
    },

    // ── Role-based access ───────────────────────────────────────────────────
    // Which roles are allowed to join/read this room
    allowedRoles: {
      type: [String],
      enum: ['admin', 'faculty', 'student', 'canteen'],
      default: ['admin', 'faculty', 'student'],
    },

    // ── Members ─────────────────────────────────────────────────────────────
    members: [
      {
        user:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
        role:     { type: String },           // snapshot of role at join time
        joinedAt: { type: Date, default: Date.now },
        isAdmin:  { type: Boolean, default: false }, // room admin (can kick/invite)
      },
    ],

    // ── For direct (1-on-1) rooms only ──────────────────────────────────────
    // Sorted participant IDs as a quick lookup key to avoid duplicate DM rooms
    directKey: {
      type:   String,
      unique: true,
      sparse: true, // only indexed when present
    },

    // ── Metadata ────────────────────────────────────────────────────────────
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
    lastMessageAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
chatRoomSchema.index({ type: 1, isActive: 1 });
chatRoomSchema.index({ 'members.user': 1 });
chatRoomSchema.index({ directKey: 1 });

// ─── Auto-generate slug ────────────────────────────────────────────────────────
chatRoomSchema.pre('save', async function (next) {
  if (!this.slug) {
    const base = this.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    const count  = await mongoose.model('ChatRoom').countDocuments({ slug: new RegExp(`^${base}`) });
    this.slug    = count === 0 ? base : `${base}-${count}`;
  }
  next();
});

// ─── Static: Find or create a direct room between two users ───────────────────
chatRoomSchema.statics.findOrCreateDirect = async function (userA, userB, creatorName) {
  // Stable key: sort IDs so A↔B and B↔A map to the same key
  const key = [userA._id.toString(), userB._id.toString()].sort().join('_');

  let room = await this.findOne({ directKey: key });
  if (room) return { room, created: false };

  room = await this.create({
    name:         `DM: ${userA.name} & ${userB.name}`,
    type:         'direct',
    allowedRoles: ['admin', 'faculty', 'student'],
    directKey:    key,
    createdBy:    userA._id,
    members: [
      { user: userA._id, role: userA.role, isAdmin: true  },
      { user: userB._id, role: userB.role, isAdmin: false },
    ],
  });

  return { room, created: true };
};

const ChatRoom = mongoose.model('ChatRoom', chatRoomSchema);
module.exports = ChatRoom;
