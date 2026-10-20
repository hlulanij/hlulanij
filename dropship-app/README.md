# DropIt: on-demand delivery + dropshipping marketplace

One mobile app (iOS + Android, Expo/React Native) with three roles, backed by a Node API.

| Role | Can do |
|---|---|
| **Customer** | Browse food, groceries, pharmacy, liquor, shopping; cart, live quote, cash/card, track, cancel, rate; send a **parcel** with a courier |
| **Vendor** | Create store, add products (normal or **dropshipped** with supplier cost and margin protection), accept / prepare / ready orders |
| **Driver** | Go online (GPS), see nearby jobs, atomic claim (no double-assign), pick up, deliver, earnings |

## Run locally
```bash
cd backend && npm install && npm run seed && npm start      # API on :3000
cd mobile  && npm install && EXPO_PUBLIC_API_URL=http://<your-LAN-IP>:3000 npx expo start
```
Scan the QR with Expo Go. Seed logins (password `password123`): `customer@demo.test`, `driver@demo.test`, `burgerjoint@demo.test`, `gadgethub@demo.test`.
Backend tests: `cd backend && npm test`.

## Ship it
1. **Backend**: deploy `backend/` (Dockerfile included) to Fly.io / Railway / Render with a persistent volume at `/data`, and set `JWT_SECRET` to a long random value.
2. **Mobile**: set the URL in `mobile/eas.json`, change the bundle id / package (`com.example.dropit`) in `app.json`, then
   `npm i -g eas-cli && eas login && eas build -p android --profile production` (and `-p ios`), followed by `eas submit`.
   - Google Play: one-off US$25 developer account. Apple App Store: US$99/year developer account.
   - Only you can create those accounts and sign builds; this can't be done from the dev environment.

## Card payments (Peach Payments)
Card orders are created as `pending_payment` and hidden from stores and drivers. The app opens Peach's Embedded Checkout
(served by our backend in a WebView). The order only becomes `placed` when Peach's **signed webhook** arrives with the right
amount; the app's own "completed" message is never trusted. Cash orders skip all of this.

| Env var | Purpose |
|---|---|
| `PEACH_ENV` | `sandbox` (default) or `live` |
| `PEACH_CLIENT_ID`, `PEACH_CLIENT_SECRET`, `PEACH_MERCHANT_ID` | Peach auth credentials |
| `PEACH_ENTITY_ID` | Checkout entity / channel ID |
| `PEACH_WEBHOOK_SECRET` | Secret generated when you enable webhook signing in the Peach dashboard |
| `PUBLIC_URL` | Public HTTPS URL of this API (Peach calls `PUBLIC_URL/payments/peach/webhook`) |
| `PAYMENT_PROVIDER` | `peach` or `mock` (default `mock` if no Peach creds; refused in production) |

With no Peach credentials the checkout page shows a "simulate payment" button, so the whole flow works locally.

**Verify in the Peach sandbox before going live.** Peach's developer docs were not reachable when this was written, so these
parts follow their public outline but are marked `[VERIFY]` in `backend/src/payments.js`: the auth request field names, the
live host names, the webhook payload fields, the success `result.code` pattern, the Embedded Checkout `initiate/render` call, and
the exact string their webhook signature covers (assumed `HMAC-SHA256(secret, timestamp + "." + rawBody)`). Webhook
verification fails closed, so a wrong guess rejects payments rather than accepting fake ones. Fix anything the sandbox
disagrees with (usually a line or two), then re-run `npm test`.

## Expo account
Install and sign in on your own machine: `npm i -g eas-cli && eas login` (account `hlulanij`).
For CI or a cloud session, create an access token at expo.dev > Account settings > Access tokens and provide it as the
`EXPO_TOKEN` environment secret; `eas whoami` should then print `hlulanij`. Never commit the token or paste it into chat.
Then run `eas init` in `mobile/` to link the project.

## What is NOT production-ready yet (do these before real customers)
- **Peach refunds**: cancelling a paid card order flags it `refund_pending`; no refund API call is made yet. Refund from the Peach dashboard for now.
- **Maps / addresses**: customer location is a fixed demo address; add geocoding (Google Places), a map for live driver tracking (the API already returns `driver_location`), and ETA.
- **Push notifications** (expo-notifications) instead of 5-10 s polling, and WebSockets for live tracking.
- **Database**: SQLite is fine for one server; move to Postgres to scale.
- **Dropship supplier flow**: products record `fulfilment: dropship` and `supplier_cost`; there is no supplier API or purchase-order automation yet, and dropship orders currently use local driver delivery.
- **Compliance**: age verification for liquor, pharmacy rules (scheduled medicines), POPIA privacy policy, driver vetting, vendor payouts and admin dashboard.
- Rate limiting, email verification, password reset.
