import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { quote, deliveryFeeCents } from '../src/pricing.js';

async function boot() {
  const server = createApp({ db: openDb(':memory:'), secret: 't' }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (method, path, body, token) => {
    const r = await fetch(base + path, {
      method, headers: { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) },
      body: body && JSON.stringify(body),
    });
    return { status: r.status, body: await r.json() };
  };
  const reg = async (role, n) => (await call('POST', '/auth/register', { name: n, email: `${n}@x.io`, password: 'password123', role })).body.token;
  return { server, call, reg };
}
const dropoff = { address: '1 Main Rd', lat: -33.93, lng: 18.43 };

test('pricing', () => {
  assert.equal(deliveryFeeCents(0), 1500);
  const q = quote({ subtotalCents: 10000, km: 2, tipCents: 500 });
  assert.equal(q.total_cents, 10000 + 2500 + 500 + 500);
});

test('full store order lifecycle with driver claim', async () => {
  const { server, call, reg } = await boot();
  try {
    const [cust, vend, drv, drv2] = [await reg('customer', 'c'), await reg('vendor', 'v'), await reg('driver', 'd'), await reg('driver', 'd2')];
    await call('POST', '/vendor/store', { name: 'Shop', service: 'food', lat: -33.92, lng: 18.42, address: 'x' }, vend);
    const p = (await call('POST', '/vendor/products', { name: 'Burger', price_cents: 8000 }, vend)).body;

    const o = await call('POST', '/orders', { vendor_id: 1, items: [{ product_id: p.id, qty: 2 }], dropoff, price_cents: 1 }, cust);
    assert.equal(o.status, 201);
    assert.equal(o.body.subtotal_cents, 16000); // client cannot set prices
    const id = o.body.id;

    assert.equal((await call('POST', `/orders/${id}/status`, { status: 'ready' }, vend)).status, 409); // skipping steps
    assert.equal((await call('POST', `/orders/${id}/status`, { status: 'accepted' }, cust)).status, 403);
    for (const s of ['accepted', 'preparing', 'ready']) assert.equal((await call('POST', `/orders/${id}/status`, { status: s }, vend)).status, 200);

    assert.equal((await call('POST', `/orders/${id}/status`, { status: 'picked_up' }, drv)).status, 404); // not claimed, can't even see it
    assert.equal((await call('POST', `/driver/jobs/${id}/claim`, {}, drv)).status, 200);
    assert.equal((await call('POST', `/driver/jobs/${id}/claim`, {}, drv2)).status, 409); // lost the race
    await call('POST', '/driver/location', { lat: -33.92, lng: 18.42 }, drv);
    assert.equal((await call('POST', `/orders/${id}/status`, { status: 'picked_up' }, drv)).status, 200);
    assert.equal((await call('POST', `/orders/${id}/status`, { status: 'delivered' }, drv)).body.payment_status, 'paid');

    const track = await call('GET', `/orders/${id}`, null, cust);
    assert.equal(track.body.events.length, 6);
    assert.equal((await call('POST', `/orders/${id}/rating`, { vendor_stars: 5, driver_stars: 4 }, cust)).status, 201);
    assert.equal((await call('POST', `/orders/${id}/rating`, { vendor_stars: 5 }, cust)).status, 409);
    assert.equal((await call('GET', '/driver/earnings', null, drv)).body.deliveries, 1);
    assert.equal((await call('GET', `/orders/${id}`, null, drv2)).status, 404); // strangers can't see it
  } finally { server.close(); }
});

test('parcel courier order skips vendor steps', async () => {
  const { server, call, reg } = await boot();
  try {
    const cust = await reg('customer', 'c'); const drv = await reg('driver', 'd');
    const o = (await call('POST', '/orders', { pickup: { address: 'A', lat: -33.9, lng: 18.4 }, dropoff }, cust)).body;
    assert.equal(o.kind, 'parcel');
    assert.equal((await call('POST', `/driver/jobs/${o.id}/claim`, {}, drv)).status, 200);
    assert.equal((await call('POST', `/orders/${o.id}/status`, { status: 'picked_up' }, drv)).status, 200);
    assert.equal((await call('POST', `/orders/${o.id}/status`, { status: 'delivered' }, drv)).status, 200);
  } finally { server.close(); }
});

test('dropship validation and cancel/refund', async () => {
  const { server, call, reg } = await boot();
  try {
    const cust = await reg('customer', 'c'); const vend = await reg('vendor', 'v');
    await call('POST', '/vendor/store', { name: 'Hub', service: 'retail', lat: -33.92, lng: 18.42 }, vend);
    assert.equal((await call('POST', '/vendor/products', { name: 'X', price_cents: 100, fulfilment: 'dropship' }, vend)).status, 400);
    assert.equal((await call('POST', '/vendor/products', { name: 'X', price_cents: 100, supplier_cost_cents: 200, fulfilment: 'dropship' }, vend)).status, 400);
    const p = (await call('POST', '/vendor/products', { name: 'X', price_cents: 300, supplier_cost_cents: 200, fulfilment: 'dropship' }, vend)).body;
    const list = (await call('GET', '/vendors/1')).body;
    assert.equal(list.products[0].supplier_cost_cents, undefined); // cost is private
    const o = (await call('POST', '/orders', { vendor_id: 1, items: [{ product_id: p.id, qty: 1 }], dropoff, payment_method: 'card' }, cust)).body;
    const c = await call('POST', `/orders/${o.id}/status`, { status: 'cancelled' }, cust);
    assert.equal(c.body.payment_status, 'refunded');
  } finally { server.close(); }
});
