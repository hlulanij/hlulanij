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
  db.exec(`
CREATE TABLE IF NOT EXISTS m_users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  phone TEXT,
  role TEXT NOT NULL CHECK (role IN ('buyer','seller')),
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS m_sellers (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE REFERENCES m_users(id),
  name TEXT NOT NULL,
  village TEXT NOT NULL,
  phone TEXT,
  rating REAL NOT NULL DEFAULT 4.5,
  sales INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS m_listings (
  id INTEGER PRIMARY KEY,
  seller_id INTEGER NOT NULL REFERENCES m_sellers(id),
  dept TEXT NOT NULL,
  sub TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('good','service')),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price_cents INTEGER NOT NULL CHECK (price_cents > 0),
  unit TEXT NOT NULL DEFAULT '',
  stock INTEGER NOT NULL DEFAULT 0,
  note TEXT NOT NULL DEFAULT '',
  sold INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  photo_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS m_photos (
  id INTEGER PRIMARY KEY,
  mime TEXT NOT NULL,
  data BLOB NOT NULL
);
CREATE TABLE IF NOT EXISTS m_orders (
  id INTEGER PRIMARY KEY,
  buyer_id INTEGER NOT NULL REFERENCES m_users(id),
  state TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('deliver','collect')),
  pay TEXT NOT NULL CHECK (pay IN ('cash','eft','card')),
  payment_status TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL,
  directions TEXT NOT NULL DEFAULT '',
  stand TEXT NOT NULL DEFAULT '',
  subtotal_cents INTEGER NOT NULL,
  delivery_cents INTEGER NOT NULL,
  total_cents INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS m_order_items (
  id INTEGER PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES m_orders(id),
  listing_id INTEGER NOT NULL REFERENCES m_listings(id),
  seller_id INTEGER NOT NULL REFERENCES m_sellers(id),
  title TEXT NOT NULL,
  qty INTEGER NOT NULL CHECK (qty > 0),
  unit_price_cents INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS m_order_sellers (
  order_id INTEGER NOT NULL REFERENCES m_orders(id),
  seller_id INTEGER NOT NULL REFERENCES m_sellers(id),
  status TEXT NOT NULL DEFAULT 'Processing',
  delivery_cents INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (order_id, seller_id)
);
CREATE TABLE IF NOT EXISTS m_requests (
  id INTEGER PRIMARY KEY,
  listing_id INTEGER NOT NULL REFERENCES m_listings(id),
  seller_id INTEGER NOT NULL REFERENCES m_sellers(id),
  buyer_id INTEGER NOT NULL REFERENCES m_users(id),
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  area TEXT NOT NULL,
  date TEXT NOT NULL,
  details TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'New',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS m_listings_dept ON m_listings(dept, active);
CREATE INDEX IF NOT EXISTS m_orders_buyer ON m_orders(buyer_id);
CREATE INDEX IF NOT EXISTS m_items_seller ON m_order_items(seller_id);
`);
  const cols = db.prepare('PRAGMA table_info(orders)').all().map((c) => c.name);
  if (!cols.includes('payment_ref')) db.exec('ALTER TABLE orders ADD COLUMN payment_ref TEXT');
  return db;
}
