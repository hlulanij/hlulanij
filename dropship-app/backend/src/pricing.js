// All money is integer cents (ZAR).
export const SERVICES = ['food', 'groceries', 'pharmacy', 'liquor', 'retail', 'courier'];

export const BASE_DELIVERY_CENTS = 1500;
export const PER_KM_CENTS = 500;
export const SERVICE_FEE_RATE = 0.05;
export const DRIVER_SHARE = 0.8; // of delivery fee + tip, rest is platform
export const PLATFORM_COMMISSION = 0.15; // of subtotal, charged to vendor

export function distanceKm(aLat, aLng, bLat, bLng) {
  const r = (d) => (d * Math.PI) / 180;
  const dLat = r(bLat - aLat);
  const dLng = r(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(aLat)) * Math.cos(r(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

export function deliveryFeeCents(km) {
  return BASE_DELIVERY_CENTS + Math.round(km * PER_KM_CENTS);
}

export function quote({ subtotalCents, km, tipCents = 0 }) {
  const delivery = deliveryFeeCents(km);
  const service = Math.round(subtotalCents * SERVICE_FEE_RATE);
  return {
    subtotal_cents: subtotalCents,
    delivery_fee_cents: delivery,
    service_fee_cents: service,
    tip_cents: tipCents,
    total_cents: subtotalCents + delivery + service + tipCents,
    distance_km: Math.round(km * 10) / 10,
  };
}

export function dropshipMarginCents(priceCents, supplierCostCents) {
  return priceCents - supplierCostCents;
}
