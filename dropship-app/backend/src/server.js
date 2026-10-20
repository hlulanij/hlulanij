import { openDb } from './db.js';
import { createApp } from './app.js';
import { seed } from './seed.js';

const prod = process.env.NODE_ENV === 'production';
if (prod && (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 32)) {
  throw new Error('JWT_SECRET must be set to a random value of 32+ characters in production');
}
const mock = !process.env.PEACH_CLIENT_ID && process.env.PAYMENT_PROVIDER !== 'peach';
if (prod && mock && process.env.ALLOW_MOCK_PAYMENTS !== '1') {
  throw new Error('No Peach credentials set. Configure Peach, or set ALLOW_MOCK_PAYMENTS=1 for a demo deployment (no real charges).');
}
const db = openDb(process.env.DB_PATH || './data.sqlite');
if (process.env.DEMO_SEED === '1') {
  seed(db); // public demo logins use a known password: never enable alongside real payments
  console.warn('DEMO_SEED=1: demo accounts created (password "password123"). Turn this off for real use.');
}
const payments = mock && prod ? (await import('./payments.js')).createMockProvider() : undefined;
const port = process.env.PORT || 3000;
createApp({ db, ...(payments && { payments }) }).listen(port, () => console.log(`API listening on :${port}`));
