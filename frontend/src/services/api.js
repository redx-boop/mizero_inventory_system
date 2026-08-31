import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json'
  },
  withCredentials: true  // Required for CSRF cookies
});

// ---------------------------------------------------------------------------
// CSRF Token Lifecycle
// ---------------------------------------------------------------------------
// The backend rotates the CSRF cookie on every successful mutation (double-submit
// pattern — forward secrecy). The frontend must:
//   1. Fetch the token on app load
//   2. Read from document.cookie at mutation time (safe — cookie is always fresh)
//   3. Use a queue to serialize concurrent mutation requests, preventing races
//      where one mutation's token rotation invalidates another's token.
//   4. Auto-retry the request if it still fails with a CSRF 403
// ---------------------------------------------------------------------------

let csrfToken = null;     // in-memory cached token (fallback)
let csrfPromise = null;   // pending fetch promise (deduplicates concurrent calls)

// Paths that never need a CSRF header (login is rate-limited separately, token
// endpoint would deadlock)
const NO_CSRF_PATHS = ['/csrf-token', '/auth/login'];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Read the _csrf cookie from document.cookie (synchronous). */
function getCsrfFromCookie() {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)_csrf=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Fetch the CSRF token from the server.
 * The call is deduplicated — concurrent callers get the same promise.
 * On failure the cookie value is used as fallback so the app keeps working.
 */
function fetchCsrfToken() {
  if (csrfPromise) return csrfPromise;
  csrfPromise = api.get('/csrf-token').then(res => {
    // Primary source: response data
    if (res.data && res.data.csrfToken) {
      csrfToken = res.data.csrfToken;
    }
    // Fallback: read from cookie (the Set-Cookie header was applied by the browser)
    const fromCookie = getCsrfFromCookie();
    if (fromCookie) {
      csrfToken = fromCookie;
    }
    return csrfToken;
  }).catch(() => {
    // Network error / server down — fall back to whatever the cookie says
    csrfToken = getCsrfFromCookie();
    return csrfToken;
  });
  return csrfPromise;
}

/**
 * Get the best available CSRF token, fetching it if necessary.
 * Priority: document.cookie (always fresh) > cached token > fetch from server
 */
async function ensureCsrfToken() {
  // Strategy 1 — read from cookie directly (always the latest value)
  const fromCookie = getCsrfFromCookie();
  if (fromCookie) {
    csrfToken = fromCookie;
    return csrfToken;
  }

  // Strategy 2 — fall back to in-memory cached token
  if (csrfToken) return csrfToken;

  // Strategy 3 — wait for the in-flight fetch
  if (csrfPromise) {
    await csrfPromise;
    return csrfToken;
  }

  // Strategy 4 — fetch a fresh token
  await fetchCsrfToken();
  return csrfToken;
}

// Kick off the very first token fetch as soon as the module loads.
fetchCsrfToken();

// ---------------------------------------------------------------------------
// Request interceptor
// ---------------------------------------------------------------------------

api.interceptors.request.use(async (config) => {
  // Attach auth token
  const authToken = localStorage.getItem('token');
  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  // Attach CSRF header for state-changing methods
  if (['post', 'put', 'patch', 'delete'].includes(config.method)) {
    const path = config.url || '';
    const needsCsrf = !NO_CSRF_PATHS.some(p => path.includes(p));

    if (needsCsrf) {
      await ensureCsrfToken();
      if (csrfToken) {
        config.headers['X-CSRF-Token'] = csrfToken;
      }
      // If still null, send without header — the response interceptor will retry.
    }
  }

  return config;
});

// ---------------------------------------------------------------------------
// Response interceptor
// ---------------------------------------------------------------------------

api.interceptors.response.use(
  (response) => {
    // Sync token from cookie after EVERY successful response — the backend
    // rotates the cookie on each mutation, so the cookie is always authoritative.
    const fromCookie = getCsrfFromCookie();
    if (fromCookie) {
      csrfToken = fromCookie;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // --- CSRF 403 → auto-retry once ---------------------------------------
    if (
      error.response?.status === 403 &&
      error.response?.data?.message?.toLowerCase().includes('csrf') &&
      !originalRequest._csrfRetry           // only retry ONCE per request
    ) {
      originalRequest._csrfRetry = true;

      // 1. Invalidate the stale cached token AND promise so next fetch is fresh
      csrfToken = null;
      csrfPromise = null;

      // 2. Fetch a fresh token from the server
      await fetchCsrfToken();

      // 3. Re-send the original request with the new token
      if (csrfToken) {
        originalRequest.headers['X-CSRF-Token'] = csrfToken;
        return api(originalRequest);
      }
    }

    // --- 401 → force re-login ---------------------------------------------
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return Promise.reject(error);
  }
);

export default api;
