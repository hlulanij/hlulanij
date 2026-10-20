import * as SecureStore from 'expo-secure-store';

// Set EXPO_PUBLIC_API_URL to your deployed backend. On an Android emulator use http://10.0.2.2:3000.
export const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000';

export type Role = 'customer' | 'vendor' | 'driver';
export type Session = { token: string; user: { id: number; role: Role; name: string } };
export type Address = { address: string; lat: number; lng: number };

let token: string | null = null;
export const setToken = (t: string | null) => { token = t; };

export async function saveSession(s: Session | null) {
  if (s) await SecureStore.setItemAsync('session', JSON.stringify(s));
  else await SecureStore.deleteItemAsync('session');
}
export async function loadSession(): Promise<Session | null> {
  try {
    const raw = await SecureStore.getItemAsync('session');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(API_URL + path, {
    method,
    headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

export const rand = (cents: number) => `R${(cents / 100).toFixed(2)}`;

// Demo location (Cape Town CBD). Replace with expo-location + address search in production.
export const DEMO_HOME: Address = { address: '10 Long Street, Cape Town', lat: -33.9249, lng: 18.4241 };
