import React, { useEffect, useRef, useState } from 'react';
import { Modal, View, Text, ActivityIndicator } from 'react-native';
import { WebView } from 'react-native-webview';
import { api } from '../api';
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
            originWhitelist={['https://*']}
          />
        )}
        {!url && !err && <ActivityIndicator style={{ margin: 24 }} />}
      </View>
    </Modal>
  );
}
