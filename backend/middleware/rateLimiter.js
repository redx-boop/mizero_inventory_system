const rateLimit = require('express-rate-limit');

/**
 * General mutation rate limiter
 * Limits all POST/PUT/DELETE/PATCH requests to 60 per 15 minutes per IP.
 * This prevents abuse while allowing normal usage patterns.
 */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 60,
  message: {
    success: false,
    message: 'Too many requests. Please slow down and try again after 15 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Skip rate limiting for static file downloads and health checks
  skip: (req) => req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS'
});

/**
 * Strict rate limiter for CSV import operations
 * CSV imports are resource-intensive, so limit more aggressively.
 */
const csvImportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  message: {
    success: false,
    message: 'Too many CSV imports. Maximum 10 per hour.'
  },
  standardHeaders: true,
  legacyHeaders: false
});

module.exports = { apiLimiter, csvImportLimiter };
