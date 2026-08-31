const crypto = require('crypto');

/**
 * CSRF Protection Middleware
 *
 * Implements the double-submit cookie pattern:
 * 1. On safe requests (GET, HEAD, OPTIONS): Sets a CSRF cookie if absent
 * 2. On state-changing requests (POST, PUT, DELETE, PATCH):
 *    Validates that the X-CSRF-Token header matches the CSRF cookie value
 *
 * The cookie is non-httpOnly so the frontend can read it via document.cookie.
 * SameSite: Lax prevents the cookie from being sent on cross-origin requests.
 * Secure flag is enabled in production.
 */
function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

const SAFE_METHODS = ['GET', 'HEAD', 'OPTIONS'];

// Paths excluded from CSRF validation (e.g., auth login has its own rate limiting)
const EXCLUDED_PATHS = ['/auth/login', '/contact'];

/**
 * CSRF middleware — call as app.use(csrfProtection)
 */
function csrfProtection(req, res, next) {
  // Skip CSRF for excluded paths (login has its own rate limiting)
  if (EXCLUDED_PATHS.includes(req.path)) return next();

  // --- Safe methods: ensure cookie is set ---
  if (SAFE_METHODS.includes(req.method)) {
    if (!req.cookies || !req.cookies['_csrf']) {
      const token = generateToken();
      req.csrfToken = token; // Pass to downstream handlers (e.g., getCsrfToken)
      res.cookie('_csrf', token, {
        httpOnly: false,   // Frontend JS needs to read it
        sameSite: 'lax',   // Prevent cross-origin sending
        secure: process.env.NODE_ENV === 'production',
        maxAge: 24 * 60 * 60 * 1000 // 24 hours
      });
    }
    return next();
  }

  // --- State-changing methods: validate ---
  if (!req.cookies || !req.cookies['_csrf']) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token cookie is missing. Refresh the page and try again.'
    });
  }

  const cookieToken = req.cookies['_csrf'];
  const headerToken = req.headers['x-csrf-token'];

  if (!headerToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token header (X-CSRF-Token) is missing.'
    });
  }

  if (cookieToken !== headerToken) {
    return res.status(403).json({
      success: false,
      message: 'CSRF token mismatch. Possible cross-site request forgery.'
    });
  }

  // Token valid — rotate the cookie for forward secrecy (skip in test mode to keep test fixtures valid)
  if (process.env.NODE_ENV !== 'test') {
    const newToken = generateToken();
    res.cookie('_csrf', newToken, {
      httpOnly: false,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: 24 * 60 * 60 * 1000
    });
  }

  next();
}

/**
 * GET /api/csrf-token — Returns the current CSRF token
 * The frontend can call this to ensure the cookie is set and read its value.
 *
 * IMPORTANT: Do NOT call res.cookie() here — the CSRF middleware (csrfProtection)
 * already sets the cookie for GET requests. Setting a cookie here would create
 * a second Set-Cookie header with a potentially different token value,
 * causing a mismatch between the cookie and the JSON body.
 */
function getCsrfToken(req, res) {
  // Use the token from req.csrfToken (set by csrfProtection middleware for first request),
  // or from the cookie (for subsequent requests), or generate a fallback.
  const token = req.csrfToken
    || (req.cookies && req.cookies['_csrf'])
    || generateToken();

  res.json({
    success: true,
    csrfToken: token
  });
}

module.exports = { csrfProtection, getCsrfToken };
