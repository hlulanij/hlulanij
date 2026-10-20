import { DatabaseSync } from 'node:sqlite';

export function openDb(path = process.env.DB_PATH || ':memory:') {
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('customer','vendor','driver','admin')),
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS vendors (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  service TEXT NOT NULL,
  description TEXT,
  address TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  is_open INTEGER NOT NULL DEFAULT 1,
  rating_sum INTEGER NOT NULL DEFAULT 0,
  rating_count INTEGER NOT NULL DEFAULT 0
);
-- A product is either stocked by the vendor, or dropshipped: the vendor lists it
-- at a markup over supplier_cost and the supplier ships it on order.
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY,
  vendor_id INTEGER NOT NULL REFERENCES vendors(id),
  name TEXT NOT NULL,
  description TEXT,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  supplier_cost_cents INTEGER,
  fulfilment TEXT NOT NULL DEFAULT 'vendor' CHECK (fulfilment IN ('vendor','dropship')),
  available INTEGER NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('store','parcel')),
  customer_id INTEGER NOT NULL REFERENCES users(id),
  vendor_id INTEGER REFERENCES vendors(id),
  driver_id INTEGER REFERENCES users(id),
  status TEXT NOT NULL,
  pickup_address TEXT,
  pickup_lat REAL NOT NULL,
  pickup_lng REAL NOT NULL,
  dropoff_address TEXT NOT NULL,
  dropoff_lat REAL NOT NULL,
  dropoff_lng REAL NOT NULL,
  subtotal_cents INTEGER NOT NULL,
  delivery_fee_cents INTEGER NOT NULL,
  service_fee_cents INTEGER NOT NULL,
  tip_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL,
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  name TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS order_events (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  status TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS driver_locations (
  driver_id INTEGER PRIMARY KEY REFERENCES users(id),
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  online INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS ratings (
  order_id INTEGER PRIMARY KEY REFERENCES orders(id),
  vendor_stars INTEGER,
  driver_stars INTEGER,
  comment TEXT
);
`);
  return db;
}
