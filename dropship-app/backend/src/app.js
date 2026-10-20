import express from 'express';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { openDb } from './db.js';
import { SERVICES, distanceKm, quote } from './pricing.js';
import { canTransition, actorFor } from './orderState.js';

const NEARBY_KM = 15;

export function createApp({ db = openDb(), secret = process.env.JWT_SECRET || 'dev-secret-change-me' } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());

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
    res.json(db.prepare("SELECT * FROM orders WHERE vendor_id = ? ORDER BY id DESC").all(v.id).map(withItems));
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
        b.kind, req.user.id, b.vendor?.id ?? null, 'placed', from.address, from.lat, from.lng, d.address, d.lat, d.lng,
        q.subtotal_cents, q.delivery_fee_cents, q.service_fee_cents, q.tip_cents, q.total_cents,
        method, method === 'card' ? 'authorised' : 'pending_cash', req.body.notes || null);
      const id = Number(r.lastInsertRowid);
      for (const { p, qty } of b.lines || []) {
        db.prepare('INSERT INTO order_items (order_id,product_id,name,qty,unit_price_cents) VALUES (?,?,?,?,?)').run(id, p.id, p.name, qty, p.price_cents);
      }
      db.prepare('INSERT INTO order_events (order_id,status) VALUES (?,?)').run(id, 'placed');
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
    if (to === 'cancelled' && req.user.role === 'customer' && o.status !== 'placed') return bad(res, 'too late to cancel', 409);
    if (to === 'cancelled' && req.user.role === 'driver') return bad(res, 'forbidden', 403);
    if (to === 'picked_up' && o.driver_id !== req.user.id) return bad(res, 'claim the job first', 403);
    setStatus(o.id, to);
    res.json(withItems(db.prepare('SELECT * FROM orders WHERE id = ?').get(o.id)));
  }));

  function setStatus(id, to) {
    const paid = to === 'delivered' ? ", payment_status = CASE payment_method WHEN 'cash' THEN 'paid' ELSE 'captured' END" : '';
    const refund = to === 'cancelled' ? ", payment_status = CASE payment_method WHEN 'card' THEN 'refunded' ELSE 'void' END" : '';
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

  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    console.error(err);
    res.status(500).json({ error: 'internal error' });
  });
  return app;
}
