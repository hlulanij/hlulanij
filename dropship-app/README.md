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

## What is NOT production-ready yet (do these before real customers)
- **Payments**: `card` only records an "authorised" status. Integrate a South African gateway (Peach Payments, PayFast, Yoco, or Stripe) and capture on delivery.
- **Maps / addresses**: customer location is a fixed demo address; add geocoding (Google Places), a map for live driver tracking (the API already returns `driver_location`), and ETA.
- **Push notifications** (expo-notifications) instead of 5-10 s polling, and WebSockets for live tracking.
- **Database**: SQLite is fine for one server; move to Postgres to scale.
- **Dropship supplier flow**: products record `fulfilment: dropship` and `supplier_cost`; there is no supplier API or purchase-order automation yet, and dropship orders currently use local driver delivery.
- **Compliance**: age verification for liquor, pharmacy rules (scheduled medicines), POPIA privacy policy, driver vetting, vendor payouts and admin dashboard.
- Rate limiting, email verification, password reset.
