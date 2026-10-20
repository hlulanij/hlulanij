import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, ActivityIndicator, Platform } from 'react-native';
import { WebView } from 'react-native-webview';
import { api, DEMO } from '../api';
import { Button, Err, colors } from '../ui';

// Opens Peach's embedded checkout (served by our backend) in a modal.
// The WebView only tells us the shopper finished; the order is released to the
// store when Peach's signed webhook reaches the backend, so we poll for that.
export default function Pay({ orderId, onClose }: { orderId: number; onClose: (paid: boolean) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const [waiting, setWaiting] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    api('POST', `/orders/${orderId}/pay`).then((r) => setUrl(r.checkout_url)).catch((e) => setErr(e.message));
  }, [orderId]);

  useEffect(() => {
    if (!waiting) return;
    let tries = 0;
    const t = setInterval(async () => {
      tries++;
      const o = await api('GET', `/orders/${orderId}`).catch(() => null);
      if (o?.payment_status === 'paid') { done.current = true; clearInterval(t); onClose(true); }
      else if (o?.payment_status === 'failed' || tries > 30) { clearInterval(t); setWaiting(false); setErr('We could not confirm your payment. If you were charged, it will update shortly under Orders.'); }
    }, 2000);
    return () => clearInterval(t);
  }, [waiting, orderId, onClose]);

  if (DEMO || Platform.OS === 'web') {
    // The browser preview has no card form (the real app uses Peach's checkout in a WebView).
    return (
      <Modal animationType="slide" onRequestClose={() => onClose(false)}>
        <View style={{ flex: 1, padding: 24, paddingTop: 64, backgroundColor: colors.bg }}>
          <Text style={{ fontSize: 22, fontWeight: '800' }}>Card payment</Text>
          <Text style={{ color: colors.mute, marginVertical: 8 }}>Preview mode. In the real app this is Peach Payments' secure card form.</Text>
          <Button title="Pay with test card" onPress={async () => { await api('POST', `/demo/pay/${orderId}`); onClose(true); }} />
          <Button kind="ghost" title="Close" onPress={() => onClose(false)} />
        </View>
      </Modal>
    );
  }

  return (
    <Modal animationType="slide" onRequestClose={() => onClose(false)}>
      <View style={{ flex: 1, paddingTop: 48, backgroundColor: colors.bg }}>
        <Button kind="ghost" title="Close" onPress={() => onClose(done.current)} />
        <Err msg={err} />
        {waiting && <View style={{ padding: 24, alignItems: 'center' }}><ActivityIndicator /><Text>Confirming payment…</Text></View>}
        {url && !waiting && (
          <WebView
            source={{ uri: url }}
            onMessage={(e) => (e.nativeEvent.data === 'completed' ? setWaiting(true) : onClose(false))}
            originWhitelist={['http://*', 'https://*']}
          />
        )}
        {!url && !err && <ActivityIndicator style={{ margin: 24 }} />}
      </View>
    </Modal>
  );
}
