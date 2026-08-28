import { CameraView, type BarcodeScanningResult, type BarcodeType, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { type GestureResponderEvent, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getPairStatus, loadCredential, sendHandoff } from '../lib/handoff';

type ScanResult = { data: string; type: string };
type DeliveryState = 'idle' | 'sending' | 'sent' | 'failed' | 'not_paired';

const barcodeTypes: BarcodeType[] = ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'pdf417', 'aztec', 'datamatrix'];
const zoomPresets = [{ label: '5×', value: 1 }, { label: '3×', value: 0.5 }, { label: '1×', value: 0 }];

function clampZoom(value: number) { return Math.max(0, Math.min(1, Number(value.toFixed(2)))); }
function zoomLabel(zoom: number) { return `${Math.round((1 + zoom * 4) * 10) / 10}×`; }
function touchDistance(event: GestureResponderEvent) {
  const [first, second] = event.nativeEvent.touches;
  return first && second ? Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY) : null;
}
function toHttpUrl(value: string) {
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url : null; } catch { return null; }
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [paired, setPaired] = useState(false);
  const [pairingReady, setPairingReady] = useState(false);
  const [delivery, setDelivery] = useState<DeliveryState>('idle');
  const [actionNotice, setActionNotice] = useState('');
  const scanLocked = useRef(false);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const insets = useSafeAreaInsets();

  useFocusEffect(useCallback(() => {
    let active = true;
    setPairingReady(false);
    void (async () => {
      try {
        const credential = await loadCredential();
        if (!credential) { if (active) setPaired(false); return; }
        const current = await getPairStatus(credential);
        if (active) setPaired(current.status === 'paired');
      } catch { if (active) setPaired(false); }
      finally { if (active) setPairingReady(true); }
    })();
    return () => { active = false; };
  }, []));

  const startPinch = (event: GestureResponderEvent) => {
    const distance = touchDistance(event);
    if (distance) pinch.current = { distance, zoom };
  };
  const movePinch = (event: GestureResponderEvent) => {
    const distance = touchDistance(event);
    if (!distance || !pinch.current) return;
    setZoom(clampZoom(pinch.current.zoom + (distance - pinch.current.distance) / 300));
  };
  const endPinch = (event: GestureResponderEvent) => { if (event.nativeEvent.touches.length < 2) pinch.current = null; };

  const scanAgain = () => { scanLocked.current = false; setResult(null); setDelivery('idle'); setActionNotice(''); };
  const sendScannedValue = async (data: string) => {
    if (!paired) return setDelivery('not_paired');
    setDelivery('sending');
    try { await sendHandoff(data); setDelivery('sent'); }
    catch (error) {
      if (error instanceof Error && ['unauthorized', 'not_paired'].includes((error as { code?: string }).code ?? '')) setPaired(false);
      setDelivery('failed');
      setActionNotice(error instanceof Error ? error.message : 'PCへ送信できませんでした。');
    }
  };
  const onBarcodeScanned = (scan: BarcodeScanningResult) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    setResult({ data: scan.data, type: scan.type });
    setActionNotice('');
    if (process.env.EXPO_OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    void sendScannedValue(scan.data);
  };
  const copyResult = async () => { if (!result) return; await Clipboard.setStringAsync(result.data); setActionNotice('コピーしました。'); };
  const openResult = async () => { const url = result ? toHttpUrl(result.data) : null; if (url) await Linking.openURL(url.toString()); };

  if (!permission) return <View style={styles.center}><Text style={styles.loadingText}>カメラを準備しています…</Text></View>;
  if (!permission.granted) {
    const permanentlyDenied = !permission.canAskAgain;
    return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.permissionContainer}>
      <Text style={styles.permissionTitle}>カメラへのアクセスが必要です</Text>
      <Text selectable style={styles.permissionBody}>QRコードとバーコードをこの端末内で読み取るためにだけ使用します。画像は送信しません。</Text>
      {permanentlyDenied && <Text selectable style={styles.permissionBody}>カメラを許可するには、端末の設定でこのアプリのカメラアクセスをオンにしてください。</Text>}
      <Pressable style={styles.primaryButton} onPress={permanentlyDenied ? Linking.openSettings : requestPermission}><Text style={styles.primaryButtonText}>{permanentlyDenied ? '設定を開く' : 'カメラを許可'}</Text></Pressable>
    </ScrollView>;
  }

  const url = result ? toHttpUrl(result.data) : null;
  const deliveryCopy = { idle: pairingReady ? paired ? 'PCへ自動送信' : 'PC未連携' : 'PC状態を確認中…', sending: 'PCへ送信中…', sent: 'PCへ送信済み', failed: '送信できませんでした', not_paired: 'PC連携で自動送信' }[delivery];
  return <View
    style={styles.screen}
    onTouchStart={startPinch}
    onTouchMove={movePinch}
    onTouchEnd={endPinch}
    onTouchCancel={endPinch}>
    <CameraView facing="back" enableTorch={torch} zoom={zoom} barcodeScannerSettings={{ barcodeTypes }} onBarcodeScanned={result || !pairingReady ? undefined : onBarcodeScanned} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={styles.cameraTint} />
    <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
      <View><Text style={styles.brand}>QR Scan</Text><Text style={styles.deliveryPill}>{result ? deliveryCopy : paired ? 'PCに自動送信' : 'PCと連携して使う'}</Text></View>
      <View style={styles.topActions}>
        <Pressable accessibilityLabel="ライト" style={styles.topAction} onPress={() => setTorch((value) => !value)}><Text style={styles.topActionText}>{torch ? '☀' : '◐'}</Text></Pressable>
        <Pressable accessibilityLabel="PC連携設定" style={styles.topAction} onPress={() => router.push('/pair')}><Text style={styles.topActionText}>PC</Text></Pressable>
      </View>
    </View>
    <View pointerEvents="none" style={styles.viewfinder}>
      <View style={[styles.corner, styles.cornerTopLeft]} /><View style={[styles.corner, styles.cornerTopRight]} />
      <View style={[styles.corner, styles.cornerBottomLeft]} /><View style={[styles.corner, styles.cornerBottomRight]} />
    </View>
    <View style={[styles.zoomRail, { top: insets.top + 186 }]}>
      {zoomPresets.map((preset) => <Pressable key={preset.label} accessibilityLabel={`${preset.label}にズーム`} style={styles.zoomPreset} onPress={() => setZoom(preset.value)}><Text style={[styles.zoomPresetText, Math.abs(zoom - preset.value) < 0.08 && styles.zoomPresetTextActive]}>{preset.label}</Text></Pressable>)}
      <View style={styles.zoomTrack}><View style={[styles.zoomThumb, { bottom: `${zoom * 100}%` }]} /></View>
      <Text selectable style={styles.currentZoom}>{zoomLabel(zoom)}</Text>
    </View>
    {!result && <View style={[styles.scanHint, { paddingBottom: Math.max(insets.bottom, 16) }]}><Text style={styles.scanHintText}>{pairingReady ? '枠に合わせると、自動でPCへ届けます' : 'PC連携の状態を確認しています…'}</Text></View>}
    {result && <View style={[styles.resultOverlay, { paddingBottom: Math.max(insets.bottom, 16) }]}><View style={styles.resultCard}>
      <View style={styles.resultHeader}><View style={[styles.deliveryDot, delivery === 'sent' && styles.deliveryDotSent, delivery === 'failed' && styles.deliveryDotFailed]} /><Text selectable style={styles.deliveryText}>{deliveryCopy}</Text><Pressable style={styles.scanAgain} onPress={scanAgain}><Text style={styles.scanAgainText}>続けて</Text></Pressable></View>
      {url && <Text selectable numberOfLines={1} style={styles.host}>{url.host}</Text>}
      <Text selectable numberOfLines={2} style={styles.value}>{result.data}</Text>
      {actionNotice ? <Text selectable numberOfLines={2} style={styles.actionNotice}>{actionNotice}</Text> : null}
      <View style={styles.resultActions}>
        {url && <Pressable style={styles.openAction} onPress={openResult}><Text style={styles.openActionText}>開く</Text></Pressable>}
        <Pressable style={styles.copyAction} onPress={copyResult}><Text style={styles.copyActionText}>コピー</Text></Pressable>
        {delivery === 'not_paired' && <Pressable style={styles.pairAction} onPress={() => router.push('/pair')}><Text style={styles.copyActionText}>PC連携</Text></Pressable>}
      </View>
    </View></View>}
  </View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, overflow: 'hidden', backgroundColor: '#06142D' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#071B41' }, loadingText: { color: '#DCE8FF', fontSize: 16 },
  permissionContainer: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#F7FAFF' }, permissionTitle: { color: '#0D1B3E', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 }, permissionBody: { color: '#52627C', fontSize: 16, lineHeight: 25 },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#1463F3' }, primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  cameraTint: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(2, 10, 25, .18)' }, topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20 },
  brand: { color: '#FFFFFF', fontSize: 27, fontWeight: '800', letterSpacing: -0.8, textShadowColor: 'rgba(0, 0, 0, .45)', textShadowRadius: 8 }, deliveryPill: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(5, 20, 52, .72)', color: '#AFCBFF', fontSize: 12, fontWeight: '800' },
  topActions: { flexDirection: 'row', gap: 9 }, topAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: 'rgba(203, 223, 255, .36)', borderRadius: 22, backgroundColor: 'rgba(5, 20, 52, .76)' }, topActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  viewfinder: { position: 'absolute', top: '26%', left: '12%', right: '18%', bottom: '31%' }, corner: { position: 'absolute', width: 38, height: 38, borderColor: '#FFFFFF', borderRadius: 8, borderCurve: 'continuous' }, cornerTopLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 }, cornerTopRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 }, cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 }, cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
  zoomRail: { position: 'absolute', right: 16, alignItems: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: 'rgba(166, 199, 255, .25)', borderRadius: 22, backgroundColor: 'rgba(4, 18, 47, .72)' }, zoomPreset: { width: 38, minHeight: 28, alignItems: 'center', justifyContent: 'center' }, zoomPresetText: { color: '#B9CAE9', fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] }, zoomPresetTextActive: { color: '#FFFFFF', fontSize: 12, fontWeight: '900' }, zoomTrack: { width: 2, height: 72, borderRadius: 2, backgroundColor: 'rgba(255, 255, 255, .36)', overflow: 'visible' }, zoomThumb: { position: 'absolute', left: -5, width: 12, height: 12, borderRadius: 6, backgroundColor: '#4C91FF', borderWidth: 2, borderColor: '#DCEBFF' }, currentZoom: { color: '#FFFFFF', fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
  scanHint: { position: 'absolute', left: 24, right: 90, bottom: 18, alignItems: 'flex-start' }, scanHintText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0, 0, 0, .65)', textShadowRadius: 7 },
  resultOverlay: { position: 'absolute', left: 16, right: 16, bottom: 0 }, resultCard: { gap: 9, padding: 15, borderWidth: 1, borderColor: 'rgba(185, 209, 255, .44)', borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(5, 18, 46, .94)', boxShadow: '0 12px 32px rgba(0, 0, 0, .3)' }, resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 }, deliveryDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#9AA9C1' }, deliveryDotSent: { backgroundColor: '#46D58E' }, deliveryDotFailed: { backgroundColor: '#FF7777' }, deliveryText: { flex: 1, color: '#C8D8F4', fontSize: 13, fontWeight: '800' }, scanAgain: { minHeight: 32, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }, scanAgainText: { color: '#8CB9FF', fontSize: 13, fontWeight: '800' }, host: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' }, value: { color: '#D4DEF1', fontSize: 13, lineHeight: 18, fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace' }, actionNotice: { color: '#FFB0B0', fontSize: 12, lineHeight: 17 }, resultActions: { flexDirection: 'row', gap: 9, marginTop: 2 }, openAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#2476F3' }, openActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, copyAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#789ED6', borderRadius: 12, borderCurve: 'continuous' }, copyActionText: { color: '#CFE1FF', fontSize: 14, fontWeight: '900' }, pairAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#789ED6', borderRadius: 12, borderCurve: 'continuous' },
});
