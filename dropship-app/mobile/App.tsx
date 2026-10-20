import React, { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { loadSession, saveSession, setToken, Session } from './src/api';
import Auth from './src/screens/Auth';
import Customer from './src/screens/Customer';
import Vendor from './src/screens/Vendor';
import Driver from './src/screens/Driver';
import { Button } from './src/ui';

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    loadSession().then((s) => { if (s) { setToken(s.token); setSession(s); } setReady(true); });
  }, []);

  const set = (s: Session | null) => { setToken(s?.token ?? null); setSession(s); saveSession(s); };
  if (!ready) return <View style={{ flex: 1, justifyContent: 'center' }}><ActivityIndicator /></View>;
  if (!session) return <><StatusBar style="dark" /><Auth onSession={set} /></>;

  const Screen = { customer: Customer, vendor: Vendor, driver: Driver }[session.user.role as 'customer' | 'vendor' | 'driver'];
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Screen />
      <Button kind="ghost" title={`Log out (${session.user.name})`} onPress={() => set(null)} />
    </View>
  );
}
