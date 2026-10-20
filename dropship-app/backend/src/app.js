import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import compression from 'compression';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { openDb } from './db.js';
import { SERVICES, distanceKm, quote } from './pricing.js';
import { canTransition, actorFor } from './orderState.js';
import { rateLimit } from './rateLimit.js';
import { mountMarketEarly, mountMarket } from './market.js';
import { providerFromEnv, paymentRef, orderIdFromRef, toMoney } from './payments.js';

const NEARBY_KM = 15;

export function createApp({
  db = openDb(),
  secret = process.env.JWT_SECRET || 'dev-secret-change-me',
  payments = providerFromEnv(),
  authLimit = 10,
  demo = process.env.DEMO_SEED === '1',
  contact = { email: process.env.SUPPORT_EMAIL, phone: process.env.SUPPORT_PHONE },
  publicDir = fileURLToPath(new URL('../public', import.meta.url)),
  publicUrl = process.env.PUBLIC_URL || 'http://localhost:3000',
} = {}) {
  const app = express();
  app.set('trust proxy', 1); // behind Render/Railway's proxy, so req.ip is the real client
  app.disable('x-powered-by');
  app.use(compression()); // smaller downloads on mobile data
  app.use((_req, res, next) => {
    res.set({ 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'strict-transport-security': 'max-age=15552000' });
    next();
  });
  app.use(cors());
  app.use('/auth', rateLimit({ max: authLimit, windowMs: 60_000 })); // slows password guessing

  // Card payment confirmation is trusted only from a signed webhook, never from the app.
  // Registered before express.json() because the signature covers the raw body.
  app.post('/payments/peach/webhook', express.raw({ type: '*/*', limit: '100kb' }), (req, res) => {
    const raw = req.body.toString('utf8');
    if (!payments.verifyWebhook(req.headers, raw)) return res.status(401).json({ error: 'bad signature' });
    let evt;
    try { evt = payments.parseWebhook(raw); } catch { return res.status(400).json({ error: 'bad payload' }); }
    const id = orderIdFromRef(evt.ref);
    const o = id && db.prepare('SELECT * FROM orders WHERE id = ? AND payment_ref = ?').get(id, evt.ref);
    if (!o) return res.status(200).json({ ok: true }); // unknown ref: ack so Peach stops retrying
    if (evt.success) {
      // A paid amount that differs from the order total is never auto-accepted.
      if (evt.currency !== 'ZAR' || evt.amountCents !== o.total_cents) {
        console.error(`payment amount mismatch for order ${o.id}`);
        db.prepare("UPDATE orders SET payment_status = 'review' WHERE id = ? AND payment_status = 'awaiting_payment'").run(o.id);
        return res.status(200).json({ ok: true });
      }
      markPaid(o.id);
    } else {
      db.prepare("UPDATE orders SET payment_status = 'failed' WHERE id = ? AND payment_status = 'awaiting_payment'").run(o.id);
    }
    res.json({ ok: true });
  });

  mountMarketEarly(app, { db, secret, payments });
  app.use(express.json({ limit: '50kb' }));
  mountMarket(app, { db, secret, payments, publicUrl, authLimit, demo, contact });

  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
  const bad = (res, msg, code = 400) => res.status(code).json({ error: msg });

  const auth = (...roles) => (req, res, next) => {
    const h = req.headers.authorization || '';
    try {
      req.user = jwt.verify(h.replace(/^Bearer /, ''), secret);
    } catch {
      return bad(res, 'unauthorized', 401);
    }
    if (roles.length && !roles.includes(req.user.role)) return bad(res, 'forbidden', 403);
    next();
  };
  const sign = (u) => jwt.sign({ id: u.id, role: u.role, name: u.name }, secret, { expiresIn: '30d' });

  // ---- auth
  app.post('/auth/register', wrap((req, res) => {
    const { name, email, password, role = 'customer', phone } = req.body || {};
    if (!name || !email || !password || password.length < 8) return bad(res, 'name, email and password (8+ chars) required');
    if (!['customer', 'vendor', 'driver'].includes(role)) return bad(res, 'invalid role');
    try {
      const r = db.prepare('INSERT INTO users (role,name,email,phone,password_hash) VALUES (?,?,?,?,?)')
        .run(role, name, email.toLowerCase(), phone || null, bcrypt.hashSync(password, 10));
      const user = { id: Number(r.lastInsertRowid), role, name };
      res.status(201).json({ token: sign(user), user });
    } catch {
      bad(res, 'email already registered', 409);
    }
  }));

  app.post('/auth/login', wrap((req, res) => {
    const { email, password } = req.body || {};
    const u = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email || '').toLowerCase());
    if (!u || !bcrypt.compareSync(String(password || ''), u.password_hash)) return bad(res, 'invalid credentials', 401);
    res.json({ token: sign(u), user: { id: u.id, role: u.role, name: u.name } });
  }));

  // ---- catalogue
  app.get('/services', (_req, res) => res.json(SERVICES));

  app.get('/vendors', wrap((req, res) => {
    const { service, lat, lng, q } = req.query;
    let rows = db.prepare('SELECT * FROM vendors WHERE is_open = 1' + (service ? ' AND service = ?' : '')).all(...(service ? [service] : []));
    if (q) rows = rows.filter((v) => v.name.toLowerCase().includes(String(q).toLowerCase()));
    rows = rows.map((v) => ({
      ...v,
      rating: v.rating_count ? Math.round((v.rating_sum / v.rating_count) * 10) / 10 : null,
      distance_km: lat && lng ? Math.round(distanceKm(+lat, +lng, v.lat, v.lng) * 10) / 10 : null,
    }));
    if (lat && lng) rows = rows.filter((v) => v.distance_km <= NEARBY_KM).sort((a, b) => a.distance_km - b.distance_km);
    res.json(rows);
  }));

  app.get('/vendors/:id', wrap((req, res) => {
    const v = db.prepare('SELECT * FROM vendors WHERE id = ?').get(req.params.id);
    if (!v) return bad(res, 'not found', 404);
    const products = db.prepare('SELECT id,vendor_id,name,description,price_cents,fulfilment,available FROM products WHERE vendor_id = ? AND available = 1').all(v.id);
    res.json({ ...v, products });
  }));

  // ---- vendor management
  const myVendor = (req) => db.prepare('SELECT * FROM vendors WHERE owner_id = ?').get(req.user.id);

  app.post('/vendor/store', auth('vendor'), wrap((req, res) => {
    const { name, service, description, address, lat, lng } = req.body || {};
    if (!name || !SERVICES.includes(service) || typeof lat !== 'number' || typeof lng !== 'number') return bad(res, 'name, service, lat, lng required');
    if (myVendor(req)) return bad(res, 'store already exists', 409);
    const r = db.prepare('INSERT INTO vendors (owner_id,name,service,description,address,lat,lng) VALUES (?,?,?,?,?,?,?)')
      .run(req.user.id, name, service, description || null, address || null, lat, lng);
    res.status(201).json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(r.lastInsertRowid));
  }));

  app.patch('/vendor/store', auth('vendor'), wrap((req, res) => {
    const v = myVendor(req);
    if (!v) return bad(res, 'no store', 404);
    if (typeof req.body?.is_open === 'boolean') db.prepare('UPDATE vendors SET is_open = ? WHERE id = ?').run(+req.body.is_open, v.id);
    res.json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(v.id));
  }));

  app.post('/vendor/products', auth('vendor'), wrap((req, res) => {
    const v = myVendor(req);
    if (!v) return bad(res, 'create a store first', 404);
    const { name, description, price_cents, supplier_cost_cents, fulfilment = 'vendor' } = req.body || {};
    if (!name || !Number.isInteger(price_cents) || price_cents < 0) return bad(res, 'name and integer price_cents required');
    if (fulfilment === 'dropship' && !Number.isInteger(supplier_cost_cents)) return bad(res, 'dropship products need supplier_cost_cents');
    if (fulfilment === 'dropship' && supplier_cost_cents > price_cents) return bad(res, 'price is below supplier cost');
    const r = db.prepare('INSERT INTO products (vendor_id,name,description,price_cents,supplier_cost_cents,fulfilment) VALUES (?,?,?,?,?,?)')
      .run(v.id, name, description || null, price_cents, supplier_cost_cents ?? null, fulfilment);
    res.status(201).json(db.prepare('SELECT * FROM products WHERE id = ?').get(r.lastInsertRowid));
  }));

  app.get('/vendor/orders', auth('vendor'), wrap((req, res) => {
    const v = myVendor(req);
    if (!v) return res.json([]);
    res.json(db.prepare("SELECT * FROM orders WHERE vendor_id = ? AND status != 'pending_payment' ORDER BY id DESC").all(v.id).map(withItems));
  }));

  function withItems(o) {
    return { ...o, items: db.prepare('SELECT product_id,name,qty,unit_price_cents FROM order_items WHERE order_id = ?').all(o.id) };
  }

  // ---- ordering
  const resolveAddress = (a) => a && typeof a.lat === 'number' && typeof a.lng === 'number' && a.address;

  app.post('/orders/quote', auth('customer'), wrap((req, res) => {
    const r = buildQuote(req.body);
    if (r.error) return bad(res, r.error);
    res.json(r.quote);
  }));

  function buildQuote(body) {
    const { vendor_id, items, dropoff, pickup, tip_cents = 0 } = body || {};
    if (!resolveAddress(dropoff)) return { error: 'dropoff {address,lat,lng} required' };
    if (!Number.isInteger(tip_cents) || tip_cents < 0) return { error: 'invalid tip' };
    if (vendor_id == null) {
      if (!resolveAddress(pickup)) return { error: 'parcel orders need pickup {address,lat,lng}' };
      const km = distanceKm(pickup.lat, pickup.lng, dropoff.lat, dropoff.lng);
      return { kind: 'parcel', quote: quote({ subtotalCents: 0, km, tipCents: tip_cents }), from: pickup };
    }
    const vendor = db.prepare('SELECT * FROM vendors WHERE id = ?').get(vendor_id);
    if (!vendor || !vendor.is_open) return { error: 'vendor unavailable' };
    if (!Array.isArray(items) || !items.length) return { error: 'items required' };
    let subtotal = 0;
    const lines = [];
    for (const it of items) {
      const p = db.prepare('SELECT * FROM products WHERE id = ? AND vendor_id = ? AND available = 1').get(it.product_id, vendor.id);
      if (!p || !Number.isInteger(it.qty) || it.qty < 1 || it.qty > 50) return { error: `invalid item ${it.product_id}` };
      subtotal += p.price_cents * it.qty; // price always taken from the DB, never the client
      lines.push({ p, qty: it.qty });
    }
    const km = distanceKm(vendor.lat, vendor.lng, dropoff.lat, dropoff.lng);
    return {
      kind: 'store', vendor, lines,
      from: { address: vendor.address, lat: vendor.lat, lng: vendor.lng },
      quote: quote({ subtotalCents: subtotal, km, tipCents: tip_cents }),
    };
  }

  app.post('/orders', auth('customer'), wrap((req, res) => {
    const b = buildQuote(req.body);
    if (b.error) return bad(res, b.error);
    const method = req.body.payment_method || 'cash';
    if (!['cash', 'card'].includes(method)) return bad(res, 'payment_method must be cash or card');
    const { quote: q, from } = b;
    const d = req.body.dropoff;
    db.exec('BEGIN');
    try {
      const r = db.prepare(`INSERT INTO orders (kind,customer_id,vendor_id,status,pickup_address,pickup_lat,pickup_lng,dropoff_address,dropoff_lat,dropoff_lng,
          subtotal_cents,delivery_fee_cents,service_fee_cents,tip_cents,total_cents,payment_method,payment_status,notes)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
        b.kind, req.user.id, b.vendor?.id ?? null, method === 'card' ? 'pending_payment' : 'placed', from.address, from.lat, from.lng, d.address, d.lat, d.lng,
        q.subtotal_cents, q.delivery_fee_cents, q.service_fee_cents, q.tip_cents, q.total_cents,
        method, method === 'card' ? 'awaiting_payment' : 'pending_cash', req.body.notes || null);
      const id = Number(r.lastInsertRowid);
      for (const { p, qty } of b.lines || []) {
        db.prepare('INSERT INTO order_items (order_id,product_id,name,qty,unit_price_cents) VALUES (?,?,?,?,?)').run(id, p.id, p.name, qty, p.price_cents);
      }
      db.prepare('INSERT INTO order_events (order_id,status) VALUES (?,?)').run(id, method === 'card' ? 'pending_payment' : 'placed');
      if (method === 'card') db.prepare('UPDATE orders SET payment_ref = ? WHERE id = ?').run(paymentRef(id), id);
      db.exec('COMMIT');
      res.status(201).json(withItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(id)));
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }));

  const canSee = (o, u) => u.role === 'admin' || o.customer_id === u.id || o.driver_id === u.id
    || (u.role === 'vendor' && db.prepare('SELECT 1 FROM vendors WHERE id = ? AND owner_id = ?').get(o.vendor_id, u.id));

  app.get('/orders', auth('customer'), wrap((req, res) => {
    res.json(db.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY id DESC').all(req.user.id).map(withItems));
  }));

  app.get('/orders/:id', auth(), wrap((req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o || !canSee(o, req.user)) return bad(res, 'not found', 404);
    const events = db.prepare('SELECT status, created_at FROM order_events WHERE order_id = ? ORDER BY id').all(o.id);
    const driver = o.driver_id ? db.prepare('SELECT lat,lng,updated_at FROM driver_locations WHERE driver_id = ?').get(o.driver_id) : null;
    res.json({ ...withItems(o), events, driver_location: driver });
  }));

  // Status changes by vendor / driver / cancel by customer.
  app.post('/orders/:id/status', auth(), wrap((req, res) => {
    const to = req.body?.status;
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
    if (!o || !canSee(o, req.user)) return bad(res, 'not found', 404);
    if (!canTransition(o.kind, o.status, to)) return bad(res, `cannot go from ${o.status} to ${to}`, 409);
    const actor = actorFor(to);
    if (actor !== 'any' && actor !== req.user.role) return bad(res, 'forbidden', 403);
    if (to === 'cancelled' && req.user.role === 'customer' && !['placed', 'pending_payment'].includes(o.status)) return bad(res, 'too late to cancel', 409);
    if (to === 'cancelled' && req.user.role === 'driver') return bad(res, 'forbidden', 403);
    if (to === 'picked_up' && o.driver_id !== req.user.id) return bad(res, 'claim the job first', 403);
    setStatus(o.id, to);
    res.json(withItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id)));
  }));

  function setStatus(id, to) {
    const paid = to === 'delivered' ? ", payment_status = CASE payment_method WHEN 'cash' THEN 'paid' ELSE payment_status END" : '';
    // A paid card order needs a real refund through Peach; flag it for ops rather than claiming it happened.
    const refund = to === 'cancelled' ? ", payment_status = CASE WHEN payment_status = 'paid' THEN 'refund_pending' ELSE 'void' END" : '';
    db.prepare(`UPDATE orders SET status = ?, updated_at = CURRENT_TIMESTAMP${paid}${refund} WHERE id = ?`).run(to, id);
    db.prepare('INSERT INTO order_events (order_id,status) VALUES (?,?)').run(id, to);
  }

  // ---- driver
  app.post('/driver/location', auth('driver'), wrap((req, res) => {
    const { lat, lng, online = true } = req.body || {};
    if (typeof lat !== 'number' || typeof lng !== 'number') return bad(res, 'lat,lng required');
    db.prepare(`INSERT INTO driver_locations (driver_id,lat,lng,online,updated_at) VALUES (?,?,?,?,CURRENT_TIMESTAMP)
      ON CONFLICT(driver_id) DO UPDATE SET lat=excluded.lat, lng=excluded.lng, online=excluded.online, updated_at=CURRENT_TIMESTAMP`)
      .run(req.user.id, lat, lng, +!!online);
    res.json({ ok: true });
  }));

  // Jobs a driver can claim: store orders that are ready, or parcel orders just placed.
  app.get('/driver/jobs', auth('driver'), wrap((req, res) => {
    const loc = db.prepare('SELECT * FROM driver_locations WHERE driver_id = ?').get(req.user.id);
    let rows = db.prepare(`SELECT * FROM orders WHERE driver_id IS NULL AND
      ((kind='store' AND status IN ('accepted','preparing','ready')) OR (kind='parcel' AND status='placed'))`).all();
    rows = rows.map((o) => ({
      ...o,
      pickup_distance_km: loc ? Math.round(distanceKm(loc.lat, loc.lng, o.pickup_lat, o.pickup_lng) * 10) / 10 : null,
      driver_earnings_cents: Math.round((o.delivery_fee_cents + o.tip_cents) * 0.8),
    }));
    if (loc) rows = rows.filter((o) => o.pickup_distance_km <= NEARBY_KM).sort((a, b) => a.pickup_distance_km - b.pickup_distance_km);
    res.json(rows);
  }));

  app.post('/driver/jobs/:id/claim', auth('driver'), wrap((req, res) => {
    // Atomic claim: only one driver can win.
    const r = db.prepare(`UPDATE orders SET driver_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND driver_id IS NULL
      AND status IN ('accepted','preparing','ready','placed')`).run(req.user.id, req.params.id);
    if (!r.changes) return bad(res, 'job no longer available', 409);
    res.json(withItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id)));
  }));

  app.get('/driver/active', auth('driver'), wrap((req, res) => {
    res.json(db.prepare("SELECT * FROM orders WHERE driver_id = ? AND status NOT IN ('delivered','cancelled') ORDER BY id").all(req.user.id).map(withItems));
  }));

  app.get('/driver/earnings', auth('driver'), wrap((req, res) => {
    const r = db.prepare("SELECT COUNT(*) n, COALESCE(SUM(delivery_fee_cents + tip_cents),0) gross FROM orders WHERE driver_id = ? AND status='delivered'").get(req.user.id);
    res.json({ deliveries: r.n, earnings_cents: Math.round(r.gross * 0.8) });
  }));

  // ---- card payments
  function markPaid(orderId) {
    const o = db.prepare('SELECT * FROM orders WHERE id = ?').get(orderId);
    if (!o || o.payment_status === 'paid' || o.payment_status === 'refund_pending') return; // idempotent
    if (o.status === 'cancelled') { // paid after the customer cancelled
      db.prepare("UPDATE orders SET payment_status = 'refund_pending' WHERE id = ?").run(o.id);
      return;
    }
    db.exec('BEGIN');
    try {
      db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(o.id);
      if (o.status === 'pending_payment') setStatus(o.id, 'placed');
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  }

  app.post('/orders/:id/pay', auth('customer'), wrap(async (req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.id);
    if (!o) return bad(res, 'not found', 404);
    if (o.payment_method !== 'card' || o.status !== 'pending_payment') return bad(res, 'order is not awaiting card payment', 409);
    let co;
    try {
      co = await payments.createCheckout({ ref: o.payment_ref, amountCents: o.total_cents, publicUrl });
    } catch (e) {
      console.error(e.message);
      return bad(res, 'payment provider unavailable, try again', 502);
    }
    const token = jwt.sign({ purpose: 'checkout', orderId: o.id, ...co, mock: payments.name === 'mock' }, secret, { expiresIn: '25m' });
    res.json({ checkout_url: `${publicUrl}/payments/checkout?token=${encodeURIComponent(token)}`, amount: toMoney(o.total_cents) });
  }));

  // Page loaded in the app's WebView. The token (not a login) is the credential.
  app.get('/payments/checkout', (req, res) => {
    let c;
    try { c = jwt.verify(String(req.query.token || ''), secret); } catch { return res.status(401).send('Link expired'); }
    if (c.purpose !== 'checkout') return res.status(401).send('Invalid link');
    const safe = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
    const tokenAttr = String(req.query.token).replace(/[^A-Za-z0-9._-]/g, '');
    res.type('html').send(`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:sans-serif;margin:0;padding:12px"><div id="payment-form" style="min-height:360px"></div>
${c.mock
  ? `<button id="pay" style="width:100%;padding:14px" data-token="${tokenAttr}">Simulate successful payment (test mode)</button>
<script>document.getElementById('pay').onclick=function(){var t=this.getAttribute('data-token');fetch('/payments/mock/complete?token='+encodeURIComponent(t),{method:'POST'}).then(function(r){if(!r.ok)throw 0;if(window.ReactNativeWebView)window.ReactNativeWebView.postMessage('completed')}).catch(function(){})}</script>`
  : `<script src="${c.scriptUrl}"></script><script>
// [VERIFY] initiate/render API per Peach's Embedded Checkout tutorial
var post=function(m){window.ReactNativeWebView&&window.ReactNativeWebView.postMessage(m)};
var checkout=Checkout.initiate({key:${safe(c.entityId)},checkoutId:${safe(c.checkoutId)},options:{},
 events:{onCompleted:function(){post('completed')},onCancelled:function(){post('cancelled')},onExpired:function(){post('expired')}}});
checkout.render('#payment-form');</script>`}
</body>`);
  });

  app.get('/payments/return', (_req, res) => res.type('html').send('<body style="font-family:sans-serif;padding:24px">Processing your payment… you can close this screen.</body>'));

  app.post('/payments/mock/complete', (req, res) => {
    if (payments.name !== 'mock') return bad(res, 'not available', 404);
    try {
      const c = jwt.verify(String(req.query.token || ''), secret);
      if (c.purpose !== 'checkout') throw new Error('x');
      markPaid(c.orderId);
      res.json({ ok: true });
    } catch { bad(res, 'invalid token', 401); }
  });

  // ---- ratings
  app.post('/orders/:id/rating', auth('customer'), wrap((req, res) => {
    const o = db.prepare('SELECT * FROM orders WHERE id = ? AND customer_id = ?').get(req.params.id, req.user.id);
    if (!o) return bad(res, 'not found', 404);
    if (o.status !== 'delivered') return bad(res, 'order not delivered yet', 409);
    const { vendor_stars, driver_stars, comment } = req.body || {};
    const ok = (s) => s == null || (Number.isInteger(s) && s >= 1 && s <= 5);
    if (!ok(vendor_stars) || !ok(driver_stars)) return bad(res, 'stars must be 1-5');
    try {
      db.prepare('INSERT INTO ratings (order_id,vendor_stars,driver_stars,comment) VALUES (?,?,?,?)').run(o.id, vendor_stars ?? null, driver_stars ?? null, comment || null);
    } catch {
      return bad(res, 'already rated', 409);
    }
    if (vendor_stars && o.vendor_id) db.prepare('UPDATE vendors SET rating_sum = rating_sum + ?, rating_count = rating_count + 1 WHERE id = ?').run(vendor_stars, o.vendor_id);
    res.status(201).json({ ok: true });
  }));

  app.get('/health', (_req, res) => res.json({ ok: true }));

  // The MzansiConnect website. Same origin as the API, so there is no CORS to configure.
  if (fs.existsSync(path.join(publicDir, 'index.html'))) {
    const page = (res) => {
      res.set({
        'cache-control': 'no-cache',
        'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; font-src 'self'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'self'",
        'x-frame-options': 'SAMEORIGIN',
      });
      res.sendFile(path.join(publicDir, 'index.html'));
    };
    app.use(express.static(publicDir, { index: false, maxAge: '1h' }));
    app.get('/', (_req, res) => page(res));
    app.get(/^\/(shop|product|cart|checkout|my-orders|order|saved|login|sell|dashboard|help|terms|privacy)(\/.*)?$/, (_req, res) => page(res));
    // any other address typed into a browser gets the site's own "page not found"
    app.get(/^(?!\/(api|auth|orders|vendor|vendors|driver|payments|services|health)(\/|$))/, (req, res, next) => {
      if (req.accepts(['json', 'html']) !== 'html') return next();
      res.status(404); page(res);
    });
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large') return res.status(413).json({ error: 'That upload is too large.' });
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'The request could not be read.' });
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });
  return app;
}
