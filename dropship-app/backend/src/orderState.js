// Order lifecycle. Parcel orders have no vendor, so they skip the vendor steps.
export const STATUSES = ['pending_payment', 'placed', 'accepted', 'preparing', 'ready', 'picked_up', 'delivered', 'cancelled'];

const STORE_FLOW = {
  pending_payment: ['placed', 'cancelled'],
  placed: ['accepted', 'cancelled'],
  accepted: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['picked_up'],
  picked_up: ['delivered'],
  delivered: [],
  cancelled: [],
};
const PARCEL_FLOW = {
  pending_payment: ['placed', 'cancelled'],
  placed: ['picked_up', 'cancelled'],
  picked_up: ['delivered'],
  delivered: [],
  cancelled: [],
};

export function canTransition(kind, from, to) {
  const flow = kind === 'parcel' ? PARCEL_FLOW : STORE_FLOW;
  return (flow[from] || []).includes(to);
}

// Which actor may drive each target status.
export function actorFor(to) {
  if (to === 'placed') return 'system'; // only a confirmed payment (or cash checkout) places an order
  if (['accepted', 'preparing', 'ready'].includes(to)) return 'vendor';
  if (['picked_up', 'delivered'].includes(to)) return 'driver';
  return 'any'; // cancelled
}
