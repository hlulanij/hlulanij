/* MzansiConnect website. Plain JavaScript, no libraries: small download, works on low-end phones. */
(() => {
'use strict';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const R = (cents) => { const r = cents / 100; return 'R' + (Number.isInteger(r) ? String(r) : r.toFixed(2)).replace(/\B(?=(\d{3})+(?!\d)(?!\.))/g, ' '); };
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const ls = {
  get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

/* ---------- state ---------- */
const st = {
  meta: { areas: [], depts: [], units: [], demo: false },
  token: ls.get('mc_token', null), user: null,
  area: ls.get('mc_area', 'Giyani Town'),
  cart: ls.get('mc_cart', []), wish: ls.get('mc_wish', []),
  co: { method: 'deliver', pay: 'cash' }, toast: '', err: [],
};
const DEPT = (id) => st.meta.depts.find((d) => d.id === id);
const saveCart = () => ls.set('mc_cart', st.cart);
const cartCount = () => st.cart.reduce((n, l) => n + l.qty, 0);

/* ---------- api ---------- */
async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { ...(body ? { 'content-type': 'application/json' } : {}), ...(st.token ? { authorization: `Bearer ${st.token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401 && st.token) { logout(true); }
    const e = new Error(data.error || 'Something went wrong. Please try again.');
    e.status = res.status;
    throw e;
  }
  return data;
}
function setSession(token, user) { st.token = token; st.user = user; ls.set('mc_token', token); }
function logout(silent) { st.token = null; st.user = null; ls.del('mc_token'); if (!silent) { go('/'); } renderChrome(); }

/* ---------- pictures: neutral placeholders until a seller uploads a photo ---------- */
const N1 = '#d3d8d5', N2 = '#a9b2ac', W = '#fff', DK = '#2b2b2b', GR = '#2e7d32';
const SH = {
  logs: (t) => `<rect x="12" y="68" width="70" height="26" rx="13" fill="${t}"/><circle cx="82" cy="81" r="13" fill="${W}" stroke="${N2}" stroke-width="3"/><circle cx="82" cy="81" r="5" fill="${N1}"/><rect x="34" y="36" width="70" height="26" rx="13" fill="${t}" opacity=".85"/><circle cx="104" cy="49" r="13" fill="${W}" stroke="${N2}" stroke-width="3"/><circle cx="104" cy="49" r="5" fill="${N1}"/>`,
  sack: (t) => `<path d="M36 20c10 7 38 7 48 0l9 24c4 22 3 46-6 64H33c-9-18-10-42-6-64z" fill="${t}"/><rect x="40" y="52" width="40" height="30" rx="4" fill="${W}" opacity=".92"/><rect x="46" y="60" width="24" height="5" rx="2" fill="${N2}"/><rect x="46" y="70" width="16" height="4" rx="2" fill="${N1}"/>`,
  cow: (t) => `<rect x="24" y="46" width="62" height="32" rx="14" fill="${t}"/><rect x="76" y="34" width="28" height="26" rx="9" fill="${t}"/><path d="M82 34l-6-11M99 34l6-11" stroke="${N2}" stroke-width="5" stroke-linecap="round"/><circle cx="96" cy="44" r="2.6" fill="${W}"/><rect x="30" y="74" width="9" height="28" rx="3" fill="${t}"/><rect x="70" y="74" width="9" height="28" rx="3" fill="${t}"/><path d="M25 54c-9 4-11 17-9 26" fill="none" stroke="${t}" stroke-width="5" stroke-linecap="round"/><ellipse cx="50" cy="58" rx="10" ry="7" fill="${W}" opacity=".7"/>`,
  goat: (t) => `<rect x="28" y="52" width="52" height="26" rx="12" fill="${t}"/><rect x="72" y="38" width="24" height="22" rx="9" fill="${t}"/><path d="M78 38c-2-10 4-16 8-16M92 38c2-10-2-16-6-16" fill="none" stroke="${N2}" stroke-width="4" stroke-linecap="round"/><path d="M90 60l-1 10" stroke="${N2}" stroke-width="4" stroke-linecap="round"/><circle cx="88" cy="47" r="2.4" fill="${W}"/><rect x="34" y="76" width="7" height="26" rx="3" fill="${t}"/><rect x="68" y="76" width="7" height="26" rx="3" fill="${t}"/>`,
  hen: (t) => `<ellipse cx="56" cy="68" rx="30" ry="24" fill="${t}"/><circle cx="84" cy="44" r="14" fill="${t}"/><path d="M97 44l13 4-13 4z" fill="${N2}"/><path d="M80 30q4-10 9 0q4-8 8 2" fill="none" stroke="#c9321f" stroke-width="5" stroke-linecap="round"/><circle cx="88" cy="42" r="2.2" fill="${W}"/><path d="M40 70q14 10 30 0" fill="none" stroke="${W}" stroke-width="4" opacity=".7"/><path d="M50 92l-4 15M64 92l4 15" stroke="${N2}" stroke-width="4" stroke-linecap="round"/>`,
  seeds: (t) => `<rect x="30" y="26" width="60" height="84" rx="4" fill="${t}"/><rect x="38" y="48" width="44" height="46" rx="3" fill="${W}" opacity=".93"/><path d="M60 88V68" stroke="${GR}" stroke-width="3"/><path d="M60 72c-9 0-13-7-13-13 9 0 13 5 13 13zM60 72c9 0 13-7 13-13-9 0-13 5-13 13z" fill="${GR}"/>`,
  hoe: (t) => `<path d="M28 104L88 26" stroke="#8a6a45" stroke-width="7" stroke-linecap="round"/><path d="M82 18l26 10-9 20-23-9z" fill="${t}"/>`,
  sprayer: (t) => `<rect x="32" y="30" width="48" height="74" rx="12" fill="${t}"/><rect x="45" y="19" width="22" height="13" rx="4" fill="${N2}"/><path d="M80 52c15 0 19 9 19 21v30" fill="none" stroke="${N2}" stroke-width="6" stroke-linecap="round"/><rect x="40" y="58" width="32" height="22" rx="3" fill="${W}" opacity=".9"/>`,
  tomato: (t) => `<circle cx="42" cy="72" r="24" fill="${t}"/><circle cx="80" cy="72" r="24" fill="${t}"/><circle cx="61" cy="44" r="24" fill="${t}"/><path d="M52 24l9 7 9-7M33 52l9 6 8-8M71 52l9 6 8-8" fill="none" stroke="${GR}" stroke-width="4" stroke-linecap="round"/>`,
  leaf: (t) => `<path d="M60 108V52" stroke="${GR}" stroke-width="5" stroke-linecap="round"/><path d="M60 82C30 80 18 58 24 32c26 2 38 22 36 50z" fill="${t}"/><path d="M60 82c30-2 42-24 36-50-26 2-38 22-36 50z" fill="${t}" opacity=".85"/>`,
  mango: (t) => `<ellipse cx="58" cy="70" rx="30" ry="38" transform="rotate(25 58 70)" fill="${t}"/><path d="M62 30c8-10 22-10 28-6-5 11-16 15-28 6z" fill="${GR}"/>`,
  nut: (t) => `<ellipse cx="48" cy="58" rx="28" ry="18" transform="rotate(-30 48 58)" fill="${t}"/><ellipse cx="74" cy="78" rx="28" ry="18" transform="rotate(-30 74 78)" fill="${t}"/>`,
  bricks: (t) => `<g fill="${t}"><rect x="12" y="78" width="44" height="22" rx="2"/><rect x="60" y="78" width="44" height="22" rx="2"/><rect x="36" y="52" width="44" height="22" rx="2"/><rect x="84" y="52" width="24" height="22" rx="2"/><rect x="12" y="52" width="20" height="22" rx="2"/><rect x="12" y="26" width="44" height="22" rx="2" opacity=".85"/><rect x="60" y="26" width="44" height="22" rx="2" opacity=".85"/></g>`,
  roof: (t) => `<path d="M18 94L38 28h72L90 94z" fill="${t}"/><path d="M32 94l19-66M48 94l19-66M64 94l19-66M80 94l19-66" stroke="${W}" stroke-width="3" opacity=".55"/>`,
  tractor: (t) => `<rect x="26" y="52" width="60" height="24" rx="6" fill="${t}"/><rect x="56" y="28" width="30" height="30" rx="4" fill="${t}"/><rect x="61" y="33" width="20" height="14" rx="2" fill="${W}" opacity=".92"/><rect x="32" y="32" width="6" height="22" fill="${N2}"/><circle cx="36" cy="88" r="14" fill="${DK}"/><circle cx="36" cy="88" r="6" fill="${N1}"/><circle cx="88" cy="78" r="22" fill="${DK}"/><circle cx="88" cy="78" r="9" fill="${N1}"/>`,
  tanker: (t) => `<rect x="8" y="56" width="28" height="30" rx="4" fill="${N2}"/><rect x="36" y="40" width="74" height="42" rx="21" fill="${t}"/><path d="M73 50c6 8 9 12 9 16a9 9 0 0 1-18 0c0-4 3-8 9-16z" fill="${W}" opacity=".92"/><circle cx="26" cy="92" r="10" fill="${DK}"/><circle cx="76" cy="92" r="10" fill="${DK}"/><circle cx="98" cy="92" r="10" fill="${DK}"/>`,
  tank: (t) => `<rect x="30" y="26" width="60" height="80" rx="14" fill="${t}"/><ellipse cx="60" cy="30" rx="30" ry="9" fill="${W}" opacity=".35"/><path d="M60 54c9 11 13 17 13 23a13 13 0 0 1-26 0c0-6 4-12 13-23z" fill="${W}" opacity=".92"/>`,
  pump: (t) => `<rect x="26" y="52" width="54" height="42" rx="10" fill="${t}"/><circle cx="53" cy="73" r="13" fill="${W}" opacity=".92"/><circle cx="53" cy="73" r="5" fill="${N2}"/><rect x="80" y="64" width="28" height="12" rx="3" fill="${N2}"/><rect x="38" y="38" width="30" height="16" rx="3" fill="${N2}"/>`,
  bakkie: (t) => `<rect x="8" y="58" width="54" height="24" rx="3" fill="${t}"/><path d="M62 82V54h22l18 15v13z" fill="${t}"/><rect x="68" y="58" width="15" height="11" fill="${W}" opacity=".92"/><circle cx="30" cy="88" r="11" fill="${DK}"/><circle cx="88" cy="88" r="11" fill="${DK}"/>`,
  truck: (t) => `<rect x="6" y="38" width="66" height="46" rx="4" fill="${t}"/><path d="M72 84V50h24l16 18v16z" fill="${N2}"/><rect x="78" y="55" width="14" height="11" fill="${W}" opacity=".92"/><circle cx="26" cy="90" r="11" fill="${DK}"/><circle cx="54" cy="90" r="11" fill="${DK}"/><circle cx="94" cy="90" r="11" fill="${DK}"/>`,
};
function shapeFor(l) {
  const t = l.title.toLowerCase(), s = l.sub;
  const map = { Firewood: 'logs', 'Charcoal & kindling': t.includes('kindling') ? 'logs' : 'sack', Cattle: 'cow', 'Goats & sheep': 'goat', Poultry: 'hen', Seeds: 'seeds', 'Feed & fertiliser': 'sack', 'Tools & sprayers': t.includes('spray') ? 'sprayer' : 'hoe',
    Vegetables: t.includes('tomato') ? 'tomato' : 'leaf', Fruit: 'mango', 'Dried & pantry': t.includes('nut') ? 'nut' : 'sack', 'Cement & bricks': t.includes('brick') ? 'bricks' : 'sack', 'Roofing & sand': t.includes('sand') ? 'bakkie' : 'roof', 'Water tanks': 'tank',
    'Ploughing & planting': 'tractor', 'Tractor hire': 'tractor', 'Water delivery': 'tanker', 'Boreholes & pumps': 'pump', 'Bakkie & truck hire': t.includes('truck') ? 'truck' : 'bakkie', 'Livestock transport': 'truck' };
  return map[s] || DEPT(l.dept)?.shape || 'sack';
}
const toneFor = (l) => DEPT(l.dept)?.tone || '#007749';
const pic = (l) => l.photo
  ? `<img class="ph" loading="lazy" alt="${esc(l.title)}" src="${esc(l.photo)}">`
  : `<svg class="pimg" viewBox="0 0 120 120" role="img" aria-label="${esc(l.title)}">${SH[shapeFor(l)](toneFor(l))}</svg>`;
const stars = (r) => { const f = Math.round(r); return `<span class="stars" aria-label="${r.toFixed(1)} out of 5">${'★'.repeat(f)}${'☆'.repeat(5 - f)}</span>`; };
const when = (s) => new Date(String(s).replace(' ', 'T') + (String(s).includes('Z') ? '' : 'Z')).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
const areaOpts = (sel, blank) => (blank ? '<option value="">Select</option>' : '') + st.meta.areas.map((a) => `<option${a === sel ? ' selected' : ''}>${esc(a)}</option>`).join('');
const priceHtml = (l, big) => l.type === 'service'
  ? `<span class="price">From ${R(l.priceCents)}</span> <small class="mute${big ? '' : ' sm'}">${esc(l.unit)}</small>`
  : `<span class="price">${R(l.priceCents)}</span>`;
const badge = (s) => `<span class="badge ${{ Processing: 'y', New: 'y', 'Waiting for payment': 'y', Packed: 'b', Confirmed: 'b', Shipped: 'b', Delivered: 'g', Completed: 'g', Cancelled: 'r', Declined: 'r' }[s] || ''}">${esc(s)}</span>`;

/* ---------- chrome ---------- */
const FLAG = ['#000', '#ffb81c', '#007749', '#e03c31', '#001489'].map((c) => `<i style="background:${c}"></i>`).join('');
const ico = (n) => `<svg viewBox="0 0 24 24" aria-hidden="true">${{
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>',
  heartf: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor"/>',
  cart: '<path d="M3 4h3l2.4 11h10l2-8H7" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="10" cy="19.5" r="1.6" fill="currentColor"/><circle cx="17" cy="19.5" r="1.6" fill="currentColor"/>',
  user: '<circle cx="12" cy="8" r="4" fill="none" stroke="currentColor" stroke-width="2"/><path d="M4 21a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
  orders: '<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/><path d="M9 8h6M9 12h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>',
}[n]}</svg>`;
function chrome() {
  const u = st.user, n = cartCount(), wn = st.wish.length, path = location.pathname, q = new URLSearchParams(location.search);
  const dept = st.meta.depts.map((d, i) => `${i === 5 ? '<i class="sep"></i>' : ''}<a data-link href="/shop?dept=${d.id}" class="${path === '/shop' && q.get('dept') === d.id ? 'on' : ''}">${esc(d.name)}</a>`).join('');
  const opts = '<option value="">All departments</option>' + st.meta.depts.map((d) => `<option value="${d.id}"${path === '/shop' && q.get('dept') === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('');
  return `<a class="skip" href="#main">Skip to content</a><div class="flag" aria-hidden="true">${FLAG}</div>`
   + (st.meta.demo ? '<div class="demo">Preview version: shops, prices and phone numbers on this site are samples.</div>' : '')
   + `<div class="util"><div class="w"><label>Your area: <select data-chg="area" aria-label="Your area">${areaOpts(st.area)}</select></label><div class="links">`
   + '<a data-link href="/sell">Sell on MzansiConnect</a>'
   + (u ? `<span class="hidem">Hi, ${esc(u.name.split(' ')[0])}</span><a href="#" data-act="logout" class="hidem">Log out</a>` : '<a data-link href="/login" class="hidem">Log in</a><a data-link href="/login?mode=register" class="hidem">Register</a>')
   + '</div></div></div>'
   + `<header class="head"><div class="w"><a class="logo" data-link href="/" aria-label="MzansiConnect home"><img src="/logo.svg" alt="" width="32" height="32"><span>Mzansi<b>Connect</b></span></a>`
   + `<form class="sf" id="sf" role="search"><select id="sd" aria-label="Department">${opts}</select><input id="sq" type="search" placeholder="Search products and services" aria-label="Search" value="${esc(path === '/shop' ? q.get('q') || '' : '')}"><button type="submit">Search</button></form>`
   + `<div class="tools"><a class="tool" data-link href="/my-orders">${ico('orders')}<span>Orders</span></a>`
   + `<a class="tool" data-link href="${u ? (u.role === 'seller' ? '/dashboard' : '/my-orders') : '/login'}">${ico('user')}<span>${u ? (u.role === 'seller' ? 'My shop' : 'Account') : 'Log in'}</span></a>`
   + `<a class="tool" data-link href="/saved" aria-label="Saved items">${ico('heart')}<span>Saved</span>${wn ? `<i class="n">${wn}</i>` : ''}</a>`
   + `<a class="tool" data-link href="/cart" aria-label="Cart">${ico('cart')}<span>Cart</span>${n ? `<i class="n">${n}</i>` : ''}</a></div></div></header>`
   + `<nav class="dept" aria-label="Departments"><div class="w">${dept}<a class="sell" data-link href="/sell">Sell with us</a></div></nav>`;
}
function footer() {
  const d = st.meta.depts;
  return '<footer><div class="w"><div class="cols">'
   + `<div><h3>Shop</h3>${d.slice(0, 5).map((x) => `<a data-link href="/shop?dept=${x.id}">${esc(x.name)}</a>`).join('')}</div>`
   + `<div><h3>Services</h3>${d.slice(5).map((x) => `<a data-link href="/shop?dept=${x.id}">${esc(x.name)}</a>`).join('')}<a data-link href="/login?mode=register&role=seller">Offer a service</a></div>`
   + '<div><h3>Sell</h3><a data-link href="/sell">Sell on MzansiConnect</a><a data-link href="/login?mode=register&role=seller">Register as a seller</a></div>'
   + '<div><h3>Help</h3><a data-link href="/help">Help and delivery</a><a data-link href="/terms">Terms of use</a><a data-link href="/privacy">Privacy policy</a></div>'
   + `</div><div class="base">© 2026 MzansiConnect. Serving Giyani and surrounding villages, Limpopo.${(st.meta.contact?.email || st.meta.contact?.phone) ? ' Contact: ' + [st.meta.contact.email, st.meta.contact.phone].filter(Boolean).map(esc).join(' · ') : ''}</div></div></footer>`;
}
function renderChrome() { const h = $('#chrome'), f = $('#foot'); if (h) h.innerHTML = chrome(); if (f) f.innerHTML = footer(); }

/* ---------- cards ---------- */
function card(l) {
  const here = l.seller.village === st.area, svc = l.type === 'service', saved = st.wish.includes(l.id);
  return `<article class="card"><div class="imgb"><a class="imgl" data-link href="/product/${l.id}" aria-label="${esc(l.title)}" style="position:absolute;inset:0;display:block">${pic(l)}</a>`
   + (svc ? '<span class="tag svc">Service</span>' : '')
   + `<button class="heart${saved ? ' on' : ''}" data-act="wish" data-id="${l.id}" aria-label="${saved ? 'Remove from saved' : 'Save for later'}">${ico(saved ? 'heartf' : 'heart')}</button></div>`
   + `<div class="by ell">${esc(l.seller.name)}</div><a class="t" data-link href="/product/${l.id}">${esc(l.title)}</a>`
   + `<div class="loc${here ? ' here' : ''}">${here ? 'In your area · ' : ''}${esc(l.seller.village)}</div>`
   + `<div>${stars(l.seller.rating)} <span class="mute sm">seller</span></div><div>${priceHtml(l)}</div>`
   + (svc ? `<a class="btn o sm" data-link href="/product/${l.id}">Request service</a>` : (l.stock > 0 ? `<button class="btn o sm" data-act="addcart" data-id="${l.id}">Add to cart</button>` : '<button class="btn o sm" disabled>Sold out</button>')) + '</article>';
}
const rowSec = (title, items, link, label) => items.length ? `<section class="sec"><div class="row between"><h2>${title}</h2>${link ? `<a class="link" data-link href="${link}">${label || 'See all'}</a>` : ''}</div><div class="grid">${items.map(card).join('')}</div></section>` : '';
const listings = (params) => api('/listings?' + new URLSearchParams(params)).then((r) => r.items);

/* ---------- views ---------- */
const views = {};
views.home = async () => {
  const [near, live, svc, fuel, produce] = await Promise.all([
    listings({ sort: 'near', area: st.area, limit: 6 }), listings({ dept: 'livestock', limit: 6 }), listings({ type: 'service', limit: 30 }),
    listings({ dept: 'fuel', limit: 3 }), listings({ dept: 'produce', limit: 3 }),
  ]);
  const services = svc.filter((l) => ['tractor', 'water'].includes(l.dept)).slice(0, 6);
  const tiles = st.meta.depts.map((d) => `<a class="tile" data-link href="/shop?dept=${d.id}"><div class="pimg" style="aspect-ratio:1/1;position:relative"><svg class="pimg" viewBox="0 0 120 120" style="position:absolute;inset:14%;width:72%;height:72%">${SH[d.shape]('#007749')}</svg></div>${esc(d.name)}${d.svc ? '<small>Service</small>' : ''}</a>`).join('');
  const none = !near.length;
  return { title: 'MzansiConnect | Buy and sell in Giyani', html: '<div class="w">'
   + `<div class="banner"><div><h1>Buy and sell in Giyani and the villages around it</h1><p>Firewood, livestock, farming supplies, tractor and water services from sellers near you. Pay when it arrives. Got something to sell? Open your shop for free.</p><div class="row wrapx"><a class="btn" data-link href="/shop">Browse everything</a><a class="btn o" data-link href="/login?mode=register&role=seller">Start selling</a></div></div>`
   + `<div class="pics" aria-hidden="true">${[['logs', '#8a5a2b'], ['cow', '#7a4b2a'], ['tractor', '#c9321f']].map(([k, t]) => `<div class="pimg" style="aspect-ratio:1/1;position:relative"><svg class="pimg" viewBox="0 0 120 120" style="position:absolute;inset:12%;width:76%;height:76%">${SH[k](t)}</svg></div>`).join('')}</div></div>`
   + `<section class="sec"><div class="row between"><h2>Shop by department</h2></div><div class="tiles">${tiles}</div></section>`
   + (none ? '<section class="sec"><div class="panel"><h2>No listings yet</h2><p class="mute">Be the first seller on MzansiConnect. Listing is free.</p><a class="btn" data-link href="/login?mode=register&role=seller">Register as a seller</a></div></section>' : '')
   + rowSec(`Near ${esc(st.area)}`, near, '') + rowSec('Livestock', live, '/shop?dept=livestock') + rowSec('Tractor and water services', services, '/shop?dept=tractor', 'See tractor services')
   + rowSec('Firewood and fresh produce', [...fuel, ...produce], '/shop?dept=fuel')
   + '<section class="sec"><h2 style="margin-bottom:14px">How it works</h2><div class="steps"><div class="step"><b>1. Find what you need</b><span class="mute">Search or browse by department. Set your area to see sellers closest to you.</span></div><div class="step"><b>2. Order or request a service</b><span class="mute">Add products to your cart. For tractors, water and transport, send a request with your date and village.</span></div><div class="step"><b>3. Sellers deliver, you pay</b><span class="mute">Sellers arrange delivery to your village, or you collect. Pay cash, by EFT or by card.</span></div></div></section>'
   + '<section class="sec"><div class="sellband"><div><h2>Sell on MzansiConnect</h2><p class="mute" style="margin:6px 0 0;max-width:38em">Farmers, traders and service providers across Giyani can list products and services for free. We show them to buyers in your area and nearby villages.</p></div><a class="btn" data-link href="/sell">How selling works</a></div></section>'
   + '<section class="sec"><div class="trust"><div><b>Local sellers</b><span class="mute sm">Neighbours and businesses from Giyani and nearby villages</span></div><div><b>Pay your way</b><span class="mute sm">Cash on delivery or collection, EFT or card</span></div><div><b>Delivery to villages</b><span class="mute sm">Sellers deliver to your village or you collect</span></div><div><b>Simple to use</b><span class="mute sm">English only, plain steps, no extras</span></div></div></section></div>' };
};

const PRICES = [['any', 'Any price', {}], ['u200', 'Under R200', { max: 200 }], ['200', 'R200 to R999', { min: 200, max: 1000 }], ['1000', 'R1 000 to R4 999', { min: 1000, max: 5000 }], ['5000', 'R5 000 and over', { min: 5000 }]];
views.shop = async () => {
  const q = new URLSearchParams(location.search), dept = q.get('dept') || '', sub = q.get('sub') || '', text = q.get('q') || '', sort = q.get('sort') || 'pop';
  const price = q.get('price') || 'any', rating = Number(q.get('rating')) || 0, vill = (q.get('v') || '').split(',').filter(Boolean);
  const base = { sort, area: st.area, limit: 100, ...(dept && { dept }), ...(sub && { sub }), ...(text && { q: text }), ...(PRICES.find((p) => p[0] === price)?.[2] || {}) };
  const all = await listings(base); // village counts come from this list; the village filter is applied below
  const vc = {}; all.forEach((l) => { vc[l.seller.village] = (vc[l.seller.village] || 0) + 1; });
  const items = all.filter((l) => (!vill.length || vill.includes(l.seller.village)) && (!rating || l.seller.rating >= rating));
  const d = dept ? DEPT(dept) : null;
  const link = (over) => { const n = new URLSearchParams(location.search); for (const [k, v] of Object.entries(over)) { if (v === '' || v == null) n.delete(k); else n.set(k, v); } return '/shop' + (n.toString() ? '?' + n : ''); };
  const title = text ? `Results for “${esc(text)}”` : (d ? esc(d.name) : 'All products and services');
  const pills = d ? `<div class="pills"><a data-link class="pill${!sub ? ' on' : ''}" href="${link({ sub: '' })}">All</a>${d.subs.map((s) => `<a data-link class="pill${sub === s ? ' on' : ''}" href="${link({ sub: s })}">${esc(s)}</a>`).join('')}</div>` : '';
  const deptLinks = `<a class="lnk${!dept ? ' on' : ''}" data-link href="${link({ dept: '', sub: '' })}">All departments</a>` + st.meta.depts.map((x) => `<a class="lnk${dept === x.id ? ' on' : ''}" data-link href="${link({ dept: x.id, sub: '' })}">${esc(x.name)}</a>`).join('');
  const aside = `<details class="filters"${innerWidth > 980 ? ' open' : ''}><summary>Filters</summary><div class="fg"><h3>Department</h3>${deptLinks}</div>`
   + `<div class="fg"><h3>Price</h3>${PRICES.map((p) => `<label><input type="radio" name="pr" data-chg="price" value="${p[0]}"${price === p[0] ? ' checked' : ''}> ${p[1]}</label>`).join('')}</div>`
   + `<div class="fg"><h3>Sold from</h3>${Object.keys(vc).sort().map((k) => `<label><input type="checkbox" data-chg="vill" value="${esc(k)}"${vill.includes(k) ? ' checked' : ''}> ${esc(k)} <span class="mute sm">(${vc[k]})</span></label>`).join('') || '<span class="mute sm">None</span>'}</div>`
   + `<div class="fg"><h3>Seller rating</h3>${[[0, 'Any rating'], [4.5, '4.5 stars and up'], [4, '4 stars and up']].map((o) => `<label><input type="radio" name="rt" data-chg="rating" value="${o[0]}"${rating === o[0] ? ' checked' : ''}> ${o[1]}</label>`).join('')}</div>`
   + `<a class="link" data-link href="${dept ? '/shop?dept=' + dept : '/shop'}" style="display:inline-block;margin-top:12px">Clear all filters</a></details>`;
  return { title: `${d ? d.name : 'Shop'} | MzansiConnect`, html: `<div class="w"><div class="crumbs"><a data-link href="/">Home</a><span>/</span>${d ? (sub ? `<a data-link href="/shop?dept=${d.id}">${esc(d.name)}</a><span>/</span>${esc(sub)}` : esc(d.name)) : title}</div>`
   + `<div class="bar"><h1>${title} <span class="mute sm" style="font-weight:400">(${plural(items.length, 'result')})</span></h1><label class="sm">Sort by <select data-chg="sort">${[['pop', 'Most popular'], ['near', 'Closest to ' + st.area], ['lo', 'Price: low to high'], ['hi', 'Price: high to low'], ['neu', 'Newest']].map((o) => `<option value="${o[0]}"${sort === o[0] ? ' selected' : ''}>${esc(o[1])}</option>`).join('')}</select></label></div>`
   + `${pills}<div class="lay" style="margin-top:14px"><aside>${aside}</aside><div>${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<div class="empty"><h2>Nothing found</h2><p>Try removing a filter or searching for something else.</p><a class="btn o" data-link href="/shop">Clear filters</a></div>'}</div></div></div>` };
};

views.product = async (id) => {
  const l = await api('/listings/' + id).catch((e) => { if (e.status === 404) return null; throw e; });
  if (!l) return views.notfound();
  const d = DEPT(l.dept), svc = l.type === 'service', saved = st.wish.includes(l.id);
  const rel = (await listings({ dept: l.dept, limit: 7 })).filter((x) => x.id !== l.id).slice(0, 6);
  const specs = [['Seller', l.seller.name], ['Sold from', `${l.seller.village}, Greater Giyani`], ['Department', `${d.name} / ${l.sub}`], ['Type', svc ? 'Service' : 'Product'], svc ? ['Price unit', l.unit] : ['In stock', String(l.stock)], ['Listing code', 'MC-' + String(l.id).padStart(5, '0')]];
  const buy = svc
    ? `<div class="box"><div class="ok">Available in Giyani and surrounding villages</div><div class="sm">Send a request below. ${esc(l.seller.name)} will phone you to confirm the date and the final price.</div></div><div class="panel" style="margin-top:16px" id="req"><h2>Request this service</h2>${reqForm(l)}</div>`
    : `<div class="box"><div class="${l.stock > 0 ? 'ok' : 'mute'}">${l.stock > 0 ? (l.stock <= 5 ? `Only ${l.stock} left` : 'In stock') : 'Sold out'}</div><div class="sm">${l.note ? esc(l.note) : `Delivered by the seller to your village, or you can collect from ${esc(l.seller.village)}.`}</div><div class="sm mute">Delivery is arranged by the seller: R30 in the same village, R60 to other villages, free over R800 from one seller.</div></div>`
     + (l.stock > 0 ? `<div class="row" style="margin-top:16px"><select class="qty" id="qty" aria-label="Quantity">${Array.from({ length: Math.min(10, l.stock) }, (_, i) => `<option>${i + 1}</option>`).join('')}</select><button class="btn grow" data-act="addcart2" data-id="${l.id}">Add to cart</button><button class="btn o" data-act="wish" data-id="${l.id}">${saved ? 'Saved' : 'Save'}</button></div>` : '');
  return { title: `${l.title} | MzansiConnect`, html: `<div class="w"><div class="crumbs"><a data-link href="/">Home</a><span>/</span><a data-link href="/shop?dept=${d.id}">${esc(d.name)}</a><span>/</span><a data-link href="/shop?dept=${d.id}&sub=${encodeURIComponent(l.sub)}">${esc(l.sub)}</a></div>`
   + `<div class="pd"><div class="gal"><div class="main">${pic(l)}${svc ? '<span class="tag svc">Service</span>' : ''}</div><p class="mute sm" style="margin-top:8px">${l.photo ? 'Photo uploaded by the seller.' : 'Sample picture. The seller can add a real photo.'}</p></div>`
   + `<div class="info"><div class="mute sm" style="text-transform:uppercase;letter-spacing:.05em;font-weight:600">${esc(l.seller.name)} · ${esc(l.seller.village)}</div><h1 style="margin:4px 0 8px">${esc(l.title)}</h1><div>${stars(l.seller.rating)} <span class="mute sm">${l.seller.rating.toFixed(1)} seller rating · ${plural(l.seller.sales, 'sale')}</span></div>`
   + `<div style="margin-top:12px">${priceHtml(l, true)}</div>${buy}`
   + `<div class="box" style="margin-top:16px"><b>Sold by ${esc(l.seller.name)}</b><div class="mute sm">${esc(l.seller.village)}</div><div class="mute sm">The seller's phone number is shared with you after you ${svc ? 'send a request' : 'place an order'}.</div></div></div></div>`
   + `<section class="sec"><h2 style="margin-bottom:10px">Description</h2><p style="max-width:48em;margin:0;white-space:pre-wrap">${esc(l.description || 'No description yet.')}</p></section>`
   + `<section class="sec"><h2 style="margin-bottom:10px">Details</h2><table class="sp" style="max-width:640px"><tbody>${specs.map((r) => `<tr><td>${r[0]}</td><td>${esc(r[1])}</td></tr>`).join('')}</tbody></table></section>`
   + rowSec(`More in ${esc(d.name)}`, rel, '') + '</div>' };
};
function reqForm(l) {
  const u = st.user, v = st.reqv || {};
  return `${st.err.length ? `<div class="err" role="alert">${st.err.map(esc).join('<br>')}</div>` : ''}<form id="reqform" data-id="${l.id}" novalidate>`
   + `<div class="f2"><div class="fld"><label for="r_name">Your name</label><input id="r_name" autocomplete="name" value="${esc(v.name || (u ? u.name : ''))}"></div><div class="fld"><label for="r_phone">Mobile number</label><input id="r_phone" type="tel" autocomplete="tel" placeholder="082 123 4567" value="${esc(v.phone || (u ? u.phone : ''))}"></div></div>`
   + `<div class="f2"><div class="fld"><label for="r_area">Where is the work?</label><select id="r_area">${areaOpts(v.area || st.area)}</select></div><div class="fld"><label for="r_date">Preferred date</label><input id="r_date" type="date" min="${new Date(Date.now() + 2 * 3600e3).toISOString().slice(0, 10)}" value="${esc(v.date || '')}"></div></div>`
   + `<div class="fld"><label for="r_det">Details (size of field, load, directions)</label><textarea id="r_det" rows="3" maxlength="500">${esc(v.details || '')}</textarea></div><button class="btn w100" type="submit">Send request</button></form><p class="mute sm" style="margin:8px 0 0">Sending a request is free. You pay the provider after the work is done.</p>`;
}

views.cart = async () => {
  if (!st.cart.length) return { title: 'Cart | MzansiConnect', html: '<div class="w"><h1 style="margin-bottom:14px">Cart</h1><div class="empty"><p>Your cart is empty.</p><a class="btn" data-link href="/">Continue shopping</a></div></div>' };
  const items = await listings({ ids: st.cart.map((l) => l.id).join(','), limit: 50 });
  const byId = new Map(items.map((l) => [l.id, l]));
  const gone = st.cart.filter((l) => !byId.has(l.id)); // sold or removed since it was added
  if (gone.length) { st.cart = st.cart.filter((l) => byId.has(l.id)); saveCart(); renderChrome(); }
  if (!st.cart.length) return views.cart();
  const quote = await api('/quote', { method: 'POST', body: { items: st.cart.map((l) => ({ listingId: l.id, qty: l.qty })), method: 'deliver', area: st.area } }).catch((e) => ({ error: e.message }));
  const lines = st.cart.map((c) => { const l = byId.get(c.id); const max = Math.max(1, Math.min(10, l.stock));
    return `<div class="line"><div class="imgb" style="border:1px solid var(--line);border-radius:4px;background:var(--soft);position:relative;overflow:hidden;aspect-ratio:1/1">${pic(l)}</div><div><a class="link" data-link href="/product/${l.id}" style="font-weight:600">${esc(l.title)}</a><div class="mute sm">Sold by ${esc(l.seller.name)}, ${esc(l.seller.village)}</div><button class="link sm" data-act="remove" data-id="${l.id}" style="font-weight:500;margin-top:6px">Remove</button></div>`
     + `<div class="after" style="text-align:right"><div class="price">${R(l.priceCents * c.qty)}</div><select class="qty" style="margin-top:6px" data-chg="cartqty" data-id="${l.id}" aria-label="Quantity">${Array.from({ length: max }, (_, i) => `<option${i + 1 === c.qty ? ' selected' : ''}>${i + 1}</option>`).join('')}</select></div></div>`; }).join('');
  const sum = quote.error ? `<div class="err">${esc(quote.error)}</div>` : `<div class="sum"><span>Subtotal</span><span>${R(quote.subtotalCents)}</span></div><div class="sum"><span>Delivery to ${esc(st.area)}</span><span>${quote.deliveryCents ? R(quote.deliveryCents) : (quote.sellers.some((s) => s.arranged) ? 'Arranged with seller' : 'Free')}</span></div><p class="mute sm" style="margin:2px 0">Choose collection at checkout to skip delivery fees.</p><div class="sum t"><span>Total</span><span>${R(quote.totalCents)}</span></div>`;
  return { title: 'Cart | MzansiConnect', html: `<div class="w"><h1 style="margin-bottom:14px">Cart (${plural(cartCount(), 'item')})</h1>${gone.length ? '<div class="note">Some items were removed because they are no longer available.</div>' : ''}<div class="two"><div class="panel">${lines}</div><div class="panel"><h2>Order summary</h2>${sum}<a class="btn w100" data-link href="/checkout" style="margin-top:12px">Proceed to checkout</a><a class="btn o w100" data-link href="/" style="margin-top:8px">Continue shopping</a></div></div></div>` };
};

const needLogin = (next, msg) => { st.loginNote = msg; go('/login?next=' + encodeURIComponent(next), true); return { title: 'Log in | MzansiConnect', html: '' }; };
views.checkout = async () => {
  if (!st.cart.length) return views.cart();
  if (!st.user) return needLogin('/checkout', 'Log in or register to complete your order.');
  const c = st.co, v = st.coVals = { c_name: st.user.name, c_phone: st.user.phone, c_area: st.area, ...(st.coVals || {}) };
  const quote = await api('/quote', { method: 'POST', body: { items: st.cart.map((l) => ({ listingId: l.id, qty: l.qty })), method: c.method, area: v.c_area } }).catch((e) => ({ error: e.message }));
  const items = await listings({ ids: st.cart.map((l) => l.id).join(','), limit: 50 });
  const byId = new Map(items.map((l) => [l.id, l])), collect = c.method === 'collect';
  const fld = (id, label, type, extra) => `<div class="fld"><label for="${id}">${label}</label><input id="${id}" type="${type || 'text'}" value="${esc(v[id] || '')}" ${extra || ''}></div>`;
  const sumHtml = quote.error ? `<div class="err">${esc(quote.error)}</div>` : quote.sellers.map((s) => `<div class="sum sm"><span>${esc(s.name)}</span><span>${R(s.subtotalCents)}</span></div>`).join('')
    + `<div class="sum" style="border-top:1px solid var(--line);margin-top:8px;padding-top:10px"><span>Subtotal</span><span>${R(quote.subtotalCents)}</span></div><div class="sum"><span>${collect ? 'Collection' : 'Delivery (arranged by the sellers)'}</span><span>${quote.deliveryCents ? R(quote.deliveryCents) : (!collect && quote.sellers.some((s) => s.arranged) ? 'Arranged with seller' : 'Free')}</span></div><div class="sum t"><span>Total</span><span>${R(quote.totalCents)}</span></div>`;
  return { title: 'Checkout | MzansiConnect', html: `<div class="w"><div class="crumbs"><a data-link href="/cart">Cart</a><span>/</span>Checkout</div><h1 style="margin-bottom:14px">Checkout</h1>${st.err.length ? `<div class="err" role="alert"><b>Please fix the following:</b><ul style="margin:6px 0 0 18px;padding:0">${st.err.map((e) => `<li>${esc(e)}</li>`).join('')}</ul></div>` : ''}`
   + `<form id="coform" novalidate><div class="two"><div><div class="panel"><h2>Your details</h2><div class="f2">${fld('c_name', 'Full name', 'text', 'autocomplete="name"')}${fld('c_phone', 'Mobile number', 'tel', 'autocomplete="tel" placeholder="082 123 4567"')}</div>`
   + `<div class="fld"><label for="c_area">Village or area</label><select id="c_area" data-chg="carea">${areaOpts(v.c_area)}</select></div>`
   + `<div class="fld"><label for="c_dir">Directions to your home</label><textarea id="c_dir" rows="2" maxlength="300" placeholder="For example: next to the clinic, blue gate, opposite the spaza shop">${esc(v.c_dir || '')}</textarea></div>${fld('c_stand', 'Stand or house number (optional)', 'text', 'maxlength="40"')}<p class="mute sm" style="margin:0">Limpopo, Greater Giyani Municipality.</p></div>`
   + `<div class="panel"><h2>Delivery or collection</h2><label class="opt${!collect ? ' on' : ''}"><input type="radio" name="dm" data-chg="method" value="deliver"${!collect ? ' checked' : ''}><span><b>Sellers deliver to you</b><br><span class="mute sm">Each seller arranges delivery: R30 in the same village, R60 to other villages, free over R800 per seller. Livestock delivery is agreed with the seller.</span></span></label>`
   + `<label class="opt${collect ? ' on' : ''}"><input type="radio" name="dm" data-chg="method" value="collect"${collect ? ' checked' : ''}><span><b>I will collect</b><br><span class="mute sm">Collect from each seller. No delivery fee. The seller phones you with the pickup spot.</span></span></label></div>`
   + `<div class="panel"><h2>Payment</h2>${[['cash', collect ? 'Cash on collection' : 'Cash on delivery', 'Pay the seller when you receive your order'], ['eft', 'Instant EFT', 'Pay from your bank account or eWallet'], ['card', 'Debit or credit card', 'Pay securely online']].map((o) => `<label class="opt${c.pay === o[0] ? ' on' : ''}"><input type="radio" name="pm" data-chg="pay" value="${o[0]}"${c.pay === o[0] ? ' checked' : ''}><span><b>${o[1]}</b><br><span class="mute sm">${o[2]}</span></span></label>`).join('')}</div></div>`
   + `<div class="panel"><h2>Order summary</h2>${st.cart.map((l) => { const x = byId.get(l.id); return x ? `<div class="sum sm"><span>${l.qty} × ${esc(x.title)}</span><span>${R(x.priceCents * l.qty)}</span></div>` : ''; }).join('')}${sumHtml}<button class="btn w100" type="submit" style="margin-top:12px"${quote.error ? ' disabled' : ''}>Place order</button></div></div></form></div>` };
};

const orderCard = (o, opts = {}) => {
  const state = o.state === 'cancelled' ? 'Cancelled' : (o.state === 'pending_payment' ? 'Waiting for payment' : null);
  const parts = o.sellers.map((s) => `<div class="row between wrapx sm"><span><b>${esc(s.name)}</b>, ${esc(s.village)}${s.phone ? ` · phone <b>${esc(s.phone)}</b>` : ''}</span>${badge(state || s.status)}</div>`).join('');
  const cancellable = o.state !== 'cancelled' && o.sellers.every((s) => s.status === 'Processing');
  return `<div class="panel ordercard"><div class="row between wrapx"><div><b>${o.code}</b> <span class="mute sm">· ${when(o.createdAt)}</span></div>${state ? badge(state) : ''}</div>`
   + o.items.map((i) => `<div class="sum sm"><span>${i.qty} × <a data-link href="/product/${i.listingId}">${esc(i.title)}</a></span><span>${R(i.unitPriceCents * i.qty)}</span></div>`).join('')
   + `<div class="sum"><span>${o.method === 'collect' ? 'Collection' : 'Delivery'}</span><span>${o.deliveryCents ? R(o.deliveryCents) : 'Free or arranged'}</span></div><div class="sum t"><span>Total (${{ cash: o.method === 'collect' ? 'cash on collection' : 'cash on delivery', eft: 'EFT', card: 'card' }[o.pay]})</span><span>${R(o.totalCents)}</span></div>`
   + `<div class="parts">${parts}</div>${o.paymentStatus === 'refund_pending' ? '<div class="note" style="margin-top:10px">Your payment will be refunded.</div>' : ''}`
   + `<div class="row-actions" style="margin-top:10px">${o.state === 'pending_payment' && o.pay !== 'cash' ? `<button class="btn sm" data-act="payorder" data-id="${o.id}">Pay now</button>` : ''}${cancellable ? `<button class="btn o sm" data-act="cancelorder" data-id="${o.id}">Cancel order</button>` : ''}${opts.link ? `<a class="btn o sm" data-link href="/order/${o.id}">View</a>` : ''}</div></div>`;
};
views.order = async (id) => {
  if (!st.user) return needLogin('/order/' + id, 'Log in to see your order.');
  const o = (await api('/orders')).find((x) => x.id === Number(id));
  if (!o) return views.notfound();
  const fresh = new URLSearchParams(location.search).get('new');
  return { title: `Order ${o.code} | MzansiConnect`, html: `<div class="w" style="max-width:720px">${fresh ? `<div class="panel" style="margin:12px 0"><div class="badge g">Order received</div><h1 style="margin:10px 0 6px">Thank you for your order</h1><p class="mute" style="margin:0">Your order number is <b style="color:var(--ink)">${o.code}</b>. The ${o.sellers.length > 1 ? 'sellers' : 'seller'} will phone you on the number you gave to arrange ${o.method === 'collect' ? 'collection' : 'delivery'}.</p></div>` : `<h1 style="margin:12px 0">Order ${o.code}</h1>`}${orderCard(o)}<div class="row wrapx" style="margin-top:16px"><a class="btn" data-link href="/my-orders">All my orders</a><a class="btn o" data-link href="/">Continue shopping</a></div></div>` };
};
views['my-orders'] = async () => {
  if (!st.user) return needLogin('/my-orders', 'Log in to see your orders and requests.');
  const [orders, reqs] = await Promise.all([api('/orders'), api('/requests')]);
  return { title: 'My orders | MzansiConnect', html: `<div class="w"><h1 style="margin-bottom:14px">My orders</h1>${orders.length ? orders.map((o) => orderCard(o, { link: true })).join('') : '<div class="empty" style="padding:20px 0"><p>You have not placed any orders yet.</p><a class="btn" data-link href="/">Start shopping</a></div>'}`
   + (reqs.length ? `<h2 style="margin:28px 0 12px">Service requests</h2>${reqs.map((r) => `<div class="panel"><div class="row between wrapx"><div><b>${r.code}</b> <span class="mute sm">· ${esc(r.title)}</span></div>${badge(r.status)}</div><div class="mute sm" style="margin-top:6px">${esc(r.area)} · ${esc(r.date)}</div><div class="sm" style="margin-top:6px">${esc(r.seller.name)}, ${esc(r.seller.village)} · phone <b>${esc(r.seller.phone || '')}</b></div></div>`).join('')}` : '') + '</div>' };
};
views.saved = async () => {
  const items = st.wish.length ? await listings({ ids: st.wish.join(','), limit: 50 }) : [];
  return { title: 'Saved items | MzansiConnect', html: `<div class="w"><h1 style="margin-bottom:14px">Saved items</h1>${items.length ? `<div class="grid">${items.map(card).join('')}</div>` : '<div class="empty">Nothing saved yet. Tap the heart on a product to save it.</div>'}</div>` };
};
views.login = async () => {
  const q = new URLSearchParams(location.search), reg = q.get('mode') === 'register', seller = (st.authRole || q.get('role') || 'buyer') === 'seller';
  const note = st.loginNote; st.loginNote = ''; const av = st.authv || {}; // keep what was typed after an error (never the password)
  return { title: `${reg ? 'Register' : 'Log in'} | MzansiConnect`, html: `<div class="w"><div class="panel auth"><h1 style="margin-bottom:6px">${reg ? 'Create your account' : 'Log in'}</h1><p class="mute" style="margin:0 0 14px">${seller ? 'List your products or services for buyers in Giyani and nearby villages.' : 'Order from sellers near you.'}</p>`
   + `${note ? `<div class="note">${esc(note)}</div>` : ''}${st.err.length ? `<div class="err" role="alert">${esc(st.err[0])}</div>` : ''}`
   + `<div class="seg"><button type="button" data-act="role" data-v="buyer" class="${!seller ? 'on' : ''}">I want to buy</button><button type="button" data-act="role" data-v="seller" class="${seller ? 'on' : ''}">I want to sell</button></div>`
   + `<form id="authform" data-mode="${reg ? 'register' : 'login'}" data-role="${seller ? 'seller' : 'buyer'}" novalidate>`
   + (reg ? `<div class="fld"><label for="a_name">Full name</label><input id="a_name" autocomplete="name" value="${esc(av.name)}"></div>` : '')
   + (reg && seller ? `<div class="fld"><label for="a_biz">Business or shop name</label><input id="a_biz" value="${esc(av.biz)}"></div><div class="fld"><label for="a_vil">Village or town</label><select id="a_vil">${areaOpts(av.vil || st.area)}</select></div>` : '')
   + (reg ? `<div class="fld"><label for="a_phone">Mobile number${seller ? '' : ' (optional)'}</label><input id="a_phone" type="tel" autocomplete="tel" placeholder="082 123 4567" value="${esc(av.phone)}"></div>` : '')
   + `<div class="fld"><label for="a_email">Email address</label><input id="a_email" type="email" autocomplete="email" value="${esc(av.email)}"></div><div class="fld"><label for="a_pw">Password${reg ? ' (at least 8 characters)' : ''}</label><input id="a_pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}"></div>`
   + `<button class="btn w100" type="submit">${reg ? 'Create account' : 'Log in'}</button></form>`
   + `<p class="sm" style="margin:14px 0 0;text-align:center">${reg ? `Already have an account? <a data-link href="/login${q.get('next') ? '?next=' + encodeURIComponent(q.get('next')) : ''}">Log in</a>` : `New to MzansiConnect? <a data-link href="/login?mode=register${seller ? '&role=seller' : ''}${q.get('next') ? '&next=' + encodeURIComponent(q.get('next')) : ''}">Register</a>`}</p>${st.meta.demo ? '<p class="mute sm" style="margin:10px 0 0;text-align:center">Preview demo logins: tsakani@demo.test (buyer) or chauke@demo.test (seller). Password: password123</p>' : ''}</div></div>` };
};
views.sell = async () => ({ title: 'Sell on MzansiConnect', html: '<div class="w"><div class="banner"><div><h1>Sell on MzansiConnect</h1><p>Farmers, traders and service providers in Giyani and the villages around it can list for free. Sell firewood, livestock and produce, or offer tractor, water and transport services.</p><a class="btn" data-link href="/login?mode=register&role=seller">Register as a seller</a></div></div>'
  + '<section class="sec"><h2 style="margin-bottom:14px">How it works</h2><div class="steps"><div class="step"><b>1. Register your shop</b><span class="mute">Add your business name, village and phone number. It takes about two minutes.</span></div><div class="step"><b>2. List what you offer</b><span class="mute">Add a product with its price and stock, or a service with its price per hectare, trip or day. Add a photo.</span></div><div class="step"><b>3. Get orders and requests</b><span class="mute">Buyers near you see your listing first. When an order or request comes in, you phone the buyer and arrange delivery or the job.</span></div></div></section>'
  + '<section class="sec"><div class="trust"><div><b>Free to list</b><span class="mute sm">No monthly fee to start</span></div><div><b>You arrange delivery</b><span class="mute sm">R30 in your village, R60 to others, free over R800</span></div><div><b>Goods and services</b><span class="mute sm">Products, livestock, tractor work, water and transport</span></div><div><b>Easy to manage</b><span class="mute sm">Listings, orders and requests in one place</span></div></div></section></div>' });

views.dashboard = async () => {
  if (!st.user) return needLogin('/dashboard', 'Log in with your seller account.');
  if (st.user.role !== 'seller') return { title: 'My shop', html: '<div class="w"><div class="panel auth"><h1>Seller account needed</h1><p class="mute">You are logged in as a buyer. Register a seller account to list products and services.</p><a class="btn" data-link href="/login?mode=register&role=seller">Register as a seller</a></div></div>' };
  const tab = new URLSearchParams(location.search).get('tab') || 'listings';
  const [mine, orders, reqs] = await Promise.all([api('/seller/listings'), api('/seller/orders'), api('/seller/requests')]);
  const toPack = orders.filter((o) => o.state === 'placed' && o.sellers[0].status === 'Processing').length, newReq = reqs.filter((r) => r.status === 'New').length;
  const NEXT = { Processing: 'Packed', Packed: 'Shipped', Shipped: 'Delivered' };
  let body = '';
  if (tab === 'listings') body = `<div class="row between wrapx" style="margin-bottom:10px"><h2>Your listings (${mine.length})</h2><a class="btn sm" data-link href="/dashboard?tab=add">Add a listing</a></div>${mine.length ? `<div class="tblwrap"><table class="tbl"><thead><tr><th>Listing</th><th>Price (R)</th><th>Stock</th><th></th></tr></thead><tbody>${mine.map((l) => `<tr><td><div class="row"><div class="thumb">${pic(l)}</div><a data-link href="/product/${l.id}">${esc(l.title)}</a></div><div class="mute sm">${l.type === 'service' ? 'Service, per ' + esc(l.unit) : 'Product'}</div></td><td><div class="inl"><input id="lp${l.id}" type="number" min="1" step="0.01" value="${l.priceCents / 100}" aria-label="Price in rand"></div></td><td>${l.type === 'service' ? '-' : `<div class="inl"><input id="ls${l.id}" type="number" min="0" step="1" value="${l.stock}" aria-label="Stock"></div>`}</td><td><div class="row-actions"><button class="btn sm" data-act="savelisting" data-id="${l.id}">Save</button><button class="btn o sm" data-act="dellisting" data-id="${l.id}">Remove</button></div></td></tr>`).join('')}</tbody></table></div>` : '<div class="empty"><p>You have no listings yet.</p><a class="btn" data-link href="/dashboard?tab=add">Add your first listing</a></div>'}`;
  if (tab === 'orders') body = `<h2 style="margin-bottom:10px">Orders</h2>${orders.length ? orders.map((o) => { const p = o.sellers[0], nxt = NEXT[p.status];
    return `<div class="panel"><div class="row between wrapx"><div><b>${o.code}</b> <span class="mute sm">· ${when(o.createdAt)}</span></div>${badge(o.state === 'cancelled' ? 'Cancelled' : p.status)}</div>${o.items.map((i) => `<div class="sum sm"><span>${i.qty} × ${esc(i.title)}</span><span>${R(i.unitPriceCents * i.qty)}</span></div>`).join('')}<div class="sum"><span>${o.method === 'collect' ? 'Collection' : 'Your delivery fee'}</span><span>${o.deliveryCents ? R(o.deliveryCents) : 'Free or arranged'}</span></div><div class="sum t"><span>Your total (${{ cash: 'cash', eft: 'EFT, paid', card: 'card, paid' }[o.pay]})</span><span>${R(o.totalCents)}</span></div>`
     + `<div class="info2"><b>${esc(o.buyer.name)}</b> · phone <b>${esc(o.buyer.phone)}</b><br>${o.method === 'collect' ? 'Buyer will collect.' : `${esc(o.buyer.area)}. ${esc(o.buyer.directions)}${o.buyer.stand ? ` (stand ${esc(o.buyer.stand)})` : ''}`}</div>${nxt && o.state === 'placed' ? `<div class="row-actions" style="margin-top:10px"><button class="btn sm" data-act="orderstep" data-id="${o.id}" data-to="${nxt}">Mark as ${nxt.toLowerCase()}</button></div>` : ''}</div>`; }).join('') : '<div class="empty">No orders yet. They appear here when buyers order your products.</div>'}`;
  if (tab === 'requests') body = `<h2 style="margin-bottom:10px">Service requests</h2>${reqs.length ? reqs.map((r) => `<div class="panel"><div class="row between wrapx"><div><b>${r.code}</b> <span class="mute sm">· ${esc(r.title)}</span></div>${badge(r.status)}</div><div class="info2"><b>${esc(r.buyer.name)}</b> · phone <b>${esc(r.buyer.phone)}</b><br>${esc(r.area)} · ${esc(r.date)}${r.details ? `<br>${esc(r.details)}` : ''}</div>`
    + `<div class="row-actions" style="margin-top:10px">${{ New: '<button class="btn sm" data-act="reqstep" data-id="__ID__" data-to="Confirmed">Confirm</button><button class="btn o sm" data-act="reqstep" data-id="__ID__" data-to="Declined">Decline</button>', Confirmed: '<button class="btn sm" data-act="reqstep" data-id="__ID__" data-to="Completed">Mark completed</button><button class="btn o sm" data-act="reqstep" data-id="__ID__" data-to="Declined">Decline</button>' }[r.status]?.replaceAll('__ID__', r.id) || ''}</div></div>`).join('') : '<div class="empty">No requests yet. They appear here when buyers request your services.</div>'}`;
  if (tab === 'add') { const av = st.addv || {}, dd = av.dept || 'fuel', dp = DEPT(dd);
    body = `<h2 style="margin-bottom:10px">Add a listing</h2>${st.err.length ? `<div class="err" role="alert">${st.err.map(esc).join('<br>')}</div>` : ''}<form class="panel" id="addform" style="max-width:640px" novalidate><div class="fld"><label for="p_title">Title</label><input id="p_title" value="${esc(av.title || '')}" maxlength="90" placeholder="For example: Ploughing with tractor"></div>`
     + `<div class="f2"><div class="fld"><label for="p_dept">Department</label><select id="p_dept" data-chg="pdept">${st.meta.depts.map((d) => `<option value="${d.id}"${dd === d.id ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}</select></div><div class="fld"><label for="p_sub">Category</label><select id="p_sub">${dp.subs.map((x) => `<option>${esc(x)}</option>`).join('')}</select></div></div>`
     + `<div class="f2"><div class="fld"><label for="p_price">${dp.svc ? 'Price from (R)' : 'Selling price (R)'}</label><input id="p_price" type="number" min="1" step="0.01" inputmode="decimal" value="${esc(av.price || '')}"></div>${dp.svc ? `<div class="fld"><label for="p_unit">Charged per</label><select id="p_unit">${st.meta.units.map((x) => `<option>${esc(x)}</option>`).join('')}</select></div>` : `<div class="fld"><label for="p_stock">Stock available</label><input id="p_stock" type="number" min="1" step="1" inputmode="numeric" value="${esc(av.stock || '')}"></div>`}</div>`
     + `<div class="fld"><label for="p_desc">Description</label><textarea id="p_desc" rows="4" maxlength="600">${esc(av.desc || '')}</textarea></div><div class="fld"><label for="p_photo">Photo (recommended)</label><input id="p_photo" type="file" accept="image/*"><span class="mute sm">A clear photo helps buyers trust your listing. It is resized automatically to save data.</span><img id="pp" class="photo-preview" alt="" hidden></div>`
     + `<p class="mute sm">Your listing will show "Sold from ${esc(st.user.seller.village)}".</p><button class="btn" type="submit">Publish listing</button></form>`; }
  return { title: 'My shop | MzansiConnect', html: `<div class="w"><div class="row between wrapx"><div><h1>My shop</h1><div class="mute">${esc(st.user.seller.name)} · ${esc(st.user.seller.village)}</div></div><a class="btn o" data-link href="/">View the shop</a></div>`
   + `<div class="stat"><div><b>${mine.length}</b><span class="mute sm">Active listings</span></div><div><b>${toPack}</b><span class="mute sm">Orders to pack</span></div><div><b>${newReq}</b><span class="mute sm">New service requests</span></div></div>`
   + `<div class="tabs">${[['listings', 'Listings'], ['orders', 'Orders' + (toPack ? ` (${toPack})` : '')], ['requests', 'Requests' + (newReq ? ` (${newReq})` : '')], ['add', 'Add listing']].map((t) => `<a data-link href="/dashboard?tab=${t[0]}" class="${tab === t[0] ? 'on' : ''}" style="flex:none;padding:11px 16px;font-weight:600;color:${tab === t[0] ? 'var(--brand)' : 'var(--mute)'};border-bottom:3px solid ${tab === t[0] ? 'var(--brand)' : 'transparent'}">${t[1]}</a>`).join('')}</div>${body}</div>` };
};

const contactBlock = () => { const c = st.meta.contact || {}; const parts = [c.email && `email <b>${esc(c.email)}</b>`, c.phone && `phone <b>${esc(c.phone)}</b>`].filter(Boolean); return parts.length ? `<p>Contact the MzansiConnect team: ${parts.join(' or ')}.</p>` : (st.meta.demo ? '<p class="mute">Contact details will be shown here when the site launches.</p>' : ''); };
const draftNote = () => st.meta.demo ? '<div class="note">Draft text for the preview. It will be checked before launch.</div>' : '';
const doc = (title, body) => ({ title: `${title} | MzansiConnect`, html: `<div class="w" style="max-width:760px"><div class="crumbs"><a data-link href="/">Home</a><span>/</span>${esc(title)}</div><h1 style="margin-bottom:12px">${esc(title)}</h1>${draftNote()}<div class="doc">${body}</div></div>` });
views.help = async () => doc('Help', `
<h2>Buying</h2><p>Find what you need, add products to your cart and check out. For tractor, water and transport services, send a request instead. The provider phones you to agree the date and the final price.</p>
<h2>Delivery and collection</h2><p>Sellers arrange delivery themselves. A seller charges R30 to deliver within their own village and R60 to other villages, and delivers free when your order from that seller is over R800. Livestock delivery is agreed directly with the seller. You can also choose to collect, which costs nothing.</p>
<h2>Paying</h2><p>Choose cash on delivery or collection, instant EFT, or card. Cash is paid to the seller when you receive your order. Card and EFT are paid online before the seller starts.</p>
<h2>Phone numbers</h2><p>After you order, you see each seller's phone number, and each seller sees yours, so you can arrange delivery. Phone numbers are never shown on the public listings.</p>
<h2>Selling</h2><p>Registering as a seller and listing are free. Add your products or services with a price and a photo. When an order or request comes in, phone the buyer and arrange delivery or the job, then update the status in your dashboard.</p>
<h2>Something went wrong with an order?</h2><p>First phone the seller. You can cancel an order yourself until the seller starts packing it.</p>${contactBlock()}`);
views.terms = async () => doc('Terms of use', `
<p>MzansiConnect is a marketplace that connects buyers and sellers in Giyani and the villages around it. The sale is between the buyer and the seller. MzansiConnect does not own, store or deliver the goods and does not provide the services listed.</p>
<h2>Sellers</h2><p>You must be the lawful owner of what you sell, or be allowed to sell it. You are responsible for the accuracy of your listings, the quality and safety of your goods and services, delivery, and following the law. For livestock this includes ownership, health and animal movement rules. Stolen or unlawfully obtained goods are not allowed, and listings may be removed and reported.</p>
<h2>Buyers</h2><p>Give correct contact details and directions, and be available to receive or collect your order. Cash orders are paid to the seller on delivery or collection.</p>
<h2>Payments and cancellations</h2><p>Card and EFT payments are handled by our payment provider. You can cancel an order until the seller starts packing it. Paid orders that are cancelled are refunded to you.</p>
<h2>Not allowed</h2><p>Illegal goods, stolen goods, false or misleading listings, harassment, and attempts to misuse the site or other people's accounts.</p>
<h2>Our role</h2><p>We may remove listings or accounts that break these terms. To the extent the law allows, MzansiConnect is not responsible for the conduct of buyers or sellers, or for goods and services we do not provide. Nothing here limits your rights under South African consumer law.</p>
<h2>Changes</h2><p>We may update these terms. Using the site after a change means you accept the new terms.</p>${contactBlock()}`);
views.privacy = async () => doc('Privacy policy', `
<p>We respect your privacy and handle personal information as the Protection of Personal Information Act (POPIA) requires.</p>
<h2>What we collect</h2><p>Your name, email address and phone number, your village and directions to your home when you order, your orders and service requests, and the listings and photos sellers upload. Your password is stored in a scrambled form that we cannot read.</p>
<h2>Why we collect it</h2><p>To run your account, show listings, process orders and payments, and let buyers and sellers arrange delivery and jobs.</p>
<h2>Who sees it</h2><p>A seller sees the name, phone number, village and directions of buyers for orders and requests they fulfil. A buyer sees the seller's business name, village and phone number. Nobody else sees your phone number. We do not sell your information or use it for advertising.</p>
<h2>Payments</h2><p>Card and EFT payments are handled by our payment provider. We do not see or store your card details.</p>
<h2>This site and your browser</h2><p>We store your login, cart, area and saved items on your own device so the site works. We do not use advertising or tracking cookies.</p>
<h2>How long we keep it</h2><p>We keep your information while your account is open and as long as we need to for orders and legal reasons.</p>
<h2>Your rights</h2><p>You can ask to see, correct or delete your personal information. You can also complain to the Information Regulator.</p>${contactBlock()}`);

views.notfound = async () => ({ title: 'Not found | MzansiConnect', html: '<div class="w"><div class="empty"><h1>Page not found</h1><p>The page you are looking for does not exist.</p><a class="btn" data-link href="/">Go to the home page</a></div></div>' });

/* ---------- router ---------- */
const ROUTES = [[/^\/$/, 'home'], [/^\/shop$/, 'shop'], [/^\/product\/(\d+)$/, 'product'], [/^\/cart$/, 'cart'], [/^\/checkout$/, 'checkout'], [/^\/order\/(\d+)$/, 'order'], [/^\/my-orders$/, 'my-orders'], [/^\/saved$/, 'saved'], [/^\/login$/, 'login'], [/^\/sell$/, 'sell'], [/^\/dashboard$/, 'dashboard'], [/^\/help$/, 'help'], [/^\/terms$/, 'terms'], [/^\/privacy$/, 'privacy']];
let navToken = 0;
async function show(keepScroll) {
  const my = ++navToken, main = $('#main'), y = scrollY;
  renderChrome();
  const hit = ROUTES.map(([re, name]) => [re.exec(location.pathname), name]).find(([m]) => m);
  if (!$('#main .w, #main .loading') || !keepScroll) main.innerHTML = '<div class="loading" role="status">Loading…</div>';
  try {
    const out = await (hit ? views[hit[1]](...hit[0].slice(1)) : views.notfound());
    if (my !== navToken) return; // a newer page was requested
    if (out.html === '') return; // view redirected
    main.innerHTML = out.html; document.title = out.title; main.focus({ preventScroll: true });
    afterRender(hit && hit[1]);
  } catch (e) {
    if (my !== navToken) return;
    main.innerHTML = `<div class="w"><div class="empty"><h2>We could not load this page</h2><p>${esc(e.message || 'Check your connection and try again.')}</p><button class="btn" data-act="reload">Try again</button></div></div>`;
  }
  if (keepScroll) scrollTo(0, y); else scrollTo(0, 0);
}
function go(url, replace) {
  if (url === location.pathname + location.search) return show(true);
  st.err = []; if (!url.startsWith('/login')) { st.authRole = null; st.authv = null; } // a new page starts clean
  history[replace ? 'replaceState' : 'pushState']({}, '', url); return show(false); }
const refresh = () => show(true);
function afterRender(name) {
  if (name === 'dashboard') { const f = $('#p_photo'); if (f) f.addEventListener('change', async () => { const file = f.files[0], pv = $('#pp'); if (!file) { pv.hidden = true; return; } try { const b64 = await resizeImage(file); pv.src = 'data:image/jpeg;base64,' + b64; pv.hidden = false; } catch (e) { toast(esc(e.message)); f.value = ''; } }); }
}
window.addEventListener('popstate', () => show(false));

/* ---------- actions ---------- */
let toastTimer;
function toast(html) { let t = $('#toast'); if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); } t.innerHTML = html; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3000); }
function addCart(id, qty) { const l = st.cart.find((x) => x.id === id); if (l) l.qty = Math.min(10, l.qty + qty); else st.cart.push({ id, qty }); saveCart(); renderChrome(); toast('Added to cart. <a data-link href="/cart" style="color:#8fe0b4;font-weight:700">View cart</a>'); }
function toggleWish(id) { st.wish = st.wish.includes(id) ? st.wish.filter((x) => x !== id) : [...st.wish, id]; ls.set('mc_wish', st.wish); refresh(); }
function resizeImage(file, maxDim = 1000) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return reject(new Error('Choose a JPEG, PNG or WebP photo.'));
    const img = new Image(), url = URL.createObjectURL(file);
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('That photo could not be read.')); };
    img.onload = () => {
      URL.revokeObjectURL(url);
      const k = Math.min(1, maxDim / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      for (const q of [0.82, 0.65, 0.5]) { const b64 = c.toDataURL('image/jpeg', q).split(',')[1]; if (b64.length * 0.75 < 780 * 1024) return resolve(b64); }
      reject(new Error('That photo is too large. Try a smaller one.'));
    };
    img.src = url;
  });
}
function payModal(order) {
  return new Promise(async (resolve) => {
    let url;
    try { url = (await api(`/orders/${order.id}/pay`, { method: 'POST' })).checkoutUrl; } catch (e) { toast(esc(e.message)); return resolve('error'); }
    const m = document.createElement('div'); m.className = 'modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-label', 'Pay for your order');
    m.innerHTML = `<div class="box"><div class="row between"><h2>Pay ${R(order.totalCents)}</h2><button class="btn o sm" data-close>Close</button></div><p class="mute sm" style="margin:6px 0">Order ${order.code}</p><iframe title="Payment" src="${esc(new URL(url, location.origin).pathname + new URL(url, location.origin).search)}"></iframe><p class="mute sm" id="paystat" role="status"></p></div>`;
    document.body.appendChild(m);
    let done = false;
    const finish = (r) => { if (done) return; done = true; window.removeEventListener('message', onMsg); m.remove(); resolve(r); };
    async function onMsg(e) {
      if (e.origin !== location.origin || e.data !== 'completed') return;
      $('#paystat', m).textContent = 'Confirming your payment…';
      for (let i = 0; i < 20 && !done; i++) {
        await new Promise((r) => setTimeout(r, 2000));
        const o = (await api('/orders').catch(() => [])).find((x) => x.id === order.id);
        if (o && o.state === 'placed') return finish('paid');
      }
      if (!done) $('#paystat', m).textContent = 'We are still waiting for confirmation. Check My orders in a moment.';
    }
    window.addEventListener('message', onMsg);
    m.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) finish('closed'); });
  });
}
const num = (s) => Number(String(s).replace(',', '.'));
async function act(a, d) {
  switch (a) {
    case 'logout': logout(); break;
    case 'wish': toggleWish(Number(d.id)); break;
    case 'addcart': addCart(Number(d.id), 1); break;
    case 'addcart2': addCart(Number(d.id), Number($('#qty')?.value || 1)); break;
    case 'remove': st.cart = st.cart.filter((x) => x.id !== Number(d.id)); saveCart(); renderChrome(); refresh(); break;
    case 'reload': refresh(); break;
    case 'role': st.authRole = d.v; refresh(); break;
    case 'payorder': { const o = (await api('/orders')).find((x) => x.id === Number(d.id)); const r = await payModal(o); if (r === 'paid') toast('Payment received. Thank you!'); refresh(); break; }
    case 'cancelorder': { if (!confirm('Cancel this order?')) break; try { await api(`/orders/${d.id}/cancel`, { method: 'POST' }); toast('Order cancelled'); } catch (e) { toast(esc(e.message)); } refresh(); break; }
    case 'orderstep': try { await api(`/seller/orders/${d.id}/status`, { method: 'POST', body: { status: d.to } }); toast(`Order marked ${d.to.toLowerCase()}`); } catch (e) { toast(esc(e.message)); } refresh(); break;
    case 'reqstep': try { await api(`/seller/requests/${d.id}/status`, { method: 'POST', body: { status: d.to } }); toast(`Request ${d.to.toLowerCase()}`); } catch (e) { toast(esc(e.message)); } refresh(); break;
    case 'savelisting': { const price = num($('#lp' + d.id).value), sEl = $('#ls' + d.id); try { await api('/seller/listings/' + d.id, { method: 'PATCH', body: { price, ...(sEl ? { stock: Number(sEl.value) } : {}) } }); toast('Saved'); } catch (e) { toast(esc(e.message)); } break; }
    case 'dellisting': { if (!confirm('Remove this listing from the shop?')) break; try { await api('/seller/listings/' + d.id, { method: 'DELETE' }); toast('Listing removed'); } catch (e) { toast(esc(e.message)); } refresh(); break; }
  }
}
document.addEventListener('click', (e) => {
  const link = e.target.closest('a[data-link]');
  if (link && !e.defaultPrevented && !e.metaKey && !e.ctrlKey && !e.shiftKey && e.button === 0) { e.preventDefault(); go(link.getAttribute('href')); return; }
  const b = e.target.closest('[data-act]');
  if (b) { e.preventDefault(); act(b.dataset.act, b.dataset).catch((err) => toast(esc(err.message || 'Something went wrong'))); }
});
document.addEventListener('change', (e) => {
  const t = e.target, c = t.dataset && t.dataset.chg; if (!c) return;
  const q = new URLSearchParams(location.search);
  const to = (k, v) => { if (v === '' || v == null || v === 'any' || v === '0') q.delete(k); else q.set(k, v); };
  if (c === 'area') { st.area = t.value; ls.set('mc_area', st.area); refresh(); return; }
  if (c === 'price') to('price', t.value); else if (c === 'rating') to('rating', t.value); else if (c === 'sort') to('sort', t.value);
  else if (c === 'vill') { const cur = (q.get('v') || '').split(',').filter(Boolean); const next = t.checked ? [...cur, t.value] : cur.filter((x) => x !== t.value); to('v', next.join(',')); }
  else if (c === 'cartqty') { const l = st.cart.find((x) => x.id === Number(t.dataset.id)); if (l) { l.qty = Number(t.value); saveCart(); renderChrome(); refresh(); } return; }
  else if (c === 'method' || c === 'pay' || c === 'carea') { stashCo(); if (c === 'method') st.co.method = t.value; if (c === 'pay') st.co.pay = t.value; if (c === 'carea') st.coVals.c_area = t.value; refresh(); return; }
  else if (c === 'pdept') { st.addv = { ...readAdd(), dept: t.value }; refresh(); return; }
  go(location.pathname + (q.toString() ? '?' + q : ''));
});
const stashCo = () => { const v = st.coVals = st.coVals || {}; for (const id of ['c_name', 'c_phone', 'c_area', 'c_dir', 'c_stand']) { const el = $('#' + id); if (el) v[id] = el.value; } };
const readAdd = () => ({ title: $('#p_title')?.value, dept: $('#p_dept')?.value, price: $('#p_price')?.value, stock: $('#p_stock')?.value, desc: $('#p_desc')?.value });

document.addEventListener('submit', async (e) => {
  const f = e.target; e.preventDefault();
  try {
    if (f.id === 'sf') { const p = new URLSearchParams(); if ($('#sd').value) p.set('dept', $('#sd').value); if ($('#sq').value.trim()) p.set('q', $('#sq').value.trim()); go('/shop' + (p.toString() ? '?' + p : '')); return; }
    if (f.id === 'authform') {
      const reg = f.dataset.mode === 'register', role = f.dataset.role, q = new URLSearchParams(location.search);
      const body = { email: $('#a_email').value, password: $('#a_pw').value, ...(reg ? { name: $('#a_name').value, role, phone: $('#a_phone').value, ...(role === 'seller' ? { business: $('#a_biz').value, village: $('#a_vil').value } : {}) } : {}) };
      try {
        const r = await api('/auth/' + (reg ? 'register' : 'login'), { method: 'POST', body });
        setSession(r.token, r.user); st.err = []; st.authv = null;
        const next = q.get('next');
        go(r.user.role === 'seller' && !next ? '/dashboard' : (next && next.startsWith('/') && !next.startsWith('//') ? next : '/'), true);
      } catch (err) { st.authv = { name: $('#a_name')?.value, email: $('#a_email').value, phone: $('#a_phone')?.value, biz: $('#a_biz')?.value, vil: $('#a_vil')?.value }; st.err = [err.message]; refresh(); }
      return;
    }
    if (f.id === 'reqform') {
      if (!st.user) { st.reqv = { name: $('#r_name').value, phone: $('#r_phone').value, area: $('#r_area').value, date: $('#r_date').value, details: $('#r_det').value }; return needLogin('/product/' + f.dataset.id, 'Log in or register to send a service request.'); }
      try {
        const r = await api('/requests', { method: 'POST', body: { listingId: Number(f.dataset.id), name: $('#r_name').value, phone: $('#r_phone').value, area: $('#r_area').value, date: $('#r_date').value, details: $('#r_det').value } });
        st.reqv = null; st.err = [];
        $('#req').innerHTML = `<div class="badge g">Request sent</div><h2 style="margin:10px 0 6px">${esc(r.code)}</h2><p class="mute" style="margin:0 0 12px">${esc(r.seller.name)} will phone you on ${esc($('#r_phone').value)} to confirm the date and the price. Their number is <b>${esc(r.seller.phone || '')}</b>.</p><div class="row wrapx"><a class="btn sm" data-link href="/my-orders">View my requests</a><a class="btn o sm" data-link href="/">Keep shopping</a></div>`;
      } catch (err) { st.err = [err.message]; st.reqv = { name: $('#r_name').value, phone: $('#r_phone').value, area: $('#r_area').value, date: $('#r_date').value, details: $('#r_det').value }; refresh(); }
      return;
    }
    if (f.id === 'coform') {
      stashCo(); const v = st.coVals;
      const body = { items: st.cart.map((l) => ({ listingId: l.id, qty: l.qty })), method: st.co.method, pay: st.co.pay, area: v.c_area, name: v.c_name, phone: v.c_phone, directions: v.c_dir || '', stand: v.c_stand || '' };
      let order;
      try { order = await api('/orders', { method: 'POST', body }); } catch (err) { st.err = [err.message]; refresh(); return; }
      st.err = []; st.cart = []; saveCart(); renderChrome();
      if (order.pay !== 'cash') { const r = await payModal(order); if (r === 'paid') toast('Payment received. Thank you!'); }
      go(`/order/${order.id}?new=1`); return;
    }
    if (f.id === 'addform') {
      const v = readAdd(), dp = DEPT(v.dept), sub = $('#p_sub').value, unit = $('#p_unit')?.value, file = $('#p_photo').files[0];
      const errs = [];
      if (!(v.title || '').trim()) errs.push('Enter a title.'); if (!(num(v.price) > 0)) errs.push('Enter a price greater than R0.'); if (!dp.svc && !(Number(v.stock) >= 1)) errs.push('Enter how many you have in stock.');
      if (errs.length) { st.addv = v; st.err = errs; refresh(); return; }
      let b64 = null; if (file) { try { b64 = await resizeImage(file); } catch (err) { st.addv = v; st.err = [err.message]; refresh(); return; } }
      const btn = $('button[type=submit]', f); btn.disabled = true; btn.textContent = 'Publishing…';
      try {
        const l = await api('/seller/listings', { method: 'POST', body: { title: v.title, dept: v.dept, sub, price: num(v.price), description: v.desc, ...(dp.svc ? { unit } : { stock: Number(v.stock) }) } });
        let note = ''; if (b64) { try { await api(`/seller/listings/${l.id}/photo`, { method: 'POST', body: { data: b64 } }); } catch { note = ' The photo could not be uploaded. Add it again later.'; } }
        st.addv = null; st.err = []; toast(`Published. It is now live in the shop.${note}`); go('/dashboard?tab=listings');
      } catch (err) { st.addv = v; st.err = [err.message]; refresh(); }
      return;
    }
  } catch (err) { toast(esc(err.message || 'Something went wrong')); }
});

/* ---------- start ---------- */
async function boot() {
  $('#root').innerHTML = '<div id="chrome"></div><main id="main" tabindex="-1"><div class="loading" role="status">Loading…</div></main><div id="foot"></div>';
  try { st.meta = await api('/meta'); } catch { $('#main').innerHTML = '<div class="w"><div class="empty"><h2>We could not reach MzansiConnect</h2><p>Check your connection and try again.</p><button class="btn" data-act="reload">Try again</button></div></div>'; return; }
  if (!st.meta.areas.includes(st.area)) st.area = st.meta.areas[0];
  if (st.token) { try { st.user = (await api('/me')).user; } catch { st.token = null; ls.del('mc_token'); } }
  await show(false);
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}
boot();
})();
