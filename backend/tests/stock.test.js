const { getApp, loginAs, authRequest, getCsrfOnly } = require('./helpers');
const request = require('supertest');

let app;
let auth;
let csrf;
let testItem;

beforeAll(async () => {
  app = getApp();
  auth = await loginAs('admin@mizero.com', 'password123');
  csrf = await getCsrfOnly();

  // Fetch a test item to use in stock operations
  const res = await authRequest('get', '/api/items?limit=1', auth);
  if (res.body.items && res.body.items.length > 0) {
    testItem = res.body.items[0];
  }
});

describe('📦 Stock In', () => {
  test('should reject stock-in without auth', async () => {
    const res = await request(app)
      .post('/api/stock-in')
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ item_id: 1, quantity: 5, unit_price: 1000 });

    expect(res.status).toBe(401);
  });

  test('should reject stock-in with invalid data', async () => {
    const res = await authRequest('post', '/api/stock-in', auth)
      .send({ quantity: -1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('should create stock-in successfully', async () => {
    if (!testItem) {
      console.warn('⚠️ No items available for stock-in test');
      return;
    }

    const res = await authRequest('post', '/api/stock-in', auth)
      .send({
        item_id: testItem.id,
        quantity: 5,
        unit_price: 1500,
        notes: 'Test stock in'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/recorded/i);
    expect(res.body.id).toBeGreaterThan(0);
    expect(res.body).toHaveProperty('unit_cost');
  });

  test('should list stock-in records', async () => {
    const res = await authRequest('get', '/api/stock-in', auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('records');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.records)).toBe(true);
  });

  test('should return stock-in receipt', async () => {
    const res = await authRequest('get', '/api/stock-in', auth);
    if (res.body.records.length === 0) return;

    const receiptId = res.body.records[0].id;
    const receipt = await authRequest('get', `/api/stock-in/${receiptId}/receipt`, auth);

    expect(receipt.status).toBe(200);
    expect(receipt.body.id).toBe(receiptId);
  });
});

describe('📤 Stock Out', () => {
  test('should reject stock-out without auth', async () => {
    const res = await request(app)
      .post('/api/stock-out')
      .set('Cookie', csrf.csrfCookie)
      .set('X-CSRF-Token', csrf.csrfToken)
      .send({ item_id: 1, quantity: 1, recipient: 'Test' });

    expect(res.status).toBe(401);
  });

  test('should reject stock-out with invalid data', async () => {
    const res = await authRequest('post', '/api/stock-out', auth)
      .send({ quantity: -1 });

    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Validation failed');
  });

  test('should reject stock-out when insufficient stock', async () => {
    if (!testItem) return;

    // Try to stock out way more than available
    const res = await authRequest('post', '/api/stock-out', auth)
      .send({
        item_id: testItem.id,
        quantity: 999999,
        recipient: 'Test User'
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Insufficient/i);
  });

  test('should create stock-out successfully', async () => {
    if (!testItem) return;

    // First ensure there's stock by doing a stock-in
    await authRequest('post', '/api/stock-in', auth)
      .send({
        item_id: testItem.id,
        quantity: 10,
        unit_price: 1000,
        notes: 'Stock for stock-out test'
      });

    // Then stock out a small amount
    const res = await authRequest('post', '/api/stock-out', auth)
      .send({
        item_id: testItem.id,
        quantity: 2,
        recipient: 'Quality Test',
        department: 'QA',
        reason: 'Testing stock-out endpoint'
      });

    expect(res.status).toBe(201);
    expect(res.body.message).toMatch(/recorded/i);
    expect(res.body.id).toBeGreaterThan(0);
  });

  test('should list stock-out records', async () => {
    const res = await authRequest('get', '/api/stock-out', auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('records');
    expect(res.body).toHaveProperty('pagination');
    expect(Array.isArray(res.body.records)).toBe(true);
  });
});

describe('📋 Reports', () => {
  test('should fetch stock-in report with pagination', async () => {
    const res = await authRequest('get', '/api/reports/stock-in?page=1&limit=5', auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('records');
    expect(res.body).toHaveProperty('pagination');
    expect(res.body.pagination).toHaveProperty('page', 1);
    expect(res.body.pagination).toHaveProperty('limit', 5);
  });

  test('should fetch stock-out report with pagination', async () => {
    const res = await authRequest('get', '/api/reports/stock-out?page=1&limit=5', auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('pagination');
  });

  test('should fetch inventory status report', async () => {
    const res = await authRequest('get', '/api/reports/inventory-status?page=1&limit=10', auth);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body.summary).toHaveProperty('totalItems');
    expect(res.body).toHaveProperty('items');
    expect(res.body).toHaveProperty('pagination');
  });
});

