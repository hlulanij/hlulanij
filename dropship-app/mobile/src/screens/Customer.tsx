import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, DEMO_HOME, rand } from '../api';
import { Button, Card, Err, H, Input, Muted, Tabs, colors } from '../ui';

const SERVICES = ['food', 'groceries', 'pharmacy', 'liquor', 'retail'];
const LABEL: Record<string, string> = { food: '🍔 Food', groceries: '🛒 Groceries', pharmacy: '💊 Pharmacy', liquor: '🍷 Liquor', retail: '📦 Shopping' };
const TABS = ['Browse', 'Parcel', 'Orders'] as const;

export default function Customer() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Browse');
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'Browse' && <Browse onOrdered={() => setTab('Orders')} />}
        {tab === 'Parcel' && <Parcel onOrdered={() => setTab('Orders')} />}
        {tab === 'Orders' && <Orders />}
      </View>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
    </View>
  );
}

function Browse({ onOrdered }: { onOrdered: () => void }) {
  const [service, setService] = useState<string | null>(null);
  const [vendors, setVendors] = useState<any[]>([]);
  const [vendor, setVendor] = useState<any>(null);

  useEffect(() => {
    if (!service) return;
    api('GET', `/vendors?service=${service}&lat=${DEMO_HOME.lat}&lng=${DEMO_HOME.lng}`).then(setVendors).catch(() => setVendors([]));
  }, [service]);

  if (vendor) return <Store id={vendor.id} onBack={() => setVendor(null)} onOrdered={onOrdered} />;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }}>
      <H>What do you need?</H>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {SERVICES.map((s) => (
          <Card key={s} onPress={() => setService(s)}><Text style={{ fontWeight: '700', color: service === s ? colors.brand : colors.ink }}>{LABEL[s]}</Text></Card>
        ))}
      </View>
      {service && <H>Near you</H>}
      {service && !vendors.length && <Muted>Nothing open nearby.</Muted>}
      {vendors.map((v) => (
        <Card key={v.id} onPress={() => setVendor(v)}>
          <Text style={{ fontWeight: '700', fontSize: 16 }}>{v.name}</Text>
          <Muted>{v.distance_km} km{v.rating ? ` · ★ ${v.rating}` : ''}</Muted>
        </Card>
      ))}
    </ScrollView>
  );
}

function Store({ id, onBack, onOrdered }: { id: number; onBack: () => void; onOrdered: () => void }) {
  const [v, setV] = useState<any>(null);
  const [cart, setCart] = useState<Record<number, number>>({});
  const [quote, setQuote] = useState<any>(null);
  const [pay, setPay] = useState<'cash' | 'card'>('cash');
  const [err, setErr] = useState('');

  useEffect(() => { api('GET', `/vendors/${id}`).then(setV).catch((e) => setErr(e.message)); }, [id]);
  const items = Object.entries(cart).filter(([, q]) => q > 0).map(([pid, qty]) => ({ product_id: +pid, qty }));
  const body = { vendor_id: id, items, dropoff: DEMO_HOME };

  useEffect(() => {
    setQuote(null);
    if (items.length) api('POST', '/orders/quote', body).then(setQuote).catch((e) => setErr(e.message));
  }, [JSON.stringify(items)]); // eslint-disable-line react-hooks/exhaustive-deps

  async function place() {
    setErr('');
    try { await api('POST', '/orders', { ...body, payment_method: pay }); onOrdered(); } catch (e: any) { setErr(e.message); }
  }
  const bump = (pid: number, d: number) => setCart((c) => ({ ...c, [pid]: Math.max(0, (c[pid] || 0) + d) }));

  if (!v) return <View style={{ padding: 56 }}><Muted>Loading…</Muted><Err msg={err} /></View>;
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }}>
      <Button kind="ghost" title="← Back" onPress={onBack} />
      <H>{v.name}</H>
      {v.products.map((p: any) => (
        <Card key={p.id}>
          <Text style={{ fontWeight: '600' }}>{p.name}</Text>
          <Muted>{rand(p.price_cents)}</Muted>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            <Button title="−" kind="ghost" onPress={() => bump(p.id, -1)} />
            <Text>{cart[p.id] || 0}</Text>
            <Button title="+" onPress={() => bump(p.id, 1)} />
          </View>
        </Card>
      ))}
      {quote && (
        <Card>
          <Muted>Items {rand(quote.subtotal_cents)} · Delivery {rand(quote.delivery_fee_cents)} · Service {rand(quote.service_fee_cents)}</Muted>
          <Text style={{ fontWeight: '800', fontSize: 18 }}>Total {rand(quote.total_cents)}</Text>
          <Tabs tabs={['cash', 'card'] as const} value={pay} onChange={setPay} />
          <Button title="Place order" onPress={place} />
        </Card>
      )}
      <Err msg={err} />
    </ScrollView>
  );
}

function Parcel({ onOrdered }: { onOrdered: () => void }) {
  const [pickup, setPickup] = useState('');
  const [dropoff, setDropoff] = useState('');
  const [err, setErr] = useState('');
  // Demo coordinates; wire a geocoder (e.g. Google Places) for real addresses.
  async function go() {
    try {
      await api('POST', '/orders', {
        pickup: { address: pickup, lat: -33.9, lng: 18.42 },
        dropoff: { address: dropoff, lat: -33.95, lng: 18.47 },
      });
      onOrdered();
    } catch (e: any) { setErr(e.message); }
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }}>
      <H>Send a parcel</H>
      <Input placeholder="Pickup address" value={pickup} onChangeText={setPickup} />
      <Input placeholder="Drop-off address" value={dropoff} onChangeText={setDropoff} />
      <Err msg={err} />
      <Button title="Request courier" onPress={go} disabled={!pickup || !dropoff} />
    </ScrollView>
  );
}

function Orders() {
  const [orders, setOrders] = useState<any[]>([]);
  const load = useCallback(() => { api('GET', '/orders').then(setOrders).catch(() => {}); }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);

  const act = async (path: string, body: object) => { await api('POST', path, body).catch(() => {}); load(); };
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }}>
      <H>Your orders</H>
      {!orders.length && <Muted>No orders yet.</Muted>}
      {orders.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '700' }}>#{o.id} · {o.kind === 'parcel' ? 'Parcel' : 'Store order'} · {rand(o.total_cents)}</Text>
          <Text style={{ color: colors.ok, fontWeight: '700', marginVertical: 4 }}>{o.status.replace('_', ' ')}</Text>
          {o.status === 'placed' && <Button kind="ghost" title="Cancel" onPress={() => act(`/orders/${o.id}/status`, { status: 'cancelled' })} />}
          {o.status === 'delivered' && <Button kind="ghost" title="Rate 5★" onPress={() => act(`/orders/${o.id}/rating`, { vendor_stars: 5, driver_stars: 5 })} />}
        </Card>
      ))}
    </ScrollView>
  );
}
