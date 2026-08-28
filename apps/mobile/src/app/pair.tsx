import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { claimPair, confirmPair, getMobileDevices, getPairStatus, loadMobileIdentity, revokePair, type MobileIdentity, type PairedPcDevice, type PairCredential } from '../lib/handoff';

export default function PairScreen() {
  const [code, setCode] = useState('');
  const [pair, setPair] = useState<PairCredential | null>(null);
  const [identity, setIdentity] = useState<MobileIdentity | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [identityError, setIdentityError] = useState(false);
  const [devices, setDevices] = useState<PairedPcDevice[]>([]);
  const [message, setMessage] = useState('PCで表示した8文字の連携コードを入力してください。PCは何台でも追加できます。');
  const [busy, setBusy] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const refreshDevices = useCallback(async (currentIdentity: MobileIdentity | null) => {
    if (!currentIdentity) return setDevices([]);
    const current = await getMobileDevices(currentIdentity);
    setDevices(current.devices);
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        const currentIdentity = await loadMobileIdentity();
        setIdentity(currentIdentity);
        await refreshDevices(currentIdentity);
      } catch {
        setIdentityError(true);
        setMessage('接続情報を確認できませんでした。アプリを開き直してから、もう一度試してください。');
      }
      finally { setIdentityReady(true); }
    })();
  }, [refreshDevices]);

  useEffect(() => {
    if (!pair || pair.status === 'paired') return;
    const timer = setInterval(async () => {
      try {
        const current = await getPairStatus(pair);
        if (current.status === 'revoked' || current.status === 'expired') {
          setPair(null);
          setMessage(current.status === 'revoked' ? 'PC側で連携が解除されました。' : '連携コードの有効期限が切れました。');
          return;
        }
        setPair(current);
        if (current.status === 'paired') {
          const currentIdentity = await loadMobileIdentity();
          setIdentity(currentIdentity);
          await refreshDevices(currentIdentity);
          setMessage('PCとの連携が完了しました。ほかのPCも追加できます。');
        }
      } catch { /* The visible controls keep a recovery path. */ }
    }, 1800);
    return () => clearInterval(timer);
  }, [pair, refreshDevices]);

  const beginPair = async () => {
    setBusy(true);
    try {
      const credential = await claimPair(code, 'このスマホ', identity);
      setPair(credential);
      setMessage('PCにも同じ確認フレーズが表示されます。見比べてください。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '連携コードを確認できませんでした。');
    } finally { setBusy(false); }
  };

  const approvePair = async () => {
    if (!pair) return;
    setBusy(true);
    try {
      const response = await confirmPair(pair);
      setMessage(response.status === 'paired' ? 'PCとの連携が完了しました。ほかのPCも追加できます。' : 'PC側の確認を待っています。');
      if (response.status === 'paired') {
        const currentIdentity = await loadMobileIdentity();
        setIdentity(currentIdentity);
        await refreshDevices(currentIdentity);
        setPair({ ...pair, status: 'paired' });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '確認を完了できませんでした。');
    } finally { setBusy(false); }
  };

  const removeDevice = async (device: PairedPcDevice) => {
    if (!identity) return;
    setRemovingId(device.id);
    try {
      await revokePair({ code: device.id, receiverId: identity.receiverId, token: identity.token, role: 'mobile', phrase: '', expiresAt: 0, status: 'paired' });
      await refreshDevices(identity);
      if (pair?.code === device.id) setPair(null);
      setMessage(`${device.label} との連携を解除しました。ほかのPCには引き続き届きます。`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '連携を解除できませんでした。');
    } finally { setRemovingId(null); }
  };

  const canStart = identityReady && !identityError && (!pair || pair.status === 'paired');
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <Text style={styles.title}>PCと連携</Text>
    <Text style={styles.copy}>PCで `qr.snkisk.com` を開き、「スマホと連携」から表示されるコードを入力します。新しいPCを追加するたび、両方の画面で確認します。</Text>

    <View style={styles.card}>
      <View style={styles.cardHeading}><Text style={styles.label}>接続中のPC</Text><Text style={styles.count}>{devices.length}台</Text></View>
      {devices.length === 0 ? <Text style={styles.status}>まだPCは接続されていません。</Text> : devices.map((device) => <View key={device.id} style={styles.deviceRow}>
        <View style={styles.deviceCopy}><Text style={styles.deviceLabel}>{device.label}</Text><Text style={styles.deviceMeta}>連携: {new Date(device.createdAt).toLocaleDateString('ja-JP')}</Text></View>
        <Pressable accessibilityLabel={`${device.label}との連携を解除`} disabled={removingId === device.id} onPress={() => void removeDevice(device)} style={styles.remove}><Text style={styles.removeText}>{removingId === device.id ? '解除中…' : '解除'}</Text></Pressable>
      </View>)}
    </View>

    {canStart && <View style={styles.card}>
      <Text style={styles.label}>PCを追加する</Text>
      <TextInput autoCapitalize="characters" autoCorrect={false} accessibilityLabel="8文字の連携コード" maxLength={9} onChangeText={setCode} placeholder="AB2C-DE3F" style={styles.input} value={code} />
      <Pressable disabled={!identityReady || identityError || busy || code.replace(/[^a-z0-9]/gi, '').length !== 8} onPress={beginPair} style={styles.primary}><Text style={styles.primaryText}>{!identityReady ? '接続情報を確認中…' : busy ? '確認中…' : 'コードを確認'}</Text></Pressable>
    </View>}

    {pair && pair.status !== 'paired' && <View style={styles.card}>
      <Text style={styles.label}>確認フレーズ</Text>
      <Text style={styles.phrase}>{pair.phrase}</Text>
      <Text style={styles.status}>{message}</Text>
      <Pressable disabled={busy} onPress={approvePair} style={styles.primary}><Text style={styles.primaryText}>{busy ? '確認中…' : 'このスマホで確認する'}</Text></Pressable>
    </View>}

    <Text style={styles.status}>{message}</Text>
    <Pressable onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>スキャン画面へ戻る</Text></Pressable>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 18, padding: 22, backgroundColor: '#F7FAFF' },
  title: { color: '#0D1B3E', fontSize: 31, fontWeight: '800', letterSpacing: -0.6 },
  copy: { color: '#52627C', fontSize: 15, lineHeight: 24 },
  card: { gap: 14, padding: 20, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#B9D1FF', backgroundColor: '#FFFFFF' },
  cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  label: { color: '#52627C', fontSize: 13, fontWeight: '800' }, count: { color: '#1463F3', fontSize: 18, fontWeight: '900' },
  input: { minHeight: 54, borderWidth: 1, borderColor: '#9DBBF0', borderRadius: 12, color: '#0D1B3E', fontSize: 24, fontWeight: '800', letterSpacing: 2, paddingHorizontal: 15, textAlign: 'center' },
  phrase: { color: '#0D1B3E', fontSize: 27, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  status: { color: '#52627C', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#1463F3' }, primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#1463F3' }, secondaryText: { color: '#125EE9', fontSize: 16, fontWeight: '800' },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: '#E4ECFA', paddingTop: 13 }, deviceCopy: { flex: 1, gap: 3 }, deviceLabel: { color: '#0D1B3E', fontSize: 16, fontWeight: '800' }, deviceMeta: { color: '#64738C', fontSize: 12 },
  remove: { minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: '#FFF2F0' }, removeText: { color: '#B42318', fontSize: 13, fontWeight: '800' },
});
