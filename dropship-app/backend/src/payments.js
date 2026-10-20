import crypto from 'node:crypto';

// Card payments. Providers share one interface so the order code never touches Peach directly:
//   createCheckout({ ref, amountCents, publicUrl }) -> { checkoutId, entityId, scriptUrl }
//   verifyWebhook(headers, rawBody)                 -> boolean
//   parseWebhook(rawBody)                           -> { ref, amountCents, currency, success }
//
// UNVERIFIED AGAINST PEACH'S LIVE DOCS (their docs were unreachable when this was written).
// Each assumption is tagged [VERIFY]. Run the sandbox flow in backend/README before going live.

const PEACH = {
  sandbox: {
    auth: 'https://sandbox-dashboard.peachpayments.com',
    checkout: 'https://testsecure.peachpayments.com',
    script: 'https://sandbox-checkout.peachpayments.com/js/checkout.js',
  },
  live: { // [VERIFY] live hosts are inferred from the sandbox naming
    auth: 'https://dashboard.peachpayments.com',
    checkout: 'https://secure.peachpayments.com',
    script: 'https://checkout.peachpayments.com/js/checkout.js',
  },
};

const SUCCESS_CODE = /^(000\.000\.|000\.100\.1|000\.[36])/; // [VERIFY] Peach result.code success family

export const toMoney = (cents) => (cents / 100).toFixed(2);

export function createPeachProvider({ env = process.env, fetchImpl = fetch } = {}) {
  const need = (k) => { if (!env[k]) throw new Error(`${k} is not set`); return env[k]; };
  const mode = env.PEACH_ENV === 'live' ? 'live' : 'sandbox';
  const urls = PEACH[mode];
  let cached = null; // { token, exp }

  async function accessToken() {
    if (cached && cached.exp > Date.now() + 30_000) return cached.token;
    const res = await fetchImpl(`${urls.auth}/api/oauth/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ clientId: need('PEACH_CLIENT_ID'), clientSecret: need('PEACH_CLIENT_SECRET'), merchantId: need('PEACH_MERCHANT_ID') }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.access_token) throw new Error(`Peach auth failed (${res.status})`);
    cached = { token: data.access_token, exp: Date.now() + (data.expires_in ?? 300) * 1000 };
    return cached.token;
  }

  return {
    name: 'peach',
    async createCheckout({ ref, amountCents, publicUrl }) {
      const entityId = need('PEACH_ENTITY_ID');
      const res = await fetchImpl(`${urls.checkout}/v2/checkout`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${await accessToken()}` },
        body: JSON.stringify({
          authentication: { entityId },
          amount: toMoney(amountCents),
          currency: 'ZAR',
          nonce: crypto.randomUUID(),
          merchantTransactionId: ref, // 8-16 chars per Peach's reference
          shopperResultUrl: `${publicUrl}/payments/return`,
          notificationUrl: `${publicUrl}/payments/peach/webhook`, // [VERIFY] field name
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.checkoutId) throw new Error(`Peach checkout failed (${res.status})`);
      return { checkoutId: data.checkoutId, entityId, scriptUrl: urls.script };
    },

    // HMAC-SHA256 with the dashboard-generated secret. Peach sends x-webhook-signature and
    // x-webhook-timestamp. [VERIFY] the exact string signed: assumed `${timestamp}.${rawBody}`.
    // Fails closed: if this guess is wrong every webhook is rejected, none is wrongly accepted.
    verifyWebhook(headers, rawBody) {
      const secret = env.PEACH_WEBHOOK_SECRET;
      const sig = headers['x-webhook-signature'];
      const ts = headers['x-webhook-timestamp'];
      if (!secret || !sig || !ts) return false;
      const age = Math.abs(Date.now() / 1000 - Number(ts));
      if (!Number.isFinite(age) || age > 300) return false; // replay window (assumes seconds)
      const expected = crypto.createHmac('sha256', secret).update(`${ts}.${rawBody}`).digest('hex');
      const a = Buffer.from(expected);
      const b = Buffer.from(String(sig).toLowerCase());
      return a.length === b.length && crypto.timingSafeEqual(a, b);
    },

    parseWebhook(rawBody) { // [VERIFY] payload field names
      const p = JSON.parse(rawBody);
      return {
        ref: p.merchantTransactionId,
        amountCents: Math.round(parseFloat(p.amount) * 100),
        currency: p.currency,
        success: SUCCESS_CODE.test(p.result?.code || ''),
      };
    },
  };
}

// Dev/test provider: no network. The checkout page shows a "simulate payment" button.
export function createMockProvider() {
  return {
    name: 'mock',
    async createCheckout() { return { checkoutId: 'mock', entityId: 'mock', scriptUrl: null }; },
    verifyWebhook() { return false; },
    parseWebhook() { throw new Error('mock provider has no webhooks'); },
  };
}

export function providerFromEnv(env = process.env) {
  const want = env.PAYMENT_PROVIDER || (env.PEACH_CLIENT_ID ? 'peach' : 'mock');
  if (env.NODE_ENV === 'production' && want === 'mock') throw new Error('PAYMENT_PROVIDER=mock is not allowed in production');
  return want === 'peach' ? createPeachProvider({ env }) : createMockProvider();
}

export const paymentRef = (orderId) => `DROP${String(orderId).padStart(8, '0')}`; // 12 chars
export const orderIdFromRef = (ref) => (/^DROP\d{8}$/.test(ref || '') ? Number(ref.slice(4)) : null);

// Marketplace orders use their own reference prefix so webhooks can tell the two apart.
export const marketRef = (orderId) => `MCON${String(orderId).padStart(8, '0')}`; // 12 chars
export const marketIdFromRef = (ref) => (/^MCON\d{8}$/.test(ref || '') ? Number(ref.slice(4)) : null);
