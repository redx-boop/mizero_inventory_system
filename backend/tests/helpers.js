const request = require('supertest');

// Import the app (server exports it via module.exports)
let app;

/**
 * Get the Express app instance
 */
function getApp() {
  if (!app) {
    app = require('../server');
  }
  return app;
}

/**
 * Extract the raw cookie value from a Set-Cookie header.
 * Set-Cookie format: "name=value; Path=/; Max-Age=86400; ..."
 * We need just "name=value" for the Cookie header.
 */
function extractCookieValue(setCookieHeader) {
  if (!setCookieHeader) return null;
  const cookies = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
  for (const c of cookies) {
    if (c.startsWith('_csrf=')) {
      // Return just "name=value" before the first attribute separator
      return c.split(';')[0];
    }
  }
  return null;
}

/**
 * Log in as a test user and get the auth token + CSRF token
 * @param {string} email - User email
 * @param {string} password - User password
 * @returns {Promise<{token: string, csrfToken: string, csrfCookie: string, user: Object}>}
 */
async function loginAs(email, password) {
  const app = getApp();

  // First get CSRF token (sets the cookie)
  const csrfRes = await request(app)
    .get('/api/csrf-token')
    .set('Accept', 'application/json');

  const csrfToken = csrfRes.body.csrfToken;
  // Extract just the raw cookie name=value (no attributes)
  const csrfCookie = extractCookieValue(csrfRes.headers['set-cookie']);

  if (!csrfCookie) {
    throw new Error('Failed to get CSRF cookie from server');
  }

  // Login (login endpoint has CSRF exemption, so no header needed)
  const loginRes = await request(app)
    .post('/api/auth/login')
    .set('Cookie', csrfCookie)
    .send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.body.message}`);
  }

  return {
    token: loginRes.body.token,
    csrfToken,
    csrfCookie,
    user: loginRes.body.user,
    cookie: csrfCookie
  };
}

/**
 * Helper to make authenticated + CSRF-protected requests.
 * Sends the CSRF cookie and X-CSRF-Token header automatically.
 * In test mode (NODE_ENV=test), CSRF cookie rotation is disabled,
 * so the same auth object can be reused across multiple tests.
 */
function authRequest(method, url, auth) {
  const app = getApp();
  let req = request(app)[method](url);

  if (auth.csrfCookie) {
    req = req.set('Cookie', auth.csrfCookie);
  }
  if (auth.token) {
    req = req.set('Authorization', `Bearer ${auth.token}`);
  }
  if (auth.csrfToken) {
    req = req.set('X-CSRF-Token', auth.csrfToken);
  }

  return req;
}

/**
 * Get just the CSRF cookie/token without logging in.
 * Used for tests that need to make unauthenticated requests
 * that still pass CSRF validation.
 */
async function getCsrfOnly() {
  const app = getApp();
  const csrfRes = await request(app)
    .get('/api/csrf-token')
    .set('Accept', 'application/json');

  return {
    csrfCookie: extractCookieValue(csrfRes.headers['set-cookie']),
    csrfToken: csrfRes.body.csrfToken
  };
}

module.exports = { getApp, loginAs, authRequest, getCsrfOnly };
