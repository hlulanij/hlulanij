import React from 'react';
import { Pressable, Text, View, StyleSheet, TextInput, TextInputProps } from 'react-native';

export const colors = { brand: '#E4002B', ink: '#1b1b1f', mute: '#6b6b76', bg: '#f6f6f8', card: '#fff', ok: '#1a8f4d' };

export function Button({ title, onPress, kind = 'primary', disabled }: { title: string; onPress: () => void; kind?: 'primary' | 'ghost'; disabled?: boolean }) {
  return (
    <Pressable onPress={onPress} disabled={disabled}
      style={[s.btn, kind === 'ghost' && s.ghost, disabled && { opacity: 0.5 }]}>
      <Text style={[s.btnText, kind === 'ghost' && { color: colors.brand }]}>{title}</Text>
    </Pressable>
  );
}
export const Card = ({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) =>
  <Pressable onPress={onPress} style={s.card}>{children}</Pressable>;
export const H = ({ children }: { children: React.ReactNode }) => <Text style={s.h}>{children}</Text>;
export const Muted = ({ children }: { children: React.ReactNode }) => <Text style={{ color: colors.mute }}>{children}</Text>;
export const Input = (p: TextInputProps) => <TextInput placeholderTextColor={colors.mute} {...p} style={s.input} />;
export const Err = ({ msg }: { msg: string }) => (msg ? <Text style={{ color: colors.brand, marginVertical: 6 }}>{msg}</Text> : null);

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly T[]; value: T; onChange: (t: T) => void }) {
  return (
    <View style={s.tabs}>
      {tabs.map((t) => (
        <Pressable key={t} onPress={() => onChange(t)} style={[s.tab, value === t && s.tabOn]}>
          <Text style={{ color: value === t ? colors.brand : colors.mute, fontWeight: '600' }}>{t}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const s = StyleSheet.create({
  btn: { backgroundColor: colors.brand, padding: 14, borderRadius: 10, alignItems: 'center', marginVertical: 6 },
  ghost: { backgroundColor: 'transparent', borderWidth: 1, borderColor: colors.brand },
  btnText: { color: '#fff', fontWeight: '700' },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginVertical: 6 },
  h: { fontSize: 20, fontWeight: '800', color: colors.ink, marginVertical: 8 },
  input: { backgroundColor: colors.card, borderRadius: 10, padding: 12, marginVertical: 6, borderWidth: 1, borderColor: '#e2e2e8', color: colors.ink },
  tabs: { flexDirection: 'row', backgroundColor: colors.card, borderTopWidth: 1, borderColor: '#e2e2e8' },
  tab: { flex: 1, padding: 14, alignItems: 'center' },
  tabOn: { borderTopWidth: 2, borderColor: colors.brand },
});
