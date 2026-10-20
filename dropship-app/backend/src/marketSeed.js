import bcrypt from 'bcryptjs';

// Sample sellers and listings for Giyani, used only when DEMO_SEED=1. All businesses, people and
// phone numbers are made up. Demo logins use the password "password123".
const SELLERS = [
  ['chauke', 'Chauke Farm & Fuel', 'Nkuri', 4.8, 640],
  ['baloyi', 'Baloyi Livestock', 'Mavalani', 4.7, 210],
  ['maluleke', 'Maluleke Tractor Hire', 'Dzumeri', 4.9, 380],
  ['shilubane', 'Shilubane Water Services', 'Giyani Town', 4.8, 520],
  ['nkuna', 'Nkuna Fresh Produce', 'Hlaneki', 4.6, 300],
  ['hlungwani', 'Hlungwani Building Supplies', 'Giyani Town', 4.5, 410],
  ['ngobeni', 'Ngobeni Seeds & Feed', 'Xikundu', 4.7, 360],
  ['mukhari', 'Mukhari Poultry', 'Homu', 4.6, 190],
  ['mabasa', 'Mabasa Transport', 'Malamulele', 4.5, 270],
];
const LV = "Livestock is collected from the seller or delivered by the seller's own transport. The seller will phone you to agree a time.";
// [seller, dept, sub, title, rands, unit, stock, sold, description, note]
const LISTINGS = [
  ['chauke', 'fuel', 'Firewood', 'Mopane firewood, 20kg bag', 65, '', 80, 420, 'Dry mopane firewood, split and ready for the fire. Burns hot and long.'],
  ['chauke', 'fuel', 'Firewood', 'Firewood, bakkie load (about 1 ton)', 650, '', 12, 310, "Seasoned mixed hardwood, loaded and delivered by the seller's bakkie.", "Delivered by the seller's bakkie. Loading is included in the price."],
  ['chauke', 'fuel', 'Charcoal & kindling', 'Kindling bundle', 25, '', 150, 260, 'Dry kindling to light a fire quickly.'],
  ['chauke', 'fuel', 'Charcoal & kindling', 'Charcoal, 10kg bag', 120, '', 40, 190, 'Lump charcoal for braai and cooking.'],
  ['baloyi', 'livestock', 'Cattle', 'Weaner calf, mixed breed (about 8 months)', 6800, '', 6, 38, "Healthy weaner calf, dipped and dosed. Viewing at the seller's kraal is welcome.", LV],
  ['baloyi', 'livestock', 'Cattle', 'Cow in calf, Nguni cross', 13500, '', 3, 24, 'Strong Nguni cross cow, in calf, well suited to local grazing.', LV],
  ['baloyi', 'livestock', 'Goats & sheep', 'Goat, adult Boer cross', 1900, '', 14, 64, 'Healthy adult goat. Suitable for breeding or the pot.', LV],
  ['baloyi', 'livestock', 'Goats & sheep', 'Sheep, adult Dorper cross', 2300, '', 9, 41, 'Adult Dorper cross sheep, in good condition.', LV],
  ['mukhari', 'livestock', 'Poultry', 'Indigenous chicken, live', 180, '', 60, 230, 'Free-range indigenous chicken. Hardy and tasty.', 'Collected from the seller in Homu or delivered by the seller.'],
  ['mukhari', 'livestock', 'Poultry', 'Laying hens, pack of 5', 650, '', 20, 88, 'Five young laying hens, vaccinated.', 'Collected from the seller in Homu or delivered by the seller.'],
  ['ngobeni', 'farm', 'Seeds', 'Maize seed, 10kg', 520, '', 40, 210, 'Hybrid maize seed suited to dryland planting.'],
  ['ngobeni', 'farm', 'Seeds', 'Spinach (morogo) seed, 100g', 35, '', 200, 300, 'Fast growing leafy greens for the home garden.'],
  ['ngobeni', 'farm', 'Feed & fertiliser', 'Fertiliser 2:3:2, 50kg', 640, '', 30, 150, 'General purpose fertiliser for vegetables and maize.'],
  ['ngobeni', 'farm', 'Feed & fertiliser', 'Layer mash chicken feed, 50kg', 340, '', 50, 180, 'Complete feed for laying hens.'],
  ['ngobeni', 'farm', 'Feed & fertiliser', 'Cattle lick, 25kg', 290, '', 35, 95, 'Mineral lick supplement for cattle and goats.'],
  ['ngobeni', 'farm', 'Tools & sprayers', 'Knapsack sprayer, 16 litre', 450, '', 15, 120, 'Manual knapsack sprayer with adjustable nozzle.'],
  ['ngobeni', 'farm', 'Tools & sprayers', 'Garden hoe', 120, '', 70, 260, 'Strong steel hoe with a hardwood handle.'],
  ['nkuna', 'produce', 'Vegetables', 'Fresh spinach (morogo), bunch', 10, '', 300, 520, 'Fresh morogo picked on the day.'],
  ['nkuna', 'produce', 'Vegetables', 'Tomatoes, 5kg box', 95, '', 60, 210, 'Firm red tomatoes from local growers.'],
  ['nkuna', 'produce', 'Fruit', 'Mangoes, 5kg box', 110, '', 40, 170, 'Sweet seasonal mangoes.'],
  ['nkuna', 'produce', 'Dried & pantry', 'Groundnuts (peanuts), 1kg', 55, '', 80, 140, 'Raw groundnuts, shelled and cleaned.'],
  ['nkuna', 'produce', 'Dried & pantry', 'Dried mopane worms, 500g', 180, '', 50, 260, 'Sun-dried mopane worms (madora), cleaned and packed.'],
  ['nkuna', 'produce', 'Dried & pantry', 'Maize meal, 12.5kg', 145, '', 90, 330, 'Fine white maize meal for pap.'],
  ['hlungwani', 'building', 'Cement & bricks', 'Cement, 50kg bag', 125, '', 200, 310, 'Portland cement for building and plastering.'],
  ['hlungwani', 'building', 'Cement & bricks', 'Building bricks, 100', 195, '', 100, 150, 'Solid face bricks, sold per 100.', "Heavy item. Delivered by the seller's truck. The seller will confirm the delivery fee."],
  ['hlungwani', 'building', 'Roofing & sand', 'Roof sheet IBR, 3 metre', 210, '', 60, 95, 'Galvanised IBR roof sheet, 3 metres.'],
  ['hlungwani', 'building', 'Roofing & sand', 'River sand, bakkie load', 650, '', 25, 70, 'Clean river sand for building, delivered by bakkie.', "Delivered by the seller's bakkie."],
  ['maluleke', 'tractor', 'Ploughing & planting', 'Ploughing with tractor', 950, 'hectare', 0, 160, 'Disc ploughing for your field or garden plot. Book early in the planting season.'],
  ['maluleke', 'tractor', 'Ploughing & planting', 'Planting with tractor planter', 650, 'hectare', 0, 95, 'Row planting for maize and beans. Bring your own seed or ask us to supply it.'],
  ['maluleke', 'tractor', 'Tractor hire', 'Grass slashing', 700, 'hectare', 0, 80, 'Slashing for yards, fields and fire breaks.'],
  ['maluleke', 'tractor', 'Tractor hire', 'Tractor and trailer, with driver', 1800, 'day', 0, 110, 'Tractor and trailer for carrying loads, with an experienced driver.'],
  ['shilubane', 'water', 'Water delivery', 'Water tanker delivery, 5 000 litres', 450, 'load', 0, 340, 'Clean water delivered to your yard or tank within the Giyani area.'],
  ['shilubane', 'water', 'Boreholes & pumps', 'Borehole drilling', 420, 'metre', 0, 60, 'Borehole drilling and casing. A site visit is arranged before work starts.'],
  ['shilubane', 'water', 'Boreholes & pumps', 'Pump installation, labour', 1200, 'job', 0, 85, 'Installation of electric or solar pumps. Pump supplied separately.'],
  ['shilubane', 'water', 'Boreholes & pumps', 'Water leak repair call-out', 350, 'call-out', 0, 120, 'Repair of leaking pipes and taps at your home or business.'],
  ['shilubane', 'building', 'Water tanks', 'Water tank, 5 000 litre (supplied)', 5400, '', 8, 75, 'Strong 5 000 litre tank with a lid. Delivery arranged with the seller.', "Heavy item. Delivered by the seller's truck. The seller will confirm the delivery fee."],
  ['chauke', 'transport', 'Bakkie & truck hire', 'Bakkie hire with driver', 450, 'trip', 0, 210, 'Local bakkie trips for firewood, furniture and building materials.'],
  ['mabasa', 'transport', 'Bakkie & truck hire', 'Truck hire, 4 ton', 2200, 'day', 0, 90, 'Four ton truck with driver for moving loads and goods.'],
  ['mabasa', 'transport', 'Livestock transport', 'Livestock transport', 1200, 'trip', 0, 65, 'Safe transport for cattle, goats and sheep between villages and markets.'],
];
const DEPT_SVC = new Set(['tractor', 'water', 'transport']);

export function seedMarket(db) {
  if (db.prepare('SELECT COUNT(*) n FROM m_users').get().n > 0) return false;
  const hash = bcrypt.hashSync('password123', 10);
  const user = (email, name, role, phone) => Number(db.prepare('INSERT INTO m_users (email,name,phone,role,password_hash) VALUES (?,?,?,?,?)').run(email, name, phone, role, hash).lastInsertRowid);
  const sid = {};
  SELLERS.forEach(([slug, name, village, rating, sales], i) => {
    const phone = `07100000${String(i + 1).padStart(2, '0')}`;
    const uid = user(`${slug}@demo.test`, `${name} owner`, 'seller', phone);
    sid[slug] = Number(db.prepare('INSERT INTO m_sellers (user_id,name,village,phone,rating,sales) VALUES (?,?,?,?,?,?)').run(uid, name, village, phone, rating, sales).lastInsertRowid);
  });
  const ins = db.prepare('INSERT INTO m_listings (seller_id,dept,sub,type,title,description,price_cents,unit,stock,note,sold) VALUES (?,?,?,?,?,?,?,?,?,?,?)');
  for (const [slug, dept, sub, title, rands, unit, stock, sold, desc, note] of LISTINGS) {
    ins.run(sid[slug], dept, sub, DEPT_SVC.has(dept) ? 'service' : 'good', title, desc, rands * 100, unit, stock, note || '', sold);
  }
  const buyer = user('tsakani@demo.test', 'Tsakani Baloyi', 'buyer', '0710000100');
  const rudzani = user('rudzani@demo.test', 'Rudzani Mabunda', 'buyer', '0710000101');
  // A couple of orders and requests so the seller dashboards are not empty on first look.
  const title = (t) => db.prepare('SELECT * FROM m_listings WHERE title = ?').get(t);
  const mk = (uid, items, status, area, directions) => {
    const lines = items.map(([t, qty]) => ({ l: title(t), qty }));
    const sub = lines.reduce((a, x) => a + x.l.price_cents * x.qty, 0);
    const id = Number(db.prepare(`INSERT INTO m_orders (buyer_id,state,method,pay,payment_status,name,phone,area,directions,subtotal_cents,delivery_cents,total_cents)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(uid, 'placed', 'deliver', 'cash', 'pending_cash', 'Demo buyer', '0710000100', area, directions, sub, 6000, sub + 6000).lastInsertRowid);
    for (const { l, qty } of lines) db.prepare('INSERT INTO m_order_items (order_id,listing_id,seller_id,title,qty,unit_price_cents) VALUES (?,?,?,?,?,?)').run(id, l.id, l.seller_id, l.title, qty, l.price_cents);
    for (const s of new Set(lines.map((x) => x.l.seller_id))) db.prepare('INSERT INTO m_order_sellers (order_id,seller_id,status,delivery_cents) VALUES (?,?,?,?)').run(id, s, status, 6000);
  };
  mk(rudzani, [['Mopane firewood, 20kg bag', 3], ['Charcoal, 10kg bag', 1]], 'Processing', 'Hlaneki', 'Blue gate, opposite the spaza shop');
  mk(buyer, [['Kindling bundle', 4]], 'Packed', 'Giyani Section A', 'Near the clinic');
  const rq = db.prepare('INSERT INTO m_requests (listing_id,seller_id,buyer_id,name,phone,area,date,details,status) VALUES (?,?,?,?,?,?,?,?,?)');
  const bk = title('Bakkie hire with driver');
  rq.run(bk.id, bk.seller_id, rudzani, 'Rudzani Mabunda', '0710000101', 'Mavalani', '2099-01-10', 'Need to move a wardrobe and two beds.', 'New');
  rq.run(bk.id, bk.seller_id, buyer, 'Tsakani Baloyi', '0710000100', 'Dzumeri', '2099-01-12', 'Fetch building sand from the river.', 'Confirmed');
  return true;
}
