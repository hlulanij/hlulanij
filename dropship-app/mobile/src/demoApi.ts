// In-memory stand-in for the backend, used only when EXPO_PUBLIC_DEMO=1 (the browser preview).
// It mirrors the real API's routes and shapes so the real screens run unchanged.
const KM = (aLat: number, aLng: number, bLat: number, bLng: number) => {
  const r = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(r(bLat - aLat) / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(r(bLng - aLng) / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
};
const fail = (m: string): never => { throw new Error(m); };

const vendors: any[] = [
  { id: 1, name: 'Burger Joint', service: 'food', lat: -33.9249, lng: 18.4241, address: 'Cape Town CBD', rating: 4.7, owner: 'burgerjoint@demo.test' },
  { id: 2, name: 'Mama Africa Kitchen', service: 'food', lat: -33.9262, lng: 18.4189, address: 'Long Street', rating: 4.5, owner: 'mama@demo.test' },
  { id: 3, name: 'FreshMart', service: 'groceries', lat: -33.93, lng: 18.42, address: 'Cape Town CBD', rating: 4.4, owner: 'freshmart@demo.test' },
  { id: 4, name: 'CityCare Pharmacy', service: 'pharmacy', lat: -33.921, lng: 18.418, address: 'Cape Town CBD', rating: 4.8, owner: 'citycare@demo.test' },
  { id: 5, name: 'Cellar Door', service: 'liquor', lat: -33.927, lng: 18.429, address: 'Waterfront', rating: 4.6, owner: 'cellar@demo.test' },
  { id: 6, name: 'Gadget Hub', service: 'retail', lat: -33.93, lng: 18.42, address: 'Dropshipped, ships from supplier', rating: 4.3, owner: 'gadgethub@demo.test' },
];
const products: any[] = [];
let pid = 1;
const add = (vendor_id: number, name: string, price_cents: number) => products.push({ id: pid++, vendor_id, name, price_cents, available: 1 });
[['Classic Burger', 8900], ['Cheese Burger', 9900], ['Chips', 3200], ['Milkshake', 4500]].forEach(([n, p]) => add(1, n as string, p as number));
[['Chicken Stew & Pap', 7500], ['Bunny Chow', 6800], ['Malva Pudding', 3900]].forEach(([n, p]) => add(2, n as string, p as number));
[['Milk 2L', 3500], ['Bread', 1800], ['Eggs 18', 5200], ['Bananas 1kg', 2400]].forEach(([n, p]) => add(3, n as string, p as number));
[['Pain Relief', 5500], ['Vitamin C', 7900]].forEach(([n, p]) => add(4, n as string, p as number));
[['Red Wine 750ml', 12000], ['Craft Beer 6-pack', 14500]].forEach(([n, p]) => add(5, n as string, p as number));
[['Phone Stand', 19900], ['USB-C Cable', 14900], ['Earbuds', 34900]].forEach(([n, p]) => add(6, n as string, p as number));

type Order = any;
const orders: Order[] = [];
let oid = 1;
const owners: Record<string, number> = {};
vendors.forEach((v) => { owners[v.owner] = v.id; });
const extraUsers: Record<string, { role: string; name: string }> = {};

function who(token: string | null) {
  const email = (token || '').replace('demo:', '');
  if (!email) return fail('unauthorized');
  const role = email.startsWith('driver') ? 'driver' : email in owners || extraUsers[email]?.role === 'vendor' ? 'vendor' : 'customer';
  return { email, role: extraUsers[email]?.role || role };
}

function setStatus(o: Order, status: string) {
  o.status = status;
  o.events.push({ status, created_at: new Date().toISOString() });
  if (status === 'delivered' && o.payment_method === 'cash') o.payment_status = 'paid';
}
// Plays out the store and delivery side so the customer can watch tracking move.
function simulate(o: Order) {
  const step = (from: string, to: string, ms: number, then?: () => void) => setTimeout(() => {
    if (o.status === from) { setStatus(o, to); then?.(); }
  }, ms);
  step('placed', 'accepted', 3000, () => step('accepted', 'preparing', 4000, () => step('preparing', 'ready', 5000, () => {
    setTimeout(() => { // no human driver took it: a demo driver does
      if (o.status === 'ready' && !o.driver_id) { o.driver_id = 'demo'; step('ready', 'picked_up', 4000, () => step('picked_up', 'delivered', 6000)); }
    }, 8000);
  })));
}
function make(customer: string, v: any, items: any[], total: any, dropoff: any, method: string, status = 'placed'): Order {
  const o: Order = {
    id: oid++, kind: v ? 'store' : 'parcel', customer, vendor_id: v?.id ?? null, status, driver_id: null,
    pickup_address: v ? v.address : dropoff.pickup, dropoff_address: dropoff.address,
    pickup_lat: v?.lat ?? -33.9, pickup_lng: v?.lng ?? 18.42,
    ...total, payment_method: method, payment_status: method === 'cash' ? 'pending_cash' : 'awaiting_payment',
    items, events: [{ status, created_at: new Date().toISOString() }],
  };
  orders.push(o);
  return o;
}
const quoteOf = (subtotal: number, km: number, tip = 0) => {
  const delivery = 1500 + Math.round(km * 500), service = Math.round(subtotal * 0.05);
  return { subtotal_cents: subtotal, delivery_fee_cents: delivery, service_fee_cents: service, tip_cents: tip, total_cents: subtotal + delivery + service + tip, distance_km: Math.round(km * 10) / 10 };
};
const pub = (o: Order) => ({ ...o, driver_earnings_cents: Math.round((o.delivery_fee_cents + o.tip_cents) * 0.8) });

// A couple of orders so the vendor and driver screens are not empty on first look.
const sample = quoteOf(17800, 1.2);
make('sam@demo.test', vendors[0], [{ name: 'Classic Burger', qty: 2, unit_price_cents: 8900 }], sample, { address: '22 Bree Street' }, 'cash', 'placed');
const ready = make('lee@demo.test', vendors[1], [{ name: 'Bunny Chow', qty: 1, unit_price_cents: 6800 }], quoteOf(6800, 2.1), { address: '5 Loop Street' }, 'cash', 'ready');

export async function demoApi(method: string, path: string, body: any, token: string | null): Promise<any> {
  await new Promise((r) => setTimeout(r, 120)); // feels like a network
  const [route, qs = ''] = path.split('?');
  const q = new URLSearchParams(qs);
  const is = (m: string, re: RegExp) => method === m && re.test(route);
  const seg = route.split('/');

  if (is('POST', /^\/auth\/login$/)) {
    const email = String(body.email || '').toLowerCase();
    if (body.password !== 'password123') return fail('invalid credentials (demo password is password123)');
    const u = who('demo:' + email);
    return { token: 'demo:' + email, user: { id: 1, role: u.role, name: email.split('@')[0] } };
  }
  if (is('POST', /^\/auth\/register$/)) {
    const email = String(body.email || '').toLowerCase();
    extraUsers[email] = { role: body.role || 'customer', name: body.name };
    return { token: 'demo:' + email, user: { id: 2, role: body.role || 'customer', name: body.name } };
  }
  if (is('GET', /^\/vendors$/)) {
    return vendors.filter((v) => v.service === q.get('service')).map((v) => ({
      ...v, distance_km: Math.round(KM(+q.get('lat')!, +q.get('lng')!, v.lat, v.lng) * 10) / 10,
    }));
  }
  if (is('GET', /^\/vendors\/\d+$/)) {
    const v = vendors.find((x) => x.id === +seg[2]) || fail('not found');
    return { ...v, products: products.filter((p) => p.vendor_id === v.id) };
  }

  const me = who(token);
  const price = (b: any) => {
    const v = vendors.find((x) => x.id === b.vendor_id) || fail('vendor unavailable');
    let sub = 0;
    const items = (b.items || []).map((i: any) => {
      const p = products.find((x) => x.id === i.product_id && x.vendor_id === v.id) || fail('invalid item');
      sub += p.price_cents * i.qty;
      return { name: p.name, qty: i.qty, unit_price_cents: p.price_cents };
    });
    return { v, items, total: quoteOf(sub, KM(v.lat, v.lng, b.dropoff.lat, b.dropoff.lng), b.tip_cents || 0) };
  };

  if (is('POST', /^\/orders\/quote$/)) return price(body).total;
  if (is('POST', /^\/orders$/)) {
    if (body.vendor_id == null) {
      const total = quoteOf(0, KM(body.pickup.lat, body.pickup.lng, body.dropoff.lat, body.dropoff.lng));
      const o = make(me.email, null, [], total, { address: body.dropoff.address, pickup: body.pickup.address }, 'cash');
      return pub(o);
    }
    const { v, items, total } = price(body);
    const card = body.payment_method === 'card';
    const o = make(me.email, v, items, total, body.dropoff, body.payment_method || 'cash', card ? 'pending_payment' : 'placed');
    if (!card) simulate(o);
    return pub(o);
  }
  if (is('GET', /^\/orders$/)) return orders.filter((o) => o.customer === me.email).reverse().map(pub);
  if (is('GET', /^\/orders\/\d+$/)) return pub(orders.find((o) => o.id === +seg[2]) || fail('not found'));
  if (is('POST', /^\/orders\/\d+\/pay$/)) return { checkout_url: 'demo', amount: '0.00' };
  if (is('POST', /^\/demo\/pay\/\d+$/)) {
    const o = orders.find((x) => x.id === +seg[3]) || fail('not found');
    o.payment_status = 'paid';
    if (o.status === 'pending_payment') { setStatus(o, 'placed'); simulate(o); }
    return { ok: true };
  }
  if (is('POST', /^\/orders\/\d+\/rating$/)) return { ok: true };
  if (is('POST', /^\/orders\/\d+\/status$/)) {
    const o = orders.find((x) => x.id === +seg[2]) || fail('not found');
    const allowed: Record<string, string[]> = {
      pending_payment: ['cancelled'], placed: ['accepted', 'cancelled'], accepted: ['preparing', 'cancelled'],
      preparing: ['ready', 'cancelled'], ready: ['picked_up'], picked_up: ['delivered'],
    };
    if (!(allowed[o.status] || []).includes(body.status)) return fail(`cannot go from ${o.status} to ${body.status}`);
    if (body.status === 'cancelled') o.payment_status = o.payment_status === 'paid' ? 'refund_pending' : 'void';
    setStatus(o, body.status);
    return pub(o);
  }

  // vendor
  if (is('GET', /^\/vendor\/orders$/)) {
    const vid = owners[me.email];
    if (!vid) return fail('no store');
    return orders.filter((o) => o.vendor_id === vid && o.status !== 'pending_payment').reverse().map(pub);
  }
  if (is('POST', /^\/vendor\/store$/)) {
    const id = vendors.length + 1;
    vendors.push({ id, name: body.name, service: body.service, lat: body.lat, lng: body.lng, address: body.address, rating: null, owner: me.email });
    owners[me.email] = id;
    return { id };
  }
  if (is('POST', /^\/vendor\/products$/)) {
    const vid = owners[me.email] || fail('create a store first');
    if (body.fulfilment === 'dropship' && body.supplier_cost_cents > body.price_cents) return fail('price is below supplier cost');
    add(vid, body.name, body.price_cents);
    return products[products.length - 1];
  }

  // driver
  if (is('POST', /^\/driver\/location$/)) return { ok: true };
  if (is('GET', /^\/driver\/jobs$/)) {
    return orders.filter((o) => !o.driver_id && ((o.kind === 'store' && ['accepted', 'preparing', 'ready'].includes(o.status)) || (o.kind === 'parcel' && o.status === 'placed')))
      .map((o) => ({ ...pub(o), pickup_distance_km: Math.round(KM(-33.9249, 18.4241, o.pickup_lat, o.pickup_lng) * 10) / 10 }));
  }
  if (is('POST', /^\/driver\/jobs\/\d+\/claim$/)) {
    const o = orders.find((x) => x.id === +seg[3]) || fail('not found');
    if (o.driver_id) return fail('job no longer available');
    o.driver_id = me.email;
    return pub(o);
  }
  if (is('GET', /^\/driver\/active$/)) return orders.filter((o) => o.driver_id === me.email && !['delivered', 'cancelled'].includes(o.status)).map(pub);
  if (is('GET', /^\/driver\/earnings$/)) {
    const done = orders.filter((o) => o.driver_id === me.email && o.status === 'delivered');
    return { deliveries: done.length, earnings_cents: done.reduce((s, o) => s + Math.round((o.delivery_fee_cents + o.tip_cents) * 0.8), 0) };
  }
  return fail(`demo: unsupported ${method} ${route}`);
}
void ready;
