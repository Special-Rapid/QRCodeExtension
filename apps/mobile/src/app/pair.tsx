import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { claimPair, confirmPair, getPairStatus, loadCredential, revokePair, type PairCredential } from '../lib/handoff';

export default function PairScreen() {
  const [code, setCode] = useState('');
  const [pair, setPair] = useState<PairCredential | null>(null);
  const [message, setMessage] = useState('PCで表示した8文字の連携コードを入力してください。');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    loadCredential().then((credential) => {
      if (credential?.status === 'paired') {
        setPair(credential);
        setMessage('このスマホはPCと連携済みです。');
      }
    });
  }, []);

  useEffect(() => {
    if (!pair) return;
    const timer = setInterval(async () => {
      try {
        const current = await getPairStatus(pair);
        if (current.status === 'revoked' || current.status === 'expired') {
          setPair(null);
          setMessage(current.status === 'revoked' ? 'PC側で連携が解除されました。' : '連携コードの有効期限が切れました。');
          return;
        }
        setPair(current);
        if (current.status === 'paired') setMessage('PCとの連携が完了しました。');
      } catch { /* The primary action keeps a visible recovery path. */ }
    }, 1800);
    return () => clearInterval(timer);
  }, [pair]);

  const beginPair = async () => {
    setBusy(true);
    try {
      const credential = await claimPair(code, 'このスマホ');
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
      setMessage(response.status === 'paired' ? 'PCとの連携が完了しました。' : 'PC側の確認を待っています。');
      if (response.status === 'paired') setPair({ ...pair, status: 'paired' });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '確認を完了できませんでした。');
    } finally { setBusy(false); }
  };

  const disconnect = async () => {
    if (!pair) return;
    setBusy(true);
    try {
      await revokePair(pair);
      setPair(null);
      setCode('');
      setMessage('PCとの連携を解除しました。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '連携を解除できませんでした。');
    } finally { setBusy(false); }
  };

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <Text style={styles.title}>PCと連携</Text>
      <Text style={styles.copy}>PCで `qr.snkisk.com` を開き、「スマホと連携」から表示されるコードを入力します。コードだけでは連携されず、両方の画面で確認が必要です。</Text>

      {!pair && <View style={styles.card}>
        <Text style={styles.label}>連携コード</Text>
        <TextInput autoCapitalize="characters" autoCorrect={false} accessibilityLabel="8文字の連携コード" maxLength={9} onChangeText={setCode} placeholder="AB2C-DE3F" style={styles.input} value={code} />
        <Pressable disabled={busy || code.replace(/[^a-z0-9]/gi, '').length !== 8} onPress={beginPair} style={styles.primary}><Text style={styles.primaryText}>{busy ? '確認中…' : 'コードを確認'}</Text></Pressable>
      </View>}

      {pair && <View style={styles.card}>
        <Text style={styles.label}>確認フレーズ</Text>
        <Text style={styles.phrase}>{pair.phrase}</Text>
        <Text style={styles.status}>{message}</Text>
        {pair.status !== 'paired' && <Pressable disabled={busy} onPress={approvePair} style={styles.primary}><Text style={styles.primaryText}>{busy ? '確認中…' : 'このスマホで確認する'}</Text></Pressable>}
        {pair.status === 'paired' && <><Pressable onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>スキャン画面へ戻る</Text></Pressable><Pressable disabled={busy} onPress={disconnect} style={styles.disconnect}><Text style={styles.disconnectText}>{busy ? '解除中…' : 'このスマホとの連携を解除'}</Text></Pressable></>}
      </View>}

      {!pair && <Text style={styles.status}>{message}</Text>}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, gap: 18, padding: 22, backgroundColor: '#F7FAFF' },
  title: { color: '#0D1B3E', fontSize: 31, fontWeight: '800', letterSpacing: -0.6 },
  copy: { color: '#52627C', fontSize: 15, lineHeight: 24 },
  card: { gap: 14, padding: 20, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: '#B9D1FF', backgroundColor: '#FFFFFF' },
  label: { color: '#52627C', fontSize: 13, fontWeight: '800' },
  input: { minHeight: 54, borderWidth: 1, borderColor: '#9DBBF0', borderRadius: 12, color: '#0D1B3E', fontSize: 24, fontWeight: '800', letterSpacing: 2, paddingHorizontal: 15, textAlign: 'center' },
  phrase: { color: '#0D1B3E', fontSize: 27, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
  status: { color: '#52627C', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#1463F3' },
  primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#1463F3' },
  secondaryText: { color: '#125EE9', fontSize: 16, fontWeight: '800' },
  disconnect: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  disconnectText: { color: '#B42318', fontSize: 15, fontWeight: '700' },
});
