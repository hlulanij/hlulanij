import React, { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text } from 'react-native';
import * as Location from 'expo-location';
import { api, DEMO, rand } from '../api';
import { Button, Card, Err, H, Muted, colors } from '../ui';

export default function Driver() {
  const [online, setOnline] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [active, setActive] = useState<any[]>([]);
  const [earn, setEarn] = useState<any>(null);
  const [err, setErr] = useState('');

  const load = useCallback(async () => {
    try {
      const [j, a, e] = await Promise.all([api('GET', '/driver/jobs'), api('GET', '/driver/active'), api('GET', '/driver/earnings')]);
      setJobs(j); setActive(a); setEarn(e);
    } catch (e: any) { setErr(e.message); }
  }, []);

  async function ping(isOnline: boolean) {
    if (DEMO) { await api('POST', '/driver/location', { lat: -33.9249, lng: 18.4241, online: isOnline }); return true; }
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') { setErr('Location permission is required to go online'); return false; }
    const p = await Location.getCurrentPositionAsync({});
    await api('POST', '/driver/location', { lat: p.coords.latitude, lng: p.coords.longitude, online: isOnline });
    return true;
  }

  useEffect(() => {
    if (!online) return;
    load();
    const t = setInterval(() => { ping(true).catch(() => {}); load(); }, 10000);
    return () => clearInterval(t);
  }, [online, load]);

  async function toggle() {
    setErr('');
    if (await ping(!online).catch(() => false)) setOnline(!online);
  }
  const claim = async (id: number) => { try { await api('POST', `/driver/jobs/${id}/claim`); } catch (e: any) { setErr(e.message); } load(); };
  const step = async (id: number, status: string) => { try { await api('POST', `/orders/${id}/status`, { status }); } catch (e: any) { setErr(e.message); } load(); };

  return (
    <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 56 }} style={{ backgroundColor: colors.bg }}>
      <H>{online ? 'You are online' : 'You are offline'}</H>
      <Button title={online ? 'Go offline' : 'Go online'} onPress={toggle} />
      {earn && <Muted>{earn.deliveries} deliveries · earned {rand(earn.earnings_cents)}</Muted>}
      <Err msg={err} />
      <H>Active</H>
      {active.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '700' }}>#{o.id} · {o.status}</Text>
          <Muted>Pickup: {o.pickup_address}</Muted>
          <Muted>Drop-off: {o.dropoff_address}</Muted>
          {o.payment_method === 'cash' && <Text style={{ fontWeight: '700' }}>Collect {rand(o.total_cents)} cash</Text>}
          {(o.status === 'ready' || (o.kind === 'parcel' && o.status === 'placed')) && <Button title="Picked up" onPress={() => step(o.id, 'picked_up')} />}
          {o.status === 'picked_up' && <Button title="Delivered" onPress={() => step(o.id, 'delivered')} />}
          {!['ready', 'picked_up'].includes(o.status) && o.kind === 'store' && <Muted>Waiting for the store…</Muted>}
        </Card>
      ))}
      <H>Available jobs</H>
      {online && !jobs.length && <Muted>No jobs nearby right now.</Muted>}
      {jobs.map((o) => (
        <Card key={o.id}>
          <Text style={{ fontWeight: '700' }}>{o.kind === 'parcel' ? 'Parcel' : 'Store order'} · earn {rand(o.driver_earnings_cents)}</Text>
          <Muted>{o.pickup_distance_km} km to pickup · {o.pickup_address}</Muted>
          <Button title="Accept job" onPress={() => claim(o.id)} />
        </Card>
      ))}
    </ScrollView>
  );
}
