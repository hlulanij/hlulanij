import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { createPeachProvider, createMockProvider, orderIdFromRef, paymentRef } from '../src/payments.js';

const dropoff = { address: '1 Main Rd', lat: -33.93, lng: 18.43 };
const ENV = { PEACH_ENV: 'sandbox', PEACH_CLIENT_ID: 'cid', PEACH_CLIENT_SECRET: 'cs', PEACH_MERCHANT_ID: 'mid', PEACH_ENTITY_ID: 'eid', PEACH_WEBHOOK_SECRET: 'whsec' };

function fakePeach() {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/api/oauth/token')) return { ok: true, status: 200, json: async () => ({ access_token: 'tok', expires_in: 300 }) };
    if (url.endsWith('/v2/checkout')) return { ok: true, status: 200, json: async () => ({ checkoutId: 'chk_1' }) };
    return { ok: false, status: 404, json: async () => ({}) };
  };
  return { calls, provider: createPeachProvider({ env: ENV, fetchImpl }) };
}

async function boot(payments) {
  const server = createApp({ db: openDb(':memory:'), secret: 't', payments, publicUrl: 'https://api.test' }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const raw = (method, path, body, headers = {}) => fetch(base + path, { method, headers, body });
  const call = async (method, path, body, token) => {
    const r = await raw(method, path, body && JSON.stringify(body), { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const reg = async (role, n) => (await call('POST', '/auth/register', { name: n, email: `${n}@x.io`, password: 'password123', role })).body.token;
  const cust = await reg('customer', 'c'); const vend = await reg('vendor', 'v'); const drv = await reg('driver', 'd');
  await call('POST', '/vendor/store', { name: 'Shop', service: 'food', lat: -33.92, lng: 18.42 }, vend);
  const p = (await call('POST', '/vendor/products', { name: 'Burger', price_cents: 8000 }, vend)).body;
  const order = async () => (await call('POST', '/orders', { vendor_id: 1, items: [{ product_id: p.id, qty: 1 }], dropoff, payment_method: 'card' }, cust)).body;
  return { server, base, raw, call, cust, vend, drv, order };
}

const signed = (body, { secret = 'whsec', ts = Math.floor(Date.now() / 1000) } = {}) => ({
  'content-type': 'application/json',
  'x-webhook-timestamp': String(ts),
  'x-webhook-signature': crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex'),
});
const hook = (o, over = {}) => JSON.stringify({ merchantTransactionId: o.payment_ref, amount: (o.total_cents / 100).toFixed(2), currency: 'ZAR', result: { code: '000.100.110' }, ...over });

test('peach adapter authenticates, then creates a ZAR checkout with the exact amount', async () => {
  const { calls, provider } = fakePeach();
  const co = await provider.createCheckout({ ref: 'DROP00000001', amountCents: 12345, publicUrl: 'https://api.test' });
  assert.equal(co.checkoutId, 'chk_1');
  assert.match(calls[0].url, /sandbox-dashboard.*\/api\/oauth\/token$/);
  const body = JSON.parse(calls[1].init.body);
  assert.equal(calls[1].init.headers.authorization, 'Bearer tok');
  assert.deepEqual([body.amount, body.currency, body.merchantTransactionId], ['123.45', 'ZAR', 'DROP00000001']);
  assert.equal(body.shopperResultUrl, 'https://api.test/payments/return');
});

test('payment ref is 12 chars and round-trips', () => {
  assert.equal(paymentRef(42).length, 12);
  assert.equal(orderIdFromRef(paymentRef(42)), 42);
  assert.equal(orderIdFromRef('nonsense'), null);
});

test('card order stays hidden and unclaimable until a signed webhook confirms payment', async () => {
  const { provider } = fakePeach();
  const t = await boot(provider);
  try {
    const o = await t.order();
    assert.equal(o.status, 'pending_payment');
    assert.equal(o.payment_status, 'awaiting_payment');
    assert.equal((await t.call('GET', '/vendor/orders', null, t.vend)).body.length, 0);
    assert.equal((await t.call('POST', `/orders/${o.id}/status`, { status: 'accepted' }, t.vend)).status, 409);
    assert.equal((await t.call('POST', `/orders/${o.id}/status`, { status: 'placed' }, t.cust)).status, 403); // customer can't self-place

    const pay = await t.call('POST', `/orders/${o.id}/pay`, {}, t.cust);
    assert.equal(pay.status, 200);
    assert.match(pay.body.checkout_url, /^https:\/\/api.test\/payments\/checkout\?token=/);

    // forged / wrong-secret / stale / unsigned webhooks are all rejected
    const body = hook(o);
    assert.equal((await t.raw('POST', '/payments/peach/webhook', body, signed(body, { secret: 'wrong' }))).status, 401);
    assert.equal((await t.raw('POST', '/payments/peach/webhook', body, signed(body, { ts: 1000 }))).status, 401);
    assert.equal((await t.raw('POST', '/payments/peach/webhook', body, { 'content-type': 'application/json' })).status, 401);
    assert.equal((await t.call('GET', `/orders/${o.id}`, null, t.cust)).body.status, 'pending_payment');

    assert.equal((await t.raw('POST', '/payments/peach/webhook', body, signed(body))).status, 200);
    assert.equal((await t.raw('POST', '/payments/peach/webhook', body, signed(body))).status, 200); // replay is harmless
    const after = (await t.call('GET', `/orders/${o.id}`, null, t.cust)).body;
    assert.equal(after.status, 'placed');
    assert.equal(after.payment_status, 'paid');
    assert.deepEqual(after.events.map((e) => e.status), ['pending_payment', 'placed']);
    assert.equal((await t.call('GET', '/vendor/orders', null, t.vend)).body.length, 1);

    // delivered card order stays 'paid'; cancelled-after-paid is flagged for a real refund
    const o2 = await t.order();
    const b2 = hook(o2);
    await t.raw('POST', '/payments/peach/webhook', b2, signed(b2));
    const c = await t.call('POST', `/orders/${o2.id}/status`, { status: 'cancelled' }, t.cust);
    assert.equal(c.body.payment_status, 'refund_pending');
  } finally { t.server.close(); }
});

test('wrong amount or failed result never places the order', async () => {
  const { provider } = fakePeach();
  const t = await boot(provider);
  try {
    const o = await t.order();
    const short = hook(o, { amount: '1.00' });
    await t.raw('POST', '/payments/peach/webhook', short, signed(short));
    let g = (await t.call('GET', `/orders/${o.id}`, null, t.cust)).body;
    assert.equal(g.status, 'pending_payment');
    assert.equal(g.payment_status, 'review');

    const o2 = await t.order();
    const failed = hook(o2, { result: { code: '800.100.151' } });
    await t.raw('POST', '/payments/peach/webhook', failed, signed(failed));
    g = (await t.call('GET', `/orders/${o2.id}`, null, t.cust)).body;
    assert.equal(g.status, 'pending_payment');
    assert.equal(g.payment_status, 'failed');
  } finally { t.server.close(); }
});

test('only the order owner can start payment; cash orders cannot', async () => {
  const { provider } = fakePeach();
  const t = await boot(provider);
  try {
    const o = await t.order();
    const other = (await t.call('POST', '/auth/register', { name: 'x', email: 'x@x.io', password: 'password123' })).body.token;
    assert.equal((await t.call('POST', `/orders/${o.id}/pay`, {}, other)).status, 404);
    const cash = (await t.call('POST', '/orders', { vendor_id: 1, items: [{ product_id: 1, qty: 1 }], dropoff }, t.cust)).body;
    assert.equal(cash.status, 'placed');
    assert.equal((await t.call('POST', `/orders/${cash.id}/pay`, {}, t.cust)).status, 409);
  } finally { t.server.close(); }
});

test('mock provider completes via the checkout token, and the page is safe to render', async () => {
  const t = await boot(createMockProvider());
  try {
    const o = await t.order();
    const { checkout_url } = (await t.call('POST', `/orders/${o.id}/pay`, {}, t.cust)).body;
    const page = await fetch(checkout_url.replace('https://api.test', t.base));
    assert.equal(page.status, 200);
    assert.match(await page.text(), /Simulate successful payment/);
    const token = new URL(checkout_url).searchParams.get('token');
    assert.equal((await t.raw('POST', '/payments/mock/complete?token=bad')).status, 401);
    assert.equal((await t.raw('POST', `/payments/mock/complete?token=${encodeURIComponent(token)}`)).status, 200);
    assert.equal((await t.call('GET', `/orders/${o.id}`, null, t.cust)).body.status, 'placed');
  } finally { t.server.close(); }
});
