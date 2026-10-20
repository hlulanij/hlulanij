import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import {
  AREAS, DEPTS, DEPT, UNITS, SA_PHONE, cleanPhone,
  DELIVERY_SAME_VILLAGE_CENTS, DELIVERY_OTHER_VILLAGE_CENTS, FREE_DELIVERY_OVER_CENTS,
} from './catalog.js';
import { toMoney, marketRef, marketIdFromRef } from './payments.js';
import { rateLimit } from './rateLimit.js';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const STEPS = ['Processing', 'Packed', 'Shipped', 'Delivered'];
const REQ_NEXT = { New: ['Confirmed', 'Declined'], Confirmed: ['Completed', 'Declined'] };
const MAX_PHOTO_BYTES = 800 * 1024;
const code = (prefix, id, base) => `${prefix}-${base + id}`;
export const orderCode = (id) => code('MC', id, 100000);
export const requestCode = (id) => code('SR', id, 2000);

function sniffImage(buf) {
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length > 12 && buf.subarray(0, 4).toString() === 'RIFF' && buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return null;
}
// Public contact details (set SUPPORT_EMAIL and SUPPORT_PHONE on the server). Anything that is not a plain email or SA number is dropped.
const cleanContact = (c) => ({
  email: EMAIL.test(String(c?.email || '').trim()) && String(c.email).length <= 120 ? String(c.email).trim() : '',
  phone: SA_PHONE.test(cleanPhone(c?.phone)) ? String(c.phone).trim() : '',
});
const todaySast = () => new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10);
const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const bad = (res, msg, status = 400) => res.status(status).json({ error: msg });
const str = (v, min, max) => { const s = String(v ?? '').trim(); return s.length >= min && s.length <= max ? s : null; };

export function marketKit({ db, secret }) {
  const sign = (u) => jwt.sign({ uid: u.id, role: u.role }, secret, { expiresIn: '30d', audience: 'market' });
  const auth = (role) => (req, res, next) => {
    try {
      const t = jwt.verify((req.headers.authorization || '').replace(/^Bearer /, ''), secret, { audience: 'market' });
      const u = db.prepare('SELECT id,email,name,phone,role FROM m_users WHERE id = ?').get(t.uid);
      if (!u) throw new Error('gone');
      req.user = u;
      req.seller = u.role === 'seller' ? db.prepare('SELECT * FROM m_sellers WHERE user_id = ?').get(u.id) : null;
    } catch { return bad(res, 'unauthorized', 401); }
    if (role && req.user.role !== role) return bad(res, 'forbidden', 403);
    if (role === 'seller' && !req.seller) return bad(res, 'forbidden', 403);
    next();
  };
  return { sign, auth };
}

const listingView = (r) => ({
  id: r.id, dept: r.dept, sub: r.sub, type: r.type, title: r.title, description: r.description,
  priceCents: r.price_cents, unit: r.unit, stock: r.type === 'good' ? r.stock : null, note: r.note, sold: r.sold,
  photo: r.photo_id ? `/api/photos/${r.photo_id}` : null,
  seller: { id: r.seller_id, name: r.s_name, village: r.s_village, rating: r.s_rating, sales: r.s_sales },
});
const LISTING_SQL = `SELECT l.*, s.name AS s_name, s.village AS s_village, s.rating AS s_rating, s.sales AS s_sales
  FROM m_listings l JOIN m_sellers s ON s.id = l.seller_id`;

/* Registered BEFORE the global JSON parser: raw-body webhook and the larger JSON limit for photo uploads. */
export function mountMarketEarly(app, { db, secret, payments }) {
  const { auth } = marketKit({ db, secret });

  // Card and EFT confirmation is trusted only from Peach's signed webhook, never from the browser.
  app.post('/api/payments/peach/webhook', express.raw({ type: '*/*', limit: '100kb' }), (req, res) => {
    const raw = req.body.toString('utf8');
    if (!payments.verifyWebhook(req.headers, raw)) return res.status(401).json({ error: 'bad signature' });
    let evt;
    try { evt = payments.parseWebhook(raw); } catch { return bad(res, 'bad payload'); }
    const id = marketIdFromRef(evt.ref);
    const o = id && db.prepare('SELECT * FROM m_orders WHERE id = ?').get(id);
    if (!o) return res.json({ ok: true });
    if (evt.success) {
      if (evt.currency !== 'ZAR' || evt.amountCents !== o.total_cents) {
        console.error(`market payment amount mismatch for order ${o.id}`);
        db.prepare("UPDATE m_orders SET payment_status = 'review' WHERE id = ? AND payment_status = 'awaiting_payment'").run(o.id);
        return res.json({ ok: true });
      }
      markPaid(db, o.id);
    } else {
      db.prepare("UPDATE m_orders SET payment_status = 'failed' WHERE id = ? AND payment_status = 'awaiting_payment'").run(o.id);
    }
    res.json({ ok: true });
  });

  app.post('/api/seller/listings/:id/photo', express.json({ limit: '1200kb' }), auth('seller'), wrap((req, res) => {
    const l = db.prepare('SELECT * FROM m_listings WHERE id = ? AND seller_id = ?').get(req.params.id, req.seller.id);
    if (!l) return bad(res, 'not found', 404);
    const b64 = String(req.body?.data || '').replace(/^data:[^;]+;base64,/, '');
    if (!b64 || !/^[A-Za-z0-9+/=\s]+$/.test(b64)) return bad(res, 'photo data is required');
    const buf = Buffer.from(b64, 'base64');
    if (buf.length > MAX_PHOTO_BYTES) return bad(res, 'photo is too large, use one under 800 KB');
    const mime = sniffImage(buf); // trust the bytes, not the client's claim
    if (!mime) return bad(res, 'only JPEG, PNG or WebP photos are allowed');
    const r = db.prepare('INSERT INTO m_photos (mime, data) VALUES (?, ?)').run(mime, buf);
    const newId = Number(r.lastInsertRowid);
    if (l.photo_id) db.prepare('DELETE FROM m_photos WHERE id = ?').run(l.photo_id);
    db.prepare('UPDATE m_listings SET photo_id = ? WHERE id = ?').run(newId, l.id);
    res.status(201).json({ photo: `/api/photos/${newId}` });
  }));
}

function activate(db, orderId) {
  const o = db.prepare('SELECT * FROM m_orders WHERE id = ?').get(orderId);
  if (!o || o.state !== 'pending_payment') return;
  db.prepare("UPDATE m_orders SET state = 'placed' WHERE id = ?").run(orderId);
  db.prepare('UPDATE m_listings SET sold = sold + (SELECT COALESCE(SUM(qty),0) FROM m_order_items WHERE order_id = ? AND listing_id = m_listings.id) WHERE id IN (SELECT listing_id FROM m_order_items WHERE order_id = ?)').run(orderId, orderId);
}
function markPaid(db, orderId) {
  const o = db.prepare('SELECT * FROM m_orders WHERE id = ?').get(orderId);
  if (!o || ['paid', 'refund_pending'].includes(o.payment_status)) return; // idempotent
  if (o.state === 'cancelled') { db.prepare("UPDATE m_orders SET payment_status = 'refund_pending' WHERE id = ?").run(o.id); return; }
  db.exec('BEGIN');
  try {
    db.prepare("UPDATE m_orders SET payment_status = 'paid' WHERE id = ?").run(o.id);
    activate(db, o.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

export function mountMarket(app, { db, secret, payments, publicUrl, authLimit = 10, demo = false, contact = {} }) {
  const { sign, auth } = marketKit({ db, secret });
  app.use('/api/auth', rateLimit({ max: authLimit, windowMs: 60_000 }));

  /* ---- meta + photos ---- */
  app.get('/api/meta', (_req, res) => res.json({ areas: AREAS, depts: DEPTS, units: UNITS, demo, contact: cleanContact(contact) }));
  app.get('/api/photos/:id', (req, res) => {
    const p = db.prepare('SELECT mime, data FROM m_photos WHERE id = ?').get(req.params.id);
    if (!p) return res.status(404).end();
    res.set({ 'content-type': p.mime, 'cache-control': 'public, max-age=86400', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'none'" });
    res.send(Buffer.from(p.data));
  });

  /* ---- accounts ---- */
  const userOut = (u, s) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone || '', role: u.role, seller: s ? { id: s.id, name: s.name, village: s.village } : null });
  app.post('/api/auth/register', wrap((req, res) => {
    const b = req.body || {};
    const name = str(b.name, 2, 80), email = String(b.email || '').trim().toLowerCase(), role = b.role === 'seller' ? 'seller' : 'buyer';
    if (!name) return bad(res, 'Enter your full name.');
    if (!EMAIL.test(email) || email.length > 120) return bad(res, 'Enter a valid email address.');
    if (String(b.password || '').length < 8 || String(b.password).length > 100) return bad(res, 'Your password must be at least 8 characters.');
    const phone = cleanPhone(b.phone);
    if ((role === 'seller' || phone) && !SA_PHONE.test(phone)) return bad(res, 'Enter a valid South African mobile number, for example 082 123 4567.');
    let biz = null;
    if (role === 'seller') {
      biz = str(b.business, 2, 80);
      if (!biz) return bad(res, 'Enter your business or shop name.');
      if (!AREAS.includes(b.village)) return bad(res, 'Choose your village or town.');
    }
    db.exec('BEGIN');
    try {
      const r = db.prepare('INSERT INTO m_users (email,name,phone,role,password_hash) VALUES (?,?,?,?,?)').run(email, name, phone || null, role, bcrypt.hashSync(b.password, 10));
      const u = { id: Number(r.lastInsertRowid), email, name, phone, role };
      let s = null;
      if (role === 'seller') {
        const sr = db.prepare('INSERT INTO m_sellers (user_id,name,village,phone,rating,sales) VALUES (?,?,?,?,5,0)').run(u.id, biz, b.village, phone);
        s = db.prepare('SELECT * FROM m_sellers WHERE id = ?').get(sr.lastInsertRowid);
      }
      db.exec('COMMIT');
      res.status(201).json({ token: sign(u), user: userOut(u, s) });
    } catch (e) {
      db.exec('ROLLBACK');
      if (String(e.message).includes('UNIQUE')) return bad(res, 'That email is already registered. Log in instead.', 409);
      throw e;
    }
  }));
  app.post('/api/auth/login', wrap((req, res) => {
    const u = db.prepare('SELECT * FROM m_users WHERE email = ?').get(String(req.body?.email || '').trim().toLowerCase());
    if (!u || !bcrypt.compareSync(String(req.body?.password || ''), u.password_hash)) return bad(res, 'Wrong email or password.', 401);
    const s = u.role === 'seller' ? db.prepare('SELECT * FROM m_sellers WHERE user_id = ?').get(u.id) : null;
    res.json({ token: sign(u), user: userOut(u, s) });
  }));
  app.get('/api/me', auth(), (req, res) => res.json({ user: userOut(req.user, req.seller) }));

  /* ---- browsing ---- */
  app.get('/api/listings', wrap((req, res) => {
    const q = req.query, where = ['l.active = 1'], args = [];
    if (q.dept) { where.push('l.dept = ?'); args.push(String(q.dept)); }
    if (q.sub) { where.push('l.sub = ?'); args.push(String(q.sub)); }
    if (q.type === 'good' || q.type === 'service') { where.push('l.type = ?'); args.push(q.type); }
    if (q.seller) { where.push('l.seller_id = ?'); args.push(Number(q.seller) || 0); }
    const ids = String(q.ids || '').split(',').map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 50);
    if (q.ids !== undefined) { if (!ids.length) return res.json({ total: 0, items: [] }); where.push(`l.id IN (${ids.map(() => '?').join(',')})`); args.push(...ids); }
    const villages = String(q.villages || '').split(',').filter((v) => AREAS.includes(v));
    if (villages.length) { where.push(`s.village IN (${villages.map(() => '?').join(',')})`); args.push(...villages); }
    if (q.min) { where.push('l.price_cents >= ?'); args.push(Math.round(Number(q.min) * 100) || 0); }
    if (q.max) { where.push('l.price_cents < ?'); args.push(Math.round(Number(q.max) * 100) || 0); }
    let rows = db.prepare(`${LISTING_SQL} WHERE ${where.join(' AND ')}`).all(...args);
    const text = String(q.q || '').trim().toLowerCase();
    if (text) {
      const words = text.split(/\s+/).slice(0, 6);
      rows = rows.filter((r) => { const hay = `${r.title} ${r.description} ${r.s_name} ${r.s_village} ${DEPT[r.dept]?.name} ${r.sub}`.toLowerCase(); return words.every((w) => hay.includes(w)); });
    }
    const near = AREAS.includes(q.area) ? q.area : null;
    const sorts = {
      pop: (a, b) => b.sold - a.sold || b.id - a.id,
      lo: (a, b) => a.price_cents - b.price_cents,
      hi: (a, b) => b.price_cents - a.price_cents,
      neu: (a, b) => b.id - a.id,
      near: (a, b) => (b.s_village === near) - (a.s_village === near) || b.sold - a.sold,
    };
    rows.sort(sorts[q.sort] || sorts.pop);
    const total = rows.length;
    const limit = Math.min(Math.max(parseInt(q.limit, 10) || 60, 1), 100), offset = Math.max(parseInt(q.offset, 10) || 0, 0);
    res.json({ total, items: rows.slice(offset, offset + limit).map(listingView) });
  }));
  app.get('/api/listings/:id', wrap((req, res) => {
    const r = db.prepare(`${LISTING_SQL} WHERE l.id = ? AND l.active = 1`).get(req.params.id);
    if (!r) return bad(res, 'not found', 404);
    res.json(listingView(r));
  }));

  /* ---- pricing + delivery (sellers deliver, so each seller adds their own fee) ---- */
  function build(items, method, area) {
    if (!Array.isArray(items) || !items.length || items.length > 30) return { error: 'Your cart is empty.' };
    if (!['deliver', 'collect'].includes(method)) return { error: 'Choose delivery or collection.' };
    if (!AREAS.includes(area)) return { error: 'Choose your village or area.' };
    const merged = new Map();
    for (const it of items) {
      const qty = Number(it?.qty), id = Number(it?.listingId);
      if (!Number.isInteger(id) || !Number.isInteger(qty) || qty < 1 || qty > 50) return { error: 'One of the items in your cart is not valid.' };
      merged.set(id, (merged.get(id) || 0) + qty);
    }
    const lines = [], groups = new Map();
    for (const [id, qty] of merged) {
      const l = db.prepare(`${LISTING_SQL} WHERE l.id = ? AND l.active = 1`).get(id);
      if (!l) return { error: 'An item in your cart is no longer available.' };
      if (l.type !== 'good') return { error: `${l.title} is a service. Send a request instead of adding it to the cart.` };
      if (qty > l.stock) return { error: `Only ${l.stock} of ${l.title} in stock.` };
      const line = { l, qty };
      lines.push(line);
      if (!groups.has(l.seller_id)) groups.set(l.seller_id, { sellerId: l.seller_id, name: l.s_name, village: l.s_village, lines: [] });
      groups.get(l.seller_id).lines.push(line);
    }
    let subtotal = 0, delivery = 0;
    const sellers = [];
    for (const g of groups.values()) {
      const sub = g.lines.reduce((a, x) => a + x.l.price_cents * x.qty, 0);
      subtotal += sub;
      let fee = 0, arranged = false;
      if (method === 'deliver') {
        if (g.lines.every((x) => x.l.dept === 'livestock')) arranged = true; // agreed directly with the seller
        else if (sub < FREE_DELIVERY_OVER_CENTS) fee = g.village === area ? DELIVERY_SAME_VILLAGE_CENTS : DELIVERY_OTHER_VILLAGE_CENTS;
      }
      delivery += fee;
      sellers.push({ sellerId: g.sellerId, name: g.name, subtotalCents: sub, deliveryCents: fee, arranged });
    }
    return { lines, sellers, subtotalCents: subtotal, deliveryCents: delivery, totalCents: subtotal + delivery };
  }
  const quoteOut = (b) => ({ subtotalCents: b.subtotalCents, deliveryCents: b.deliveryCents, totalCents: b.totalCents, sellers: b.sellers });
  app.post('/api/quote', wrap((req, res) => {
    const b = build(req.body?.items, req.body?.method, req.body?.area);
    if (b.error) return bad(res, b.error);
    res.json(quoteOut(b));
  }));

  /* ---- orders ---- */
  function orderOut(o, viewer) {
    const items = db.prepare('SELECT * FROM m_order_items WHERE order_id = ?').all(o.id);
    let parts = db.prepare('SELECT os.*, s.name AS s_name, s.village AS s_village, s.phone AS s_phone FROM m_order_sellers os JOIN m_sellers s ON s.id = os.seller_id WHERE os.order_id = ?').all(o.id);
    let its = items;
    if (viewer?.sellerId) { parts = parts.filter((p) => p.seller_id === viewer.sellerId); its = items.filter((i) => i.seller_id === viewer.sellerId); }
    const out = {
      id: o.id, code: orderCode(o.id), state: o.state, method: o.method, pay: o.pay, paymentStatus: o.payment_status, createdAt: o.created_at,
      area: o.area, subtotalCents: o.subtotal_cents, deliveryCents: o.delivery_cents, totalCents: o.total_cents,
      items: its.map((i) => ({ listingId: i.listing_id, sellerId: i.seller_id, title: i.title, qty: i.qty, unitPriceCents: i.unit_price_cents })),
      sellers: parts.map((p) => ({ sellerId: p.seller_id, name: p.s_name, village: p.s_village, status: p.status, deliveryCents: p.delivery_cents, ...(viewer?.sellerId ? {} : { phone: p.s_phone }) })),
    };
    if (viewer?.sellerId) {
      // a seller sees only their own part of the order, so the money shown is their part too
      out.subtotalCents = its.reduce((n, i) => n + i.qty * i.unit_price_cents, 0);
      out.deliveryCents = parts[0]?.delivery_cents ?? 0;
      out.totalCents = out.subtotalCents + out.deliveryCents;
    }
    if (viewer?.sellerId) Object.assign(out, { buyer: { name: o.name, phone: o.phone, area: o.area, directions: o.directions, stand: o.stand } });
    return out;
  }
  app.post('/api/orders', auth(), wrap((req, res) => {
    const b = req.body || {};
    const name = str(b.name, 2, 80), phone = cleanPhone(b.phone);
    if (!name) return bad(res, 'Enter your full name.');
    if (!SA_PHONE.test(phone)) return bad(res, 'Enter a valid South African mobile number, for example 082 123 4567.');
    if (!['cash', 'eft', 'card'].includes(b.pay)) return bad(res, 'Choose how you will pay.');
    const directions = String(b.directions ?? '').trim().slice(0, 300), stand = String(b.stand ?? '').trim().slice(0, 40);
    if (b.method === 'deliver' && directions.length < 5) return bad(res, 'Enter directions to your home so the seller can find you.');
    const q = build(b.items, b.method, b.area);
    if (q.error) return bad(res, q.error);
    const online = b.pay !== 'cash';
    db.exec('BEGIN');
    try {
      const r = db.prepare(`INSERT INTO m_orders (buyer_id,state,method,pay,payment_status,name,phone,area,directions,stand,subtotal_cents,delivery_cents,total_cents)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(req.user.id, 'pending_payment', b.method, b.pay, online ? 'awaiting_payment' : 'pending_cash', name, phone, b.area, directions, stand, q.subtotalCents, q.deliveryCents, q.totalCents);
      const id = Number(r.lastInsertRowid);
      for (const { l, qty } of q.lines) {
        const dec = db.prepare('UPDATE m_listings SET stock = stock - ? WHERE id = ? AND stock >= ?').run(qty, l.id, qty);
        if (!dec.changes) throw Object.assign(new Error('stock'), { stock: l.title });
        db.prepare('INSERT INTO m_order_items (order_id,listing_id,seller_id,title,qty,unit_price_cents) VALUES (?,?,?,?,?,?)').run(id, l.id, l.seller_id, l.title, qty, l.price_cents);
      }
      for (const s of q.sellers) db.prepare('INSERT INTO m_order_sellers (order_id,seller_id,delivery_cents) VALUES (?,?,?)').run(id, s.sellerId, s.deliveryCents);
      if (!online) activate(db, id); // cash orders go straight to the sellers; card and EFT wait for Peach
      db.exec('COMMIT');
      res.status(201).json(orderOut(db.prepare('SELECT * FROM m_orders WHERE id = ?').get(id)));
    } catch (e) {
      db.exec('ROLLBACK');
      if (e.stock) return bad(res, `Sorry, ${e.stock} just sold out.`, 409);
      throw e;
    }
  }));
  app.get('/api/orders', auth(), (req, res) => {
    res.json(db.prepare('SELECT * FROM m_orders WHERE buyer_id = ? ORDER BY id DESC').all(req.user.id).map((o) => orderOut(o)));
  });
  app.post('/api/orders/:id/cancel', auth(), wrap((req, res) => {
    const o = db.prepare('SELECT * FROM m_orders WHERE id = ? AND buyer_id = ?').get(req.params.id, req.user.id);
    if (!o) return bad(res, 'not found', 404);
    const started = db.prepare("SELECT 1 FROM m_order_sellers WHERE order_id = ? AND status != 'Processing'").get(o.id);
    if (o.state === 'cancelled' || started) return bad(res, 'This order can no longer be cancelled. Phone the seller.', 409);
    db.exec('BEGIN');
    try {
      for (const i of db.prepare('SELECT * FROM m_order_items WHERE order_id = ?').all(o.id)) db.prepare('UPDATE m_listings SET stock = stock + ? WHERE id = ?').run(i.qty, i.listing_id);
      db.prepare("UPDATE m_orders SET state = 'cancelled', payment_status = CASE WHEN payment_status = 'paid' THEN 'refund_pending' ELSE 'void' END WHERE id = ?").run(o.id);
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
    res.json(orderOut(db.prepare('SELECT * FROM m_orders WHERE id = ?').get(o.id)));
  }));

  /* ---- card and EFT payments through Peach ---- */
  app.post('/api/orders/:id/pay', auth(), wrap(async (req, res) => {
    const o = db.prepare('SELECT * FROM m_orders WHERE id = ? AND buyer_id = ?').get(req.params.id, req.user.id);
    if (!o) return bad(res, 'not found', 404);
    if (o.pay === 'cash' || o.state !== 'pending_payment') return bad(res, 'This order is not waiting for payment.', 409);
    let co;
    try { co = await payments.createCheckout({ ref: marketRef(o.id), amountCents: o.total_cents, publicUrl }); }
    catch (e) { console.error(e.message); return bad(res, 'The payment provider is not available. Try again in a moment.', 502); }
    const token = jwt.sign({ purpose: 'mcheckout', orderId: o.id, ...co, mock: payments.name === 'mock' }, secret, { expiresIn: '25m' });
    res.json({ checkoutUrl: `${publicUrl}/api/payments/checkout?token=${encodeURIComponent(token)}`, amount: toMoney(o.total_cents) });
  }));
  app.get('/api/payments/checkout', (req, res) => {
    let c;
    try { c = jwt.verify(String(req.query.token || ''), secret); } catch { return res.status(401).send('This payment link has expired. Go back and try again.'); }
    if (c.purpose !== 'mcheckout') return res.status(401).send('Invalid link');
    const safe = (v) => JSON.stringify(v).replace(/</g, '\\u003c');
    const tokenAttr = String(req.query.token).replace(/[^A-Za-z0-9._-]/g, ''); // JWT characters only, safe inside an HTML attribute
    res.type('html').send(`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<body style="font-family:system-ui,sans-serif;margin:0;padding:16px"><div id="payment-form" style="min-height:360px"></div>
${c.mock
  ? `<button id="pay" style="width:100%;padding:14px;font-size:16px" data-token="${tokenAttr}">Simulate successful payment (test mode)</button>
<script>document.getElementById('pay').onclick=function(){var t=this.getAttribute('data-token');fetch('/api/payments/mock/complete?token='+encodeURIComponent(t),{method:'POST'}).then(function(r){if(!r.ok)throw 0;try{window.parent.postMessage('completed','*')}catch(e){}document.body.innerHTML='<p>Payment received (test mode). You can close this page.</p>'}).catch(function(){document.body.insertAdjacentHTML('beforeend','<p>That did not work. Close this window and try again.</p>')})}</script>`
  : `<script src="${c.scriptUrl}"></script><script>
var post=function(m){try{window.parent.postMessage(m,'*')}catch(e){}};
var checkout=Checkout.initiate({key:${safe(c.entityId)},checkoutId:${safe(c.checkoutId)},options:{},events:{onCompleted:function(){post('completed')},onCancelled:function(){post('cancelled')},onExpired:function(){post('expired')}}});
checkout.render('#payment-form');</script>`}
</body>`);
  });
  app.post('/api/payments/mock/complete', (req, res) => {
    if (payments.name !== 'mock') return bad(res, 'not available', 404);
    try {
      const c = jwt.verify(String(req.query.token || ''), secret);
      if (c.purpose !== 'mcheckout') throw new Error('x');
      markPaid(db, c.orderId);
      res.json({ ok: true });
    } catch { bad(res, 'invalid token', 401); }
  });

  /* ---- service requests ---- */
  const reqOut = (r, forSeller) => {
    const l = db.prepare('SELECT title, dept FROM m_listings WHERE id = ?').get(r.listing_id) || {};
    const s = db.prepare('SELECT name, village, phone FROM m_sellers WHERE id = ?').get(r.seller_id) || {};
    return { id: r.id, code: requestCode(r.id), listingId: r.listing_id, title: l.title, status: r.status, area: r.area, date: r.date, details: r.details, createdAt: r.created_at,
      ...(forSeller ? { buyer: { name: r.name, phone: r.phone } } : { seller: { name: s.name, village: s.village, phone: s.phone } }) };
  };
  app.post('/api/requests', auth(), wrap((req, res) => {
    const b = req.body || {};
    const l = db.prepare('SELECT * FROM m_listings WHERE id = ? AND active = 1').get(Number(b.listingId));
    if (!l || l.type !== 'service') return bad(res, 'That service is not available.', 404);
    const name = str(b.name, 2, 80), phone = cleanPhone(b.phone), date = String(b.date || '');
    if (!name) return bad(res, 'Enter your name.');
    if (!SA_PHONE.test(phone)) return bad(res, 'Enter a valid South African mobile number, for example 082 123 4567.');
    if (!AREAS.includes(b.area)) return bad(res, 'Choose where the work is.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return bad(res, 'Choose a preferred date.');
    if (date < todaySast()) return bad(res, 'The preferred date cannot be in the past.');
    const r = db.prepare('INSERT INTO m_requests (listing_id,seller_id,buyer_id,name,phone,area,date,details) VALUES (?,?,?,?,?,?,?,?)')
      .run(l.id, l.seller_id, req.user.id, name, phone, b.area, date, String(b.details ?? '').trim().slice(0, 500));
    res.status(201).json(reqOut(db.prepare('SELECT * FROM m_requests WHERE id = ?').get(r.lastInsertRowid)));
  }));
  app.get('/api/requests', auth(), (req, res) => {
    res.json(db.prepare('SELECT * FROM m_requests WHERE buyer_id = ? ORDER BY id DESC').all(req.user.id).map((r) => reqOut(r, false)));
  });

  /* ---- seller tools ---- */
  const sellerListing = (id) => listingView(db.prepare(`${LISTING_SQL} WHERE l.id = ?`).get(id));
  app.get('/api/seller/listings', auth('seller'), (req, res) => {
    const rows = db.prepare(`${LISTING_SQL} WHERE l.seller_id = ? AND l.active = 1 ORDER BY l.id DESC`).all(req.seller.id);
    res.json(rows.map(listingView));
  });
  app.post('/api/seller/listings', auth('seller'), wrap((req, res) => {
    const b = req.body || {}, d = DEPT[b.dept];
    if (!d) return bad(res, 'Choose a department.');
    if (!d.subs.includes(b.sub)) return bad(res, 'Choose a category.');
    const title = str(b.title, 3, 90);
    if (!title) return bad(res, 'Enter a title of 3 to 90 characters.');
    const rands = Number(b.price);
    if (!(rands > 0) || rands > 5_000_000) return bad(res, 'Enter a price greater than R0.');
    const price = Math.round(rands * 100);
    let stock = 0, unit = '';
    if (d.svc) { unit = String(b.unit || ''); if (!UNITS.includes(unit)) return bad(res, 'Choose what the price is charged per.'); }
    else { stock = Number(b.stock); if (!Number.isInteger(stock) || stock < 1 || stock > 100000) return bad(res, 'Enter how many you have in stock.'); }
    const r = db.prepare('INSERT INTO m_listings (seller_id,dept,sub,type,title,description,price_cents,unit,stock,note) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(req.seller.id, d.id, b.sub, d.svc ? 'service' : 'good', title, String(b.description ?? '').trim().slice(0, 600), price, unit, stock, String(b.note ?? '').trim().slice(0, 200));
    res.status(201).json(sellerListing(r.lastInsertRowid));
  }));
  app.patch('/api/seller/listings/:id', auth('seller'), wrap((req, res) => {
    const l = db.prepare('SELECT * FROM m_listings WHERE id = ? AND seller_id = ? AND active = 1').get(req.params.id, req.seller.id);
    if (!l) return bad(res, 'not found', 404);
    const b = req.body || {};
    let price = l.price_cents, stock = l.stock;
    if (b.price !== undefined) { const r = Number(b.price); if (!(r > 0) || r > 5_000_000) return bad(res, 'Enter a price greater than R0.'); price = Math.round(r * 100); }
    if (b.stock !== undefined && l.type === 'good') { stock = Number(b.stock); if (!Number.isInteger(stock) || stock < 0 || stock > 100000) return bad(res, 'Enter a valid stock number.'); }
    db.prepare('UPDATE m_listings SET price_cents = ?, stock = ? WHERE id = ?').run(price, stock, l.id);
    res.json(sellerListing(l.id));
  }));
  app.delete('/api/seller/listings/:id', auth('seller'), wrap((req, res) => {
    const r = db.prepare('UPDATE m_listings SET active = 0 WHERE id = ? AND seller_id = ?').run(req.params.id, req.seller.id);
    if (!r.changes) return bad(res, 'not found', 404);
    res.json({ ok: true });
  }));
  app.get('/api/seller/orders', auth('seller'), (req, res) => {
    const rows = db.prepare(`SELECT o.* FROM m_orders o JOIN m_order_sellers os ON os.order_id = o.id
      WHERE os.seller_id = ? AND o.state IN ('placed','cancelled') ORDER BY o.id DESC`).all(req.seller.id);
    res.json(rows.map((o) => orderOut(o, { sellerId: req.seller.id })));
  });
  app.post('/api/seller/orders/:id/status', auth('seller'), wrap((req, res) => {
    const part = db.prepare("SELECT os.*, o.state FROM m_order_sellers os JOIN m_orders o ON o.id = os.order_id WHERE os.order_id = ? AND os.seller_id = ?").get(req.params.id, req.seller.id);
    if (!part || part.state !== 'placed') return bad(res, 'not found', 404);
    const to = req.body?.status, i = STEPS.indexOf(part.status);
    if (STEPS[i + 1] !== to) return bad(res, `This order is ${part.status.toLowerCase()}. The next step is ${STEPS[i + 1] ? STEPS[i + 1].toLowerCase() : 'none'}.`, 409);
    db.prepare('UPDATE m_order_sellers SET status = ? WHERE order_id = ? AND seller_id = ?').run(to, part.order_id, req.seller.id);
    if (to === 'Delivered') {
      db.prepare('UPDATE m_sellers SET sales = sales + 1 WHERE id = ?').run(req.seller.id);
      const left = db.prepare("SELECT 1 FROM m_order_sellers WHERE order_id = ? AND status != 'Delivered'").get(part.order_id);
      if (!left) db.prepare("UPDATE m_orders SET payment_status = 'paid' WHERE id = ? AND pay = 'cash'").run(part.order_id);
    }
    res.json(orderOut(db.prepare('SELECT * FROM m_orders WHERE id = ?').get(part.order_id), { sellerId: req.seller.id }));
  }));
  app.get('/api/seller/requests', auth('seller'), (req, res) => {
    res.json(db.prepare('SELECT * FROM m_requests WHERE seller_id = ? ORDER BY id DESC').all(req.seller.id).map((r) => reqOut(r, true)));
  });
  app.post('/api/seller/requests/:id/status', auth('seller'), wrap((req, res) => {
    const r = db.prepare('SELECT * FROM m_requests WHERE id = ? AND seller_id = ?').get(req.params.id, req.seller.id);
    if (!r) return bad(res, 'not found', 404);
    if (!(REQ_NEXT[r.status] || []).includes(req.body?.status)) return bad(res, `A ${r.status.toLowerCase()} request cannot be set to ${String(req.body?.status).toLowerCase()}.`, 409);
    db.prepare('UPDATE m_requests SET status = ? WHERE id = ?').run(req.body.status, r.id);
    res.json(reqOut(db.prepare('SELECT * FROM m_requests WHERE id = ?').get(r.id), true));
  }));
}
