import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { createMockProvider, createPeachProvider } from '../src/payments.js';
import { seedMarket } from '../src/marketSeed.js';

const ENV = { PEACH_ENV: 'sandbox', PEACH_CLIENT_ID: 'c', PEACH_CLIENT_SECRET: 's', PEACH_MERCHANT_ID: 'm', PEACH_ENTITY_ID: 'e', PEACH_WEBHOOK_SECRET: 'whsec' };
const fakeFetch = async (url) => (url.endsWith('/api/oauth/token')
  ? { ok: true, status: 200, json: async () => ({ access_token: 't', expires_in: 300 }) }
  : { ok: true, status: 200, json: async () => ({ checkoutId: 'chk' }) });
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40, 1)]);
const futureDate = '2099-06-01';

async function boot({ payments = createMockProvider(), seed = true } = {}) {
  const db = openDb(':memory:');
  if (seed) seedMarket(db);
  const server = createApp({ db, secret: 't', payments, publicUrl: 'https://api.test', authLimit: 1000 }).listen(0);
  const base = `http://127.0.0.1:${server.address().port}`;
  const raw = (method, path, body, headers = {}) => fetch(base + path, { method, headers, body });
  const call = async (method, path, body, token) => {
    const r = await raw(method, path, body && JSON.stringify(body), { 'content-type': 'application/json', ...(token && { authorization: `Bearer ${token}` }) });
    return { status: r.status, body: await r.json().catch(() => null) };
  };
  const login = async (email) => (await call('POST', '/api/auth/login', { email, password: 'password123' })).body;
  return { db, server, base, raw, call, login };
}
const addr = (o = {}) => ({ name: 'Tsakani Baloyi', phone: '082 123 4567', area: 'Nkuri', directions: 'Blue gate near the clinic', pay: 'cash', method: 'deliver', ...o });
const find = async (t, q) => (await t.call('GET', `/api/listings?q=${encodeURIComponent(q)}`)).body.items[0];
const signed = (body, ts = Math.floor(Date.now() / 1000), secret = 'whsec') => ({ 'content-type': 'application/json', 'x-webhook-timestamp': String(ts), 'x-webhook-signature': crypto.createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex') });

test('accounts: validation, duplicates, login, roles', async () => {
  const t = await boot({ seed: false });
  try {
    assert.equal((await t.call('POST', '/api/auth/register', { name: 'A', email: 'x', password: 'short' })).status, 400);
    const ok = await t.call('POST', '/api/auth/register', { name: 'Tsakani Baloyi', email: 'T@Example.com', password: 'longenough1' });
    assert.equal(ok.status, 201);
    assert.equal(ok.body.user.email, 't@example.com');
    assert.equal((await t.call('POST', '/api/auth/register', { name: 'Again', email: 't@example.com', password: 'longenough1' })).status, 409);
    assert.equal((await t.call('POST', '/api/auth/login', { email: 't@example.com', password: 'wrong' })).status, 401);
    assert.equal((await t.call('GET', '/api/me', null, ok.body.token)).body.user.role, 'buyer');
    assert.equal((await t.call('GET', '/api/me')).status, 401);
    // sellers need a business, a known village and a phone number
    const sb = { name: 'Risenga C', email: 's@example.com', password: 'longenough1', role: 'seller' };
    assert.equal((await t.call('POST', '/api/auth/register', sb)).status, 400);
    assert.equal((await t.call('POST', '/api/auth/register', { ...sb, business: 'Farm', village: 'Nowhere', phone: '0821234567' })).status, 400);
    const s = await t.call('POST', '/api/auth/register', { ...sb, business: 'Risenga Farm', village: 'Homu', phone: '082 123 4567' });
    assert.equal(s.status, 201);
    assert.equal(s.body.user.seller.village, 'Homu');
    assert.equal((await t.call('GET', '/api/seller/listings', null, ok.body.token)).status, 403); // buyer cannot use seller tools
    assert.equal((await t.call('GET', '/api/seller/listings')).status, 401);
  } finally { t.server.close(); }
});

test('auth endpoints are rate limited', async () => {
  const server = createApp({ db: openDb(':memory:'), secret: 't', authLimit: 3 }).listen(0);
  try {
    const hit = () => fetch(`http://127.0.0.1:${server.address().port}/api/auth/login`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: 'a@b.co', password: 'x' }) });
    assert.deepEqual([(await hit()).status, (await hit()).status, (await hit()).status, (await hit()).status], [401, 401, 401, 429]);
  } finally { server.close(); }
});

test('browsing: filters, search, sorting; seller contact stays private', async () => {
  const t = await boot();
  try {
    const all = (await t.call('GET', '/api/listings')).body;
    assert.ok(all.total >= 38);
    const live = (await t.call('GET', '/api/listings?dept=livestock')).body.items;
    assert.ok(live.length && live.every((l) => l.dept === 'livestock' && l.type === 'good'));
    assert.ok((await t.call('GET', '/api/listings?dept=tractor')).body.items.every((l) => l.type === 'service' && l.unit));
    assert.equal((await t.call('GET', '/api/listings?dept=livestock&villages=Homu')).body.items.every((l) => l.seller.village === 'Homu'), true);
    assert.ok((await t.call('GET', '/api/listings?q=firewood')).body.items.length >= 3);
    assert.equal((await t.call('GET', '/api/listings?q=zzzzzz')).body.total, 0);
    const lo = (await t.call('GET', '/api/listings?sort=lo')).body.items;
    assert.ok(lo.every((l, i) => i === 0 || lo[i - 1].priceCents <= l.priceCents));
    const near = (await t.call('GET', '/api/listings?sort=near&area=Homu&limit=3')).body.items;
    assert.equal(near[0].seller.village, 'Homu');
    const one = (await t.call('GET', `/api/listings/${all.items[0].id}`)).body;
    assert.equal(JSON.stringify(one).includes('phone'), false);
    assert.equal((await t.call('GET', '/api/listings/999999')).status, 404);
  } finally { t.server.close(); }
});

test('sellers manage their own listings, with photos checked by content', async () => {
  const t = await boot();
  try {
    const a = (await t.login('chauke@demo.test')).token, b = (await t.login('nkuna@demo.test')).token;
    const bad = [{ dept: 'nope' }, { dept: 'fuel', sub: 'Firewood', title: 'ab', price: 10, stock: 1 }, { dept: 'fuel', sub: 'Firewood', title: 'Good wood', price: 0, stock: 1 }, { dept: 'fuel', sub: 'Firewood', title: 'Good wood', price: 10 }, { dept: 'tractor', sub: 'Tractor hire', title: 'Slashing', price: 100 }];
    for (const x of bad) assert.equal((await t.call('POST', '/api/seller/listings', x, a)).status, 400);
    const g = await t.call('POST', '/api/seller/listings', { dept: 'fuel', sub: 'Firewood', title: 'Acacia firewood 10kg', price: 45.5, stock: 30, description: 'Dry' }, a);
    assert.equal(g.status, 201);
    assert.equal(g.body.priceCents, 4550);
    const sv = await t.call('POST', '/api/seller/listings', { dept: 'tractor', sub: 'Tractor hire', title: 'Trailer hire', price: 900, unit: 'day' }, a);
    assert.equal(sv.body.type, 'service'); assert.equal(sv.body.stock, null);

    const png = PNG.toString('base64');
    assert.equal((await t.call('POST', `/api/seller/listings/${g.body.id}/photo`, { data: png }, b)).status, 404); // not their listing
    assert.equal((await t.call('POST', `/api/seller/listings/${g.body.id}/photo`, { data: Buffer.from('<script>alert(1)</script>').toString('base64'), mime: 'image/png' }, a)).status, 400);
    assert.ok([400, 413].includes((await t.call('POST', `/api/seller/listings/${g.body.id}/photo`, { data: Buffer.alloc(900 * 1024, 7).toString('base64') }, a)).status)); // too big
    assert.equal((await t.call('POST', `/api/seller/listings/${g.body.id}/photo`, { data: Buffer.alloc(790 * 1024, 7).toString('base64') }, a)).status, 400); // under the limit but not an image
    const up = await t.call('POST', `/api/seller/listings/${g.body.id}/photo`, { data: png }, a);
    assert.equal(up.status, 201);
    const img = await t.raw('GET', up.body.photo);
    assert.equal(img.headers.get('content-type'), 'image/png');
    assert.equal(img.headers.get('x-content-type-options'), 'nosniff');
    assert.equal((await t.call('GET', `/api/listings/${g.body.id}`)).body.photo, up.body.photo);

    assert.equal((await t.call('PATCH', `/api/seller/listings/${g.body.id}`, { price: 50 }, b)).status, 404);
    assert.equal((await t.call('PATCH', `/api/seller/listings/${g.body.id}`, { price: 50, stock: 12 }, a)).body.stock, 12);
    assert.equal((await t.call('DELETE', `/api/seller/listings/${g.body.id}`, null, b)).status, 404);
    assert.equal((await t.call('DELETE', `/api/seller/listings/${g.body.id}`, null, a)).status, 200);
    assert.equal((await t.call('GET', `/api/listings/${g.body.id}`)).status, 404); // removed from the shop
  } finally { t.server.close(); }
});

test('delivery rules: same village R30, other R60, free over R800, livestock arranged, collection free', async () => {
  const t = await boot();
  try {
    const wood = await find(t, 'Kindling bundle'), calf = await find(t, 'Weaner calf'), bag = await find(t, 'Mopane firewood'), tank = await find(t, 'tank supplied'), cem = await find(t, 'Cement');
    const q = (items, method = 'deliver', area = 'Nkuri') => t.call('POST', '/api/quote', { items, method, area });
    let r = (await q([{ listingId: wood.id, qty: 1 }])).body; // Chauke is in Nkuri
    assert.equal(r.deliveryCents, 3000); assert.equal(r.totalCents, wood.priceCents + 3000);
    assert.equal((await q([{ listingId: wood.id, qty: 1 }], 'deliver', 'Homu')).body.deliveryCents, 6000);
    assert.equal((await q([{ listingId: wood.id, qty: 1 }], 'collect')).body.deliveryCents, 0);
    assert.equal((await q([{ listingId: tank.id, qty: 1 }])).body.deliveryCents, 0); // R5 400 is over R800
    r = (await q([{ listingId: calf.id, qty: 1 }])).body;
    assert.equal(r.deliveryCents, 0); assert.equal(r.sellers[0].arranged, true);
    r = (await q([{ listingId: bag.id, qty: 1 }, { listingId: cem.id, qty: 1 }])).body; // two sellers, each charges their own fee
    assert.equal(r.sellers.length, 2); assert.equal(r.deliveryCents, 3000 + 6000);
    assert.equal((await q([{ listingId: bag.id, qty: 1 }, { listingId: bag.id, qty: 2 }])).body.subtotalCents, bag.priceCents * 3); // duplicates merge
    for (const bad of [[], [{ listingId: bag.id, qty: 0 }], [{ listingId: bag.id, qty: 51 }], [{ listingId: bag.id, qty: 1.5 }], [{ listingId: 99999, qty: 1 }]])
      assert.equal((await q(bad)).status, 400);
    assert.equal((await t.call('POST', '/api/quote', { items: [{ listingId: bag.id, qty: 1 }], method: 'deliver', area: 'Mars' })).status, 400);
    const svc = await find(t, 'Ploughing');
    assert.match((await q([{ listingId: svc.id, qty: 1 }])).body.error, /service/i);
    assert.match((await q([{ listingId: calf.id, qty: 99 }])).body.error, /./);
  } finally { t.server.close(); }
});

test('cash order: stock, per-seller handling, privacy, sequential status, payment on delivery', async () => {
  const t = await boot();
  try {
    const buyer = (await t.login('tsakani@demo.test')).token, chauke = (await t.login('chauke@demo.test')).token, nkuna = (await t.login('nkuna@demo.test')).token, other = (await t.login('maluleke@demo.test')).token;
    const wood = await find(t, 'Mopane firewood'), maize = await find(t, 'Maize meal');
    assert.equal((await t.call('POST', '/api/orders', { items: [{ listingId: wood.id, qty: 2 }], ...addr({ directions: '' }) })).status, 401);
    assert.equal((await t.call('POST', '/api/orders', { items: [{ listingId: wood.id, qty: 2 }], ...addr({ directions: '' }) }, buyer)).status, 400);
    assert.equal((await t.call('POST', '/api/orders', { items: [{ listingId: wood.id, qty: 2 }], ...addr({ phone: '123' }) }, buyer)).status, 400);
    const o = await t.call('POST', '/api/orders', { items: [{ listingId: wood.id, qty: 2 }, { listingId: maize.id, qty: 1 }], ...addr() }, buyer);
    assert.equal(o.status, 201);
    assert.equal(o.body.state, 'placed'); assert.equal(o.body.sellers.length, 2);
    assert.ok(o.body.sellers.every((s) => s.phone)); // buyer gets each seller's number
    const after = await find(t, 'Mopane firewood');
    assert.equal(after.stock, wood.stock - 2);
    assert.ok(after.sold >= wood.sold + 2);

    const mine = (await t.call('GET', '/api/seller/orders', null, chauke)).body.find((x) => x.id === o.body.id);
    assert.ok(mine); assert.equal(mine.items.length, 1); // only their own items
    assert.equal(mine.buyer.phone, '0821234567'); assert.match(mine.buyer.directions, /Blue gate/);
    assert.equal(mine.subtotalCents, o.body.items.find((i) => i.sellerId === mine.sellers[0].sellerId).unitPriceCents * 2);
    assert.equal((await t.call('GET', '/api/seller/orders', null, other)).body.some((x) => x.id === o.body.id), false);
    assert.equal((await t.call('POST', `/api/seller/orders/${o.body.id}/status`, { status: 'Packed' }, other)).status, 404);
    assert.equal((await t.call('POST', `/api/seller/orders/${o.body.id}/status`, { status: 'Delivered' }, chauke)).status, 409); // no skipping
    for (const s of ['Packed', 'Shipped', 'Delivered']) assert.equal((await t.call('POST', `/api/seller/orders/${o.body.id}/status`, { status: s }, chauke)).status, 200);
    let view = (await t.call('GET', '/api/orders', null, buyer)).body.find((x) => x.id === o.body.id);
    assert.equal(view.paymentStatus, 'pending_cash'); // one seller still to deliver
    assert.deepEqual(view.sellers.map((s) => s.status).sort(), ['Delivered', 'Processing']);
    for (const s of ['Packed', 'Shipped', 'Delivered']) await t.call('POST', `/api/seller/orders/${o.body.id}/status`, { status: s }, nkuna);
    view = (await t.call('GET', '/api/orders', null, buyer)).body.find((x) => x.id === o.body.id);
    assert.equal(view.paymentStatus, 'paid');
    assert.equal((await t.call('POST', `/api/orders/${o.body.id}/cancel`, {}, buyer)).status, 409); // too late
    assert.equal((await t.call('GET', '/api/orders', null, other)).body.some((x) => x.id === o.body.id), false); // strangers cannot see it
  } finally { t.server.close(); }
});

test('overselling is refused and cancelling restores stock', async () => {
  const t = await boot();
  try {
    const buyer = (await t.login('tsakani@demo.test')).token;
    const calf = await find(t, 'Cow in calf');
    const big = await t.call('POST', '/api/orders', { items: [{ listingId: calf.id, qty: calf.stock + 1 }], ...addr() }, buyer);
    assert.equal(big.status, 400);
    const o = await t.call('POST', '/api/orders', { items: [{ listingId: calf.id, qty: calf.stock }], ...addr() }, buyer);
    assert.equal(o.status, 201);
    assert.equal((await find(t, 'Cow in calf')).stock, 0);
    assert.equal((await t.call('POST', '/api/orders', { items: [{ listingId: calf.id, qty: 1 }], ...addr() }, buyer)).status, 400); // sold out
    const c = await t.call('POST', `/api/orders/${o.body.id}/cancel`, {}, buyer);
    assert.equal(c.body.state, 'cancelled'); assert.equal(c.body.paymentStatus, 'void');
    assert.equal((await find(t, 'Cow in calf')).stock, calf.stock);
  } finally { t.server.close(); }
});

test('card and EFT orders stay hidden from sellers until Peach confirms the right amount', async () => {
  const t = await boot({ payments: createPeachProvider({ env: ENV, fetchImpl: fakeFetch }) });
  try {
    const buyer = (await t.login('tsakani@demo.test')).token, chauke = (await t.login('chauke@demo.test')).token;
    const wood = await find(t, 'Mopane firewood');
    const order = async (pay = 'card') => (await t.call('POST', '/api/orders', { items: [{ listingId: wood.id, qty: 1 }], ...addr({ pay }) }, buyer)).body;
    const o = await order('card');
    assert.equal(o.state, 'pending_payment'); assert.equal(o.paymentStatus, 'awaiting_payment');
    assert.equal((await t.call('GET', '/api/seller/orders', null, chauke)).body.some((x) => x.id === o.id), false);
    assert.equal((await t.call('POST', `/api/seller/orders/${o.id}/status`, { status: 'Packed' }, chauke)).status, 404);
    const pay = await t.call('POST', `/api/orders/${o.id}/pay`, {}, buyer);
    assert.match(pay.body.checkoutUrl, /^https:\/\/api\.test\/api\/payments\/checkout\?token=/);
    const hook = (x, over = {}) => JSON.stringify({ merchantTransactionId: `MCON${String(x.id).padStart(8, '0')}`, amount: (x.totalCents / 100).toFixed(2), currency: 'ZAR', result: { code: '000.100.110' }, ...over });
    const body = hook(o);
    assert.equal((await t.raw('POST', '/api/payments/peach/webhook', body, signed(body, undefined, 'wrong'))).status, 401);
    assert.equal((await t.raw('POST', '/api/payments/peach/webhook', body, { 'content-type': 'application/json' })).status, 401);
    assert.equal((await t.call('GET', '/api/orders', null, buyer)).body.find((x) => x.id === o.id).state, 'pending_payment');
    assert.equal((await t.raw('POST', '/api/payments/peach/webhook', body, signed(body))).status, 200);
    assert.equal((await t.raw('POST', '/api/payments/peach/webhook', body, signed(body))).status, 200); // replay is harmless
    const after = (await t.call('GET', '/api/orders', null, buyer)).body.find((x) => x.id === o.id);
    assert.equal(after.state, 'placed'); assert.equal(after.paymentStatus, 'paid');
    assert.equal((await t.call('GET', '/api/seller/orders', null, chauke)).body.some((x) => x.id === o.id), true);
    // paid orders that are cancelled need a real refund
    assert.equal((await t.call('POST', `/api/orders/${o.id}/cancel`, {}, buyer)).body.paymentStatus, 'refund_pending');
    // a wrong amount never releases the order; a failure is recorded
    const short = await order('eft'); const sb = hook(short, { amount: '1.00' });
    await t.raw('POST', '/api/payments/peach/webhook', sb, signed(sb));
    let v = (await t.call('GET', '/api/orders', null, buyer)).body.find((x) => x.id === short.id);
    assert.deepEqual([v.state, v.paymentStatus], ['pending_payment', 'review']);
    const failed = await order('card'); const fb = hook(failed, { result: { code: '800.100.151' } });
    await t.raw('POST', '/api/payments/peach/webhook', fb, signed(fb));
    v = (await t.call('GET', '/api/orders', null, buyer)).body.find((x) => x.id === failed.id);
    assert.deepEqual([v.state, v.paymentStatus], ['pending_payment', 'failed']);
    assert.equal((await t.call('POST', `/api/orders/${(await order('cash')).id}/pay`, {}, buyer)).status, 409); // cash orders have nothing to pay online
    const cash = await order('cash');
    assert.equal(cash.state, 'placed');
  } finally { t.server.close(); }
});

test('mock payment provider completes through the checkout token', async () => {
  const t = await boot();
  try {
    const buyer = (await t.login('tsakani@demo.test')).token, wood = await find(t, 'Kindling');
    const o = (await t.call('POST', '/api/orders', { items: [{ listingId: wood.id, qty: 1 }], ...addr({ pay: 'card' }) }, buyer)).body;
    const { checkoutUrl } = (await t.call('POST', `/api/orders/${o.id}/pay`, {}, buyer)).body;
    const page = await fetch(checkoutUrl.replace('https://api.test', t.base));
    assert.equal(page.status, 200); assert.match(await page.text(), /Simulate successful payment/);
    const html = await (await fetch(checkoutUrl.replace('https://api.test', t.base))).text();
    const token = html.match(/data-token="([^"]+)"/)[1]; // what the button's script sends
    assert.equal(token, new URL(checkoutUrl).searchParams.get('token'));
    const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
    assert.doesNotThrow(() => new Function(script)); // the page's script must be valid JavaScript
    assert.equal((await t.raw('POST', '/api/payments/mock/complete?token=bad')).status, 401);
    assert.equal((await t.raw('POST', `/api/payments/mock/complete?token=${encodeURIComponent(token)}`)).status, 200);
    assert.equal((await t.call('GET', '/api/orders', null, buyer)).body.find((x) => x.id === o.id).state, 'placed');
  } finally { t.server.close(); }
});

test('service requests: validation, privacy and status flow', async () => {
  const t = await boot();
  try {
    const buyer = (await t.login('tsakani@demo.test')).token, mal = (await t.login('maluleke@demo.test')).token, other = (await t.login('shilubane@demo.test')).token;
    const svc = await find(t, 'Ploughing'), good = await find(t, 'Kindling');
    const body = { listingId: svc.id, name: 'Tsakani Baloyi', phone: '073 456 7890', area: 'Mavalani', date: futureDate, details: '2 hectares by the river' };
    assert.equal((await t.call('POST', '/api/requests', body)).status, 401);
    for (const bad of [{ name: 'T' }, { phone: '12' }, { area: 'Mars' }, { date: '2020-01-01' }, { date: 'soon' }, { listingId: good.id }, { listingId: 99999 }])
      assert.equal((await t.call('POST', '/api/requests', { ...body, ...bad }, buyer)).status === 400 || (await t.call('POST', '/api/requests', { ...body, ...bad }, buyer)).status === 404, true);
    const r = await t.call('POST', '/api/requests', body, buyer);
    assert.equal(r.status, 201); assert.equal(r.body.status, 'New'); assert.ok(r.body.seller.phone); // buyer sees the provider's number
    const mine = (await t.call('GET', '/api/seller/requests', null, mal)).body.find((x) => x.id === r.body.id);
    assert.equal(mine.buyer.phone, '0734567890');
    assert.equal((await t.call('GET', '/api/seller/requests', null, other)).body.some((x) => x.id === r.body.id), false);
    assert.equal((await t.call('POST', `/api/seller/requests/${r.body.id}/status`, { status: 'Completed' }, mal)).status, 409); // confirm first
    assert.equal((await t.call('POST', `/api/seller/requests/${r.body.id}/status`, { status: 'Confirmed' }, other)).status, 404);
    for (const s of ['Confirmed', 'Completed']) assert.equal((await t.call('POST', `/api/seller/requests/${r.body.id}/status`, { status: s }, mal)).status, 200);
    assert.equal((await t.call('GET', '/api/requests', null, buyer)).body.find((x) => x.id === r.body.id).status, 'Completed');
    assert.equal((await t.call('POST', `/api/seller/requests/${r.body.id}/status`, { status: 'Declined' }, mal)).status, 409);
  } finally { t.server.close(); }
});

test('demo seed is idempotent and old marketplace routes still work', async () => {
  const t = await boot();
  try {
    assert.equal(seedMarket(t.db), false);
    const meta = (await t.call('GET', '/api/meta')).body;
    assert.equal(meta.areas.length, 15); assert.equal(meta.depts.length, 8);
    assert.equal((await t.call('GET', '/health')).body.ok, true);
    assert.equal((await t.call('GET', '/services')).status, 200); // original delivery API untouched
  } finally { t.server.close(); }
});
