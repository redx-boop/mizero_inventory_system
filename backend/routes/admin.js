const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const { verifyPassword, resetData } = require('../controllers/adminController');

// Strict rate limiter for destructive admin operations (max 3 per hour)
const adminResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3,
  message: {
    success: false,
    message: 'Too many reset attempts. Maximum 3 per hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

// All admin routes require authentication + super_admin role
router.use(authenticate);
router.use(authorize('super_admin'));

// POST /api/admin/verify-password — Verify super_admin password before destructive operations
router.post('/verify-password', verifyPassword);

// POST /api/admin/reset-data — Reset all transactional data (multi-factor confirmation required)
router.post('/reset-data', adminResetLimiter, resetData);

module.exports = router;
