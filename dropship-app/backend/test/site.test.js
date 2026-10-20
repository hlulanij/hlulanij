import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';
import { seedMarket } from '../src/marketSeed.js';

async function boot(opts = {}) {
  const db = openDb(':memory:'); seedMarket(db);
  const server = createApp({ db, secret: 't', ...opts }).listen(0);
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}
const html = { headers: { accept: 'text/html' } };

test('the website is served with strict security headers and works from direct links', async () => {
  const { server, base } = await boot({ demo: true });
  try {
    for (const path of ['/', '/help', '/terms', '/privacy', '/shop?dept=fuel', '/product/5', '/cart', '/checkout', '/my-orders', '/order/3', '/saved', '/login', '/sell', '/dashboard']) {
      const r = await fetch(base + path, html);
      assert.equal(r.status, 200, path);
      assert.match(await r.text(), /<div id="root">/);
      assert.match(r.headers.get('content-security-policy'), /default-src 'self'.*script-src 'self'/);
      assert.equal(r.headers.get('x-frame-options'), 'SAMEORIGIN');
    }
    const nf = await fetch(base + '/no-such-page', html);
    assert.equal(nf.status, 404); // browsers get the site's own "page not found"
    assert.match(await nf.text(), /<div id="root">/);
    assert.equal((await fetch(base + '/api/no-such-route', html)).status, 404); // API paths never fall back to the website
    assert.equal((await fetch(base + '/no-such-page', { headers: { accept: 'application/json' } })).status, 404);
    for (const f of ['app.js', 'styles.css', 'logo.svg', 'manifest.webmanifest', 'sw.js', 'icon-192.png', 'icon-512.png', 'icon-180.png']) assert.equal((await fetch(`${base}/${f}`)).status, 200, f);
    assert.equal((await (await fetch(base + '/api/meta')).json()).demo, true);
  } finally { server.close(); }
});

test('the site only loads its own scripts, and the page has no inline script to attack', () => {
  const index = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  assert.equal(/<script(?![^>]*\bsrc=)[^>]*>/.test(index), false);
  assert.equal(/https?:\/\//.test(index.replace(/<link rel="manifest"[^>]*>/, '').replace(/xmlns="[^"]*"/g, '')), false); // no third-party requests
  const manifest = JSON.parse(fs.readFileSync(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.display, 'standalone');
});

test('listings can be fetched by id for the cart and saved items', async () => {
  const { server, base } = await boot();
  try {
    const all = (await (await fetch(`${base}/api/listings?limit=3`)).json()).items;
    const ids = all.map((l) => l.id).join(',');
    const got = (await (await fetch(`${base}/api/listings?ids=${ids},999999,abc`)).json()).items;
    assert.deepEqual(got.map((l) => l.id).sort(), all.map((l) => l.id).sort());
    assert.equal((await (await fetch(`${base}/api/listings?ids=`)).json()).total, 0);
    assert.equal((await (await fetch(`${base}/api/meta`)).json()).demo, false);
  } finally { server.close(); }
});

test('contact details appear only when valid', async () => {
  const good = await boot({ contact: { email: 'help@example.com', phone: '082 123 4567' } });
  const bad = await boot({ contact: { email: '<script>', phone: 'call me' } });
  try {
    assert.deepEqual((await (await fetch(`${good.base}/api/meta`)).json()).contact, { email: 'help@example.com', phone: '082 123 4567' });
    assert.deepEqual((await (await fetch(`${bad.base}/api/meta`)).json()).contact, { email: '', phone: '' });
  } finally { good.server.close(); bad.server.close(); }
});
