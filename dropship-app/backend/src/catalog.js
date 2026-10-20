// Shared marketplace catalogue: where MzansiConnect operates and what can be listed.
export const AREAS = ['Giyani Town', 'Giyani Section A', 'Giyani Section D', 'Mavalani', 'Nkuri', 'Dzumeri', 'Hlaneki', 'Xikundu', 'Homu', 'Muyexe', 'Gawula', 'Bambeni', 'Ndhuna', 'Mapayeni', 'Malamulele'];

export const DEPTS = [
  { id: 'fuel', name: 'Firewood & Fuel', svc: false, subs: ['Firewood', 'Charcoal & kindling'], shape: 'logs', tone: '#8a5a2b' },
  { id: 'livestock', name: 'Livestock', svc: false, subs: ['Cattle', 'Goats & sheep', 'Poultry'], shape: 'cow', tone: '#7a4b2a' },
  { id: 'farm', name: 'Farming Supplies', svc: false, subs: ['Seeds', 'Feed & fertiliser', 'Tools & sprayers'], shape: 'seeds', tone: '#d9a441' },
  { id: 'produce', name: 'Fresh Produce & Pantry', svc: false, subs: ['Vegetables', 'Fruit', 'Dried & pantry'], shape: 'tomato', tone: '#c9321f' },
  { id: 'building', name: 'Building Materials', svc: false, subs: ['Cement & bricks', 'Roofing & sand', 'Water tanks'], shape: 'bricks', tone: '#b5532f' },
  { id: 'tractor', name: 'Tractor Services', svc: true, subs: ['Ploughing & planting', 'Tractor hire'], shape: 'tractor', tone: '#c9321f' },
  { id: 'water', name: 'Water Services', svc: true, subs: ['Water delivery', 'Boreholes & pumps'], shape: 'tanker', tone: '#2f6fb5' },
  { id: 'transport', name: 'Transport & Hire', svc: true, subs: ['Bakkie & truck hire', 'Livestock transport'], shape: 'bakkie', tone: '#5d6b7a' },
];
export const DEPT = Object.fromEntries(DEPTS.map((d) => [d.id, d]));
export const UNITS = ['hectare', 'hour', 'day', 'trip', 'metre', 'load', 'job', 'call-out'];

// Delivery is arranged and charged by the seller. Same village R30, other villages R60,
// free over R800 per seller, livestock arranged directly with the seller.
export const DELIVERY_SAME_VILLAGE_CENTS = 3000;
export const DELIVERY_OTHER_VILLAGE_CENTS = 6000;
export const FREE_DELIVERY_OVER_CENTS = 80000;

export const SA_PHONE = /^(\+27|0)\d{9}$/;
export const cleanPhone = (p) => String(p || '').replace(/[\s-]/g, '');
