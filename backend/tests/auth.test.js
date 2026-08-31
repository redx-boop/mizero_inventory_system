const { getApp, loginAs, authRequest } = require('./helpers');

const request = require('supertest');
let app;

beforeAll(() => {
  app = getApp();
});

describe('🔐 Auth - Login', () => {
  test('should reject empty request', async () => {
    const res = await authRequest('post', '/api/auth/login', {});
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('should reject invalid credentials', async () => {
    const res = await authRequest('post', '/api/auth/login', {})
      .send({ email: 'nobody@test.com', password: 'wrongpass' });
    // Login is CSRF-exempt but still validates email format
    // If the email is invalid (no @), it'll fail validation first
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('should reject wrong password for existing user', async () => {
    const res = await authRequest('post', '/api/auth/login', {})
      .send({ email: 'admin@mizero.com', password: 'WrongPassword123!' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/Invalid email or password/i);
  });

  test('should login successfully with valid admin credentials', async () => {
    const auth = await loginAs('admin@mizero.com', 'password123');

    expect(auth.token).toBeTruthy();
    expect(auth.user).toBeTruthy();
    expect(auth.user.role).toBe('super_admin');
    expect(auth.user.full_name).toBeTruthy();
    expect(auth.user.email).toBe('admin@mizero.com');
    expect(typeof auth.user.must_change_password).toBe('boolean');
  });

  test('should return must_change_password flag on login', async () => {
    const auth = await loginAs('admin@mizero.com', 'password123');
    expect(auth.user).toHaveProperty('must_change_password');
    // Admin already exists, so should be 0
    expect(auth.user.must_change_password).toBe(false);
  });
});

describe('🔐 Auth - Get Current User', () => {
  test('should reject without token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('should return current user with valid token', async () => {
    const auth = await loginAs('admin@mizero.com', 'password123');
    const res = await authRequest('get', '/api/auth/me', auth);
    expect(res.status).toBe(200);
    expect(res.body.user).toBeTruthy();
    expect(res.body.user.email).toBe('admin@mizero.com');
  });
});

describe('🔐 Auth - Change Password', () => {
  test('should reject change password without CSRF token', async () => {
    const auth = await loginAs('admin@mizero.com', 'password123');
    // Send without CSRF cookie/header
    const res = await request(app)
      .put('/api/auth/change-password')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ current_password: 'password123', new_password: 'NewPass123!' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/i);
  });

  test('should reject weak password', async () => {
    const auth = await loginAs('admin@mizero.com', 'password123');
    const res = await authRequest('put', '/api/auth/change-password', auth)
      .send({ current_password: 'password123', new_password: 'short' });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });
});

// We don't actually change the password here because it would break subsequent tests.
// The change-password flow is tested via the ForcePasswordChange page functional test.

describe('🔐 Auth - CSRF Protection', () => {
  test('should return CSRF token', async () => {
    const res = await request(app)
      .get('/api/csrf-token')
      .set('Accept', 'application/json');

    expect(res.status).toBe(200);
    expect(res.body.csrfToken).toBeTruthy();
    expect(res.body.success).toBe(true);
  });

  test('should reject state-changing request without CSRF', async () => {
    // Login is CSRF-exempt, but a protected mutation should fail
    const auth = await loginAs('admin@mizero.com', 'password123');

    // Get categories first (GET request - no CSRF needed)
    const res = await request(app)
      .put('/api/auth/profile')
      .set('Authorization', `Bearer ${auth.token}`)
      .send({ full_name: 'Test User' });

    expect(res.status).toBe(403);
    expect(res.body.message).toMatch(/CSRF/i);
  });
});

