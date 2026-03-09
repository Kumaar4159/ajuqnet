const mongoose = require('mongoose');

// ─── Reaction sub-document ─────────────────────────────────────────────────────
const reactionSchema = new mongoose.Schema(
  {
    emoji:  { type: String, required: true, maxlength: 8 },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name:   { type: String },
  },
  { _id: false }
);

// ─── Message Schema ────────────────────────────────────────────────────────────
const messageSchema = new mongoose.Schema(
  {
    room: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'ChatRoom',
      required: [true, 'Room is required'],
    },
    sender: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: [true, 'Sender is required'],
    },
    senderName: { type: String, required: true }, // snapshot — survives user rename
    senderRole: { type: String, required: true }, // snapshot

    // ── Encrypted content ─────────────────────────────────────────────────
    // Stored as "<iv_hex>:<authTag_hex>:<ciphertext_hex>" (AES-256-GCM)
    // NEVER store plaintext here.
    encryptedContent: {
      type:     String,
      required: [true, 'Message content is required'],
    },

    // ── Message type ──────────────────────────────────────────────────────
    messageType: {
      type:    String,
      enum:    ['text', 'system', 'file_link'],
      default: 'text',
    },

    // ── Thread / reply ─────────────────────────────────────────────────────
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref:  'Message',
      default: null,
    },

    // ── Edit history ──────────────────────────────────────────────────────
    isEdited: { type: Boolean, default: false },
    editedAt: { type: Date },
    // Previous encrypted versions kept for audit trail
    editHistory: [
      {
        encryptedContent: String,
        editedAt:         { type: Date, default: Date.now },
        _id:              false,
      },
    ],

    // ── Soft delete ───────────────────────────────────────────────────────
    isDeleted:   { type: Boolean, default: false },
    deletedAt:   { type: Date },
    deletedBy:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // ── Reactions ─────────────────────────────────────────────────────────
    reactions: [reactionSchema],

    // ── Read receipts (lightweight — just IDs) ────────────────────────────
    readBy: [
      {
        user:   { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        readAt: { type: Date, default: Date.now },
        _id:    false,
      },
    ],
  },
  { timestamps: true }
);

// ─── Indexes ───────────────────────────────────────────────────────────────────
messageSchema.index({ room: 1, createdAt: -1 });   // primary chat history query
messageSchema.index({ sender: 1, createdAt: -1 });
messageSchema.index({ room: 1, isDeleted: 1, createdAt: -1 });

const Message = mongoose.model('Message', messageSchema);
module.exports = Message;
