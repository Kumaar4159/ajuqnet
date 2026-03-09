'use strict';
const { body, validationResult } = require('express-validator');

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Collects express-validator errors and attaches them to res.locals
 * so EJS views can render field-level messages.
 * Returns true if there are errors (caller should re-render).
 */
function collectErrors(req, res) {
  const result = validationResult(req);
  if (result.isEmpty()) return false;

  // Array of { field, msg } objects
  res.locals.validationErrors = result.array().map(e => ({
    field: e.path,
    msg:   e.msg,
  }));

  // Convenience: first error message as a single string (for views that use `error`)
  res.locals.validationError = res.locals.validationErrors[0].msg;

  return true;
}

// ── Login rules ──────────────────────────────────────────────────────────────
const loginRules = [
  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Enter a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ max: 128 }).withMessage('Password is too long.'),
];

// ── Register rules ───────────────────────────────────────────────────────────
const registerRules = [
  body('name')
    .trim()
    .notEmpty().withMessage('Full name is required.')
    .isLength({ min: 2, max: 80 }).withMessage('Name must be 2–80 characters.')
    .escape(),

  body('email')
    .trim()
    .notEmpty().withMessage('Email is required.')
    .isEmail().withMessage('Enter a valid email address.')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required.')
    .isLength({ min: 8, max: 128 }).withMessage('Password must be 8–128 characters.')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter.')
    .matches(/[0-9]/).withMessage('Password must contain at least one number.'),

  body('role')
    .optional()
    .trim()
    .isIn(['student', 'faculty', 'canteen']).withMessage('Role must be student, faculty, or canteen.'),

  body('department')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Department name is too long.')
    .escape(),

  body('studentId')
    .optional()
    .trim()
    .isLength({ max: 30 }).withMessage('Student ID is too long.')
    .escape(),
];

// ── Order rules ──────────────────────────────────────────────────────────────
const orderRules = [
  body('items')
    .optional()   // items JSON is optional — fallback uses itemId[]/qty[] fields
    .custom((val) => {
      if (val) {
        try {
          const arr = JSON.parse(val);
          if (!Array.isArray(arr) || arr.length === 0) throw new Error();
          return true;
        } catch {
          throw new Error('Invalid item selection. Please try again.');
        }
      }
      // No JSON items field — route handler checks itemId[] fallback
      return true;
    }),

  body('deliveryLocation')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Delivery location is too long.')
    .escape(),

  body('notes')
    .optional()
    .trim()
    .isLength({ max: 300 }).withMessage('Notes cannot exceed 300 characters.')
    .escape(),
];

module.exports = { loginRules, registerRules, orderRules, collectErrors };