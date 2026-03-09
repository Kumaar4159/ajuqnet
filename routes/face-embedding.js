'use strict';
/**
 * Face embedding API — additive routes mounted at /dashboard/profile
 * Stores Float32Array descriptors as a regular JSON array in the User document.
 * Because this is additive, we patch User schema at startup via a Mongoose plugin
 * instead of modifying models/User.js.
 */

const express      = require('express');
const router       = express.Router();
const mongoose     = require('mongoose');
const { requireAuth } = require('../middleware/auth');

// ── Lazily add faceEmbedding field to User schema ────────────────────────────
// This runs once when the module is first loaded. It's safe because Mongoose
// ignores add() calls after a model is compiled only if you call discriminator;
// adding a path to an existing schema before the model is accessed is fine.
const User = require('../models/User');
if (!User.schema.path('faceEmbedding')) {
  User.schema.add({
    faceEmbedding: { type: [Number], default: null },
  });
}

// ── GET /dashboard/profile/face-embedding  (called by scan page) ──────────────
router.get('/face-embedding', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.session.userId).select('faceEmbedding').lean();
    if (!user || !user.faceEmbedding || user.faceEmbedding.length === 0) {
      return res.status(404).json({ embedding: null });
    }
    res.json({ embedding: user.faceEmbedding });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /dashboard/profile/face-embedding  (called by face setup page) ───────
router.post('/face-embedding', requireAuth, async (req, res) => {
  try {
    const { embedding } = req.body;
    if (!Array.isArray(embedding) || embedding.length === 0) {
      return res.status(400).json({ ok: false, error: 'Invalid embedding data.' });
    }
    // face-api descriptors are Float32Array of length 128
    if (embedding.length !== 128) {
      return res.status(400).json({ ok: false, error: 'Embedding must be 128-dimensional.' });
    }
    await User.findByIdAndUpdate(req.session.userId, { faceEmbedding: embedding });
    res.json({ ok: true, message: 'Face profile saved successfully.' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

// ── DELETE /dashboard/profile/face-embedding ─────────────────────────────────
router.delete('/face-embedding', requireAuth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.session.userId, { faceEmbedding: null });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

module.exports = router;