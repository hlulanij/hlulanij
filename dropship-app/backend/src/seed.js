import bcrypt from 'bcryptjs';
import { openDb } from './db.js';

// Demo data around Cape Town. Run: npm run seed (uses DB_PATH or ./data.sqlite)
const db = openDb(process.env.DB_PATH || './data.sqlite');
const pw = bcrypt.hashSync('password123', 10);
const user = (role, name, email) =>
  Number(db.prepare('INSERT OR IGNORE INTO users (role,name,email,password_hash) VALUES (?,?,?,?)').run(role, name, email, pw).lastInsertRowid)
  || db.prepare('SELECT id FROM users WHERE email = ?').get(email).id;

user('customer', 'Demo Customer', 'customer@demo.test');
user('driver', 'Demo Driver', 'driver@demo.test');

const stores = [
  ['food', 'Burger Joint', -33.9249, 18.4241, [['Classic Burger', 8900], ['Chips', 3200]]],
  ['groceries', 'FreshMart', -33.9300, 18.4200, [['Milk 2L', 3500], ['Bread', 1800]]],
  ['pharmacy', 'CityCare Pharmacy', -33.9210, 18.4180, [['Pain Relief', 5500]]],
  ['liquor', 'Cellar Door', -33.9270, 18.4290, [['Red Wine 750ml', 12000]]],
];
for (const [service, name, lat, lng, products] of stores) {
  const email = `${name.toLowerCase().replace(/\W+/g, '')}@demo.test`;
  const owner = user('vendor', `${name} Owner`, email);
  if (db.prepare('SELECT 1 FROM vendors WHERE owner_id = ?').get(owner)) continue;
  const vid = Number(db.prepare('INSERT INTO vendors (owner_id,name,service,address,lat,lng) VALUES (?,?,?,?,?,?)').run(owner, name, service, 'Cape Town CBD', lat, lng).lastInsertRowid);
  for (const [pname, price] of products) db.prepare('INSERT INTO products (vendor_id,name,price_cents) VALUES (?,?,?)').run(vid, pname, price);
}
// Dropship retail store: supplier ships, vendor keeps the margin.
const owner = user('vendor', 'Gadget Hub Owner', 'gadgethub@demo.test');
if (!db.prepare('SELECT 1 FROM vendors WHERE owner_id = ?').get(owner)) {
  const vid = Number(db.prepare('INSERT INTO vendors (owner_id,name,service,address,lat,lng) VALUES (?,?,?,?,?,?)').run(owner, 'Gadget Hub', 'retail', 'Online', -33.93, 18.42).lastInsertRowid);
  db.prepare("INSERT INTO products (vendor_id,name,price_cents,supplier_cost_cents,fulfilment) VALUES (?,?,?,?,'dropship')").run(vid, 'Phone Stand', 19900, 9000);
  db.prepare("INSERT INTO products (vendor_id,name,price_cents,supplier_cost_cents,fulfilment) VALUES (?,?,?,?,'dropship')").run(vid, 'USB-C Cable', 14900, 5000);
}
console.log('Seeded. Logins use password "password123": customer@demo.test, driver@demo.test, burgerjoint@demo.test, ...');
