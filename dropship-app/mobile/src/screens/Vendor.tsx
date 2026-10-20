import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { api, rand } from '../api';
import { Button, Card, Err, H, Input, Muted, Tabs, colors } from '../ui';

const TABS = ['Orders', 'Products'] as const;
const NEXT: Record<string, string> = { placed: 'accepted', accepted: 'preparing', preparing: 'ready' };

export default function Vendor() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Orders');
  const [hasStore, setHasStore] = useState<boolean | null>(null);
  useEffect(() => { api('GET', '/vendor/orders').then(() => setHasStore(true)).catch(() => setHasStore(false)); }, []);
  if (hasStore === false) return <CreateStore onDone={() => setHasStore(true)} />;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ flex: 1 }}>{tab === 'Orders' ? <VOrders /> : <Products />}</View>
      <Tabs tabs={TABS} value={tab} onChange={setTab} />
    </View>
  );
}

function CreateStore({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [service, setService] = useState('food');
  const [err, setErr] = useState('');
  async function create() {
    try { await api('POST', '/vendor/store', { name, service, lat: -33.9249, lng: 18.4241, address: 'Cape Town' }); onDone(); }
    catch (e: any) { setErr(e.message); }
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }}>
      <H>Set up your store</H>
      <Input placeholder="Store name" value={name} onChangeText={setName} />
      <Input placeholder="food | groceries | pharmacy | liquor | retail" autoCapitalize="none" value={service} onChangeText={setService} />
      <Err msg={err} />
      <Button title="Create store" onPress={create} disabled={!name} />
    </ScrollView>
  );
}

function VOrders() {
  const [orders, setOrders] = useState<any[]>([]);
  const load = useCallback(() => { api('GET', '/vendor/orders').then(setOrders).catch(() => {}); }, []);
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [load]);
  const move = async (id: number, status: string) => { await api('POST', `/orders/${id}/status`, { status }).catch(() => {}); load(); };
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }}>
      <H>Incoming orders</H>
      {orders.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '700' }}>#{o.id} · {rand(o.subtotal_cents)} · {o.status}</Text>
          {o.items.map((i: any, k: number) => <Muted key={k}>{i.qty}× {i.name}</Muted>)}
          {NEXT[o.status] && <Button title={`Mark ${NEXT[o.status]}`} onPress={() => move(o.id, NEXT[o.status])} />}
          {o.status === 'placed' && <Button kind="ghost" title="Reject" onPress={() => move(o.id, 'cancelled')} />}
        </Card>
      ))}
    </ScrollView>
  );
}

function Products() {
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [cost, setCost] = useState('');
  const [msg, setMsg] = useState('');
  async function add() {
    const dropship = cost.trim() !== '';
    try {
      await api('POST', '/vendor/products', {
        name, price_cents: Math.round(parseFloat(price) * 100),
        ...(dropship ? { fulfilment: 'dropship', supplier_cost_cents: Math.round(parseFloat(cost) * 100) } : {}),
      });
      setMsg(`Added ${name}`); setName(''); setPrice(''); setCost('');
    } catch (e: any) { setMsg(e.message); }
  }
  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }}>
      <H>Add product</H>
      <Input placeholder="Name" value={name} onChangeText={setName} />
      <Input placeholder="Selling price (R)" keyboardType="decimal-pad" value={price} onChangeText={setPrice} />
      <Input placeholder="Supplier cost (R), only for dropshipped items" keyboardType="decimal-pad" value={cost} onChangeText={setCost} />
      <Muted>{msg}</Muted>
      <Button title="Add product" onPress={add} disabled={!name || !price} />
    </ScrollView>
  );
}
