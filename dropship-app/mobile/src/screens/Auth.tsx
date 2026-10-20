import React, { useState } from 'react';
import { View, Text } from 'react-native';
import { api, Role, Session } from '../api';
import { Button, Err, H, Input, Muted, Tabs, colors } from '../ui';

const ROLES = ['customer', 'vendor', 'driver'] as const;

export default function Auth({ onSession }: { onSession: (s: Session) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [role, setRole] = useState<Role>('customer');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true); setErr('');
    try {
      const body = mode === 'login' ? { email, password } : { name, email, password, role };
      onSession(await api<Session>('POST', `/auth/${mode}`, body));
    } catch (e: any) { setErr(e.message); } finally { setBusy(false); }
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.bg }}>
      <Text style={{ fontSize: 32, fontWeight: '900', color: colors.brand }}>DropIt</Text>
      <Muted>Food, groceries, pharmacy, liquor, shopping and parcels, delivered.</Muted>
      <H>{mode === 'login' ? 'Log in' : 'Create account'}</H>
      {mode === 'register' && (
        <>
          <Input placeholder="Full name" value={name} onChangeText={setName} />
          <Muted>I am a…</Muted>
          <Tabs tabs={ROLES} value={role} onChange={setRole} />
        </>
      )}
      <Input placeholder="Email" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
      <Input placeholder="Password (8+ characters)" secureTextEntry value={password} onChangeText={setPassword} />
      <Err msg={err} />
      <Button title={mode === 'login' ? 'Log in' : 'Sign up'} onPress={submit} disabled={busy} />
      <Button kind="ghost" title={mode === 'login' ? 'New here? Sign up' : 'Have an account? Log in'} onPress={() => setMode(mode === 'login' ? 'register' : 'login')} />
    </View>
  );
}
