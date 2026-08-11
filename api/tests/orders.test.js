const assert = require('assert');
const { describe, it, before, after } = require('node:test');
const path = require('path');
const fs = require('fs');
const os = require('os');

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ac-orders-'));
process.env.DATABASE_PATH = path.join(tmpDir, 'test.db');

const db = require('../db');

describe('orders', () => {
  before(async () => {
    await db.initDb();
  });

  it('creates and finds pending order by email (case-insensitive)', async () => {
    const order = await db.createOrder('ord1', 'Client@Example.COM', 'https://example.com', 'oneshot');
    assert.equal(order.status, 'pending');
    const found = await db.getPendingOrderByEmail('client@example.com');
    assert.ok(found);
    assert.equal(found.id, 'ord1');
    assert.equal(found.email, 'client@example.com');
    assert.equal(found.offer, 'oneshot');
  });

  it('ignores delivered orders when searching pending', async () => {
    await db.createOrder('ord2', 'autre@example.com', 'https://dequeuniversity.com/demo/mars', 'pro');
    await db.updateOrderStatus('ord2', 'delivered', { session_id: 'cs_test_1' });
    const found = await db.getPendingOrderByEmail('autre@example.com');
    assert.equal(found, null);
  });

  it('marks paid then delivered with session id', async () => {
    await db.updateOrderStatus('ord1', 'paid', { session_id: 'cs_test_abc' });
    let order = await db.getOrder('ord1');
    assert.equal(order.status, 'paid');
    assert.equal(order.session_id, 'cs_test_abc');
    await db.updateOrderStatus('ord1', 'delivered');
    order = await db.getOrder('ord1');
    assert.equal(order.status, 'delivered');
  });

  it('returns null for unknown email', async () => {
    const found = await db.getPendingOrderByEmail('inconnu@example.com');
    assert.equal(found, null);
  });

  after(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });
});