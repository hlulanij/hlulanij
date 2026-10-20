import { openDb } from './db.js';
import { createApp } from './app.js';

if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET must be set in production');
}
const db = openDb(process.env.DB_PATH || './data.sqlite');
const port = process.env.PORT || 3000;
createApp({ db }).listen(port, () => console.log(`API listening on :${port}`));
