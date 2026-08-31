const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const { login, getCurrentUser, changePassword, resetPassword, updateProfile } = require('../controllers/authController');
const authenticate = require('../middleware/auth');
const authorize = require('../middleware/rbac');
const validate = require('../middleware/validate');

// Password strength validation helper
const passwordStrength = (value) => {
  if (value.length < 8) {
    throw new Error('Password must be at least 8 characters long.');
  }
  if (!/[A-Z]/.test(value)) {
    throw new Error('Password must contain at least one uppercase letter.');
  }
  if (!/[0-9]/.test(value)) {
    throw new Error('Password must contain at least one number.');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(value)) {
    throw new Error('Password must contain at least one special character.');
  }
  return true;
};

// Rate limiting: max 10 login attempts per 15 minutes per IP
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { message: 'Too many login attempts. Please try again after 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false
});

router.post('/login', loginLimiter, [
  body('email').isEmail().withMessage('Valid email is required'),
  body('password').notEmpty().withMessage('Password is required')
], validate, login);

router.get('/me', authenticate, getCurrentUser);

router.put('/change-password', authenticate, [
  body('current_password').notEmpty().withMessage('Current password is required'),
  body('new_password').custom(passwordStrength)
], validate, changePassword);

router.put('/reset-password', authenticate, authorize('super_admin', 'admin'), [
  body('user_id').isInt().withMessage('User ID is required'),
  body('new_password').custom(passwordStrength)
], validate, resetPassword);

// Profile update - authenticated user can update their own name/email
router.put('/profile', authenticate, [
  body('full_name').optional().notEmpty().withMessage('Full name cannot be empty'),
  body('email').optional().isEmail().withMessage('Valid email is required')
], validate, updateProfile);

module.exports = router;
