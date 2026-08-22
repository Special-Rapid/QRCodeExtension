import { CameraView, type BarcodeScanningResult, type BarcodeType, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useRef, useState } from 'react';
import { type GestureResponderEvent, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

type ScanResult = {
  data: string;
  type: string;
};

const barcodeTypes: BarcodeType[] = ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'pdf417', 'aztec', 'datamatrix'];

function clampZoom(value: number) {
  return Math.max(0, Math.min(1, Number(value.toFixed(2))));
}

function touchDistance(event: GestureResponderEvent) {
  const [first, second] = event.nativeEvent.touches;
  if (!first || !second) return null;
  return Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY);
}

function toHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null;
  } catch {
    return null;
  }
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [notice, setNotice] = useState('カメラを向けると、QRコードとバーコードを自動で読み取ります。');
  const scanLocked = useRef(false);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);

  const startPinch = (event: GestureResponderEvent) => {
    const distance = touchDistance(event);
    if (distance) pinch.current = { distance, zoom };
  };

  const movePinch = (event: GestureResponderEvent) => {
    const distance = touchDistance(event);
    if (!distance || !pinch.current) return;
    setZoom(clampZoom(pinch.current.zoom + (distance - pinch.current.distance) / 300));
  };

  const endPinch = (event: GestureResponderEvent) => {
    if (event.nativeEvent.touches.length < 2) pinch.current = null;
  };

  const scanAgain = () => {
    scanLocked.current = false;
    setResult(null);
    setNotice('カメラを向けると、QRコードとバーコードを自動で読み取ります。');
  };

  const onBarcodeScanned = async (scan: BarcodeScanningResult) => {
    if (scanLocked.current) return;
    scanLocked.current = true;
    setResult({ data: scan.data, type: scan.type });
    setNotice(`${scan.type.toUpperCase()} を読み取りました。`);
    if (process.env.EXPO_OS !== 'web') await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  };

  const copyResult = async () => {
    if (!result) return;
    await Clipboard.setStringAsync(result.data);
    setNotice('読み取り結果をコピーしました。');
  };

  const openResult = async () => {
    const url = result ? toHttpUrl(result.data) : null;
    if (!url) return;
    await Linking.openURL(url.toString());
  };

  if (!permission) {
    return <View style={styles.center}><Text style={styles.loadingText}>カメラを準備しています…</Text></View>;
  }

  if (!permission.granted) {
    const permanentlyDenied = !permission.canAskAgain;
    return (
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.permissionContainer}>
        <Text style={styles.permissionTitle}>カメラへのアクセスが必要です</Text>
        <Text selectable style={styles.permissionBody}>QRコードとバーコードをこの端末内で読み取るためにだけ使用します。画像は送信しません。</Text>
        {permanentlyDenied && <Text selectable style={styles.permissionBody}>カメラを許可するには、端末の設定でこのアプリのカメラアクセスをオンにしてください。</Text>}
        <Pressable style={styles.primaryButton} onPress={permanentlyDenied ? Linking.openSettings : requestPermission}>
          <Text style={styles.primaryButtonText}>{permanentlyDenied ? '設定を開く' : 'カメラを許可'}</Text>
        </Pressable>
      </ScrollView>
    );
  }

  const url = result ? toHttpUrl(result.data) : null;
  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
      <View
        accessible
        accessibilityLabel="カメラプレビュー。二本指でズームできます。"
        style={styles.cameraFrame}
        onTouchStart={startPinch}
        onTouchMove={movePinch}
        onTouchEnd={endPinch}
        onTouchCancel={endPinch}
      >
        <CameraView
          facing="back"
          enableTorch={torch}
          zoom={zoom}
          barcodeScannerSettings={{ barcodeTypes }}
          onBarcodeScanned={result ? undefined : onBarcodeScanned}
          style={StyleSheet.absoluteFill}
        />
        <View pointerEvents="none" style={styles.viewfinder} />
        <View style={styles.cameraControls}>
          <Pressable style={styles.iconButton} onPress={() => setTorch((value) => !value)}>
            <Text style={styles.iconButtonText}>{torch ? 'ライト ON' : 'ライト'}</Text>
          </Pressable>
        </View>
        <View style={styles.zoomControls}>
          <Pressable accessibilityLabel="ズームアウト" style={styles.zoomButton} onPress={() => setZoom((value) => clampZoom(value - 0.1))}>
            <Text style={styles.zoomButtonText}>−</Text>
          </Pressable>
          <Text selectable style={styles.zoomText}>{Math.round((1 + zoom * 4) * 10) / 10}×</Text>
          <Pressable accessibilityLabel="ズームイン" style={styles.zoomButton} onPress={() => setZoom((value) => clampZoom(value + 0.1))}>
            <Text style={styles.zoomButtonText}>＋</Text>
          </Pressable>
        </View>
      </View>

      <Text selectable style={styles.notice}>{notice}</Text>

      {result && (
        <View style={styles.resultCard}>
          <Text style={styles.eyebrow}>読み取り結果</Text>
          {url && <Text selectable style={styles.host}>{url.host}</Text>}
          <Text selectable style={styles.value}>{result.data}</Text>
          <View style={styles.actionRow}>
            {url && (
              <Pressable style={styles.primaryAction} onPress={openResult}>
                <Text style={styles.primaryButtonText}>リンクを開く</Text>
              </Pressable>
            )}
            <Pressable style={url ? styles.secondaryAction : styles.fullAction} onPress={copyResult}>
              <Text style={styles.secondaryActionText}>コピー</Text>
            </Pressable>
          </View>
          <Pressable style={styles.scanAgain} onPress={scanAgain}>
            <Text style={styles.scanAgainText}>続けてスキャン</Text>
          </Pressable>
        </View>
      )}

      <Text selectable style={styles.privacy}>PCへの送信・通知連携は、ペアリング機能の提供後に有効になります。</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F7FAFF' },
  loadingText: { color: '#52627C', fontSize: 16 },
  permissionContainer: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: '#F7FAFF' },
  permissionTitle: { color: '#0D1B3E', fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  permissionBody: { color: '#52627C', fontSize: 16, lineHeight: 25 },
  content: { padding: 18, gap: 14, backgroundColor: '#F7FAFF' },
  cameraFrame: { height: 460, overflow: 'hidden', borderRadius: 24, borderCurve: 'continuous', backgroundColor: '#071B41' },
  viewfinder: { position: 'absolute', top: '24%', left: '14%', right: '14%', bottom: '24%', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 18, borderCurve: 'continuous' },
  cameraControls: { position: 'absolute', top: 14, right: 14 },
  iconButton: { minHeight: 40, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(7, 27, 65, .78)' },
  iconButtonText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  zoomControls: { position: 'absolute', bottom: 16, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 14, padding: 8, borderRadius: 24, borderCurve: 'continuous', backgroundColor: 'rgba(7, 27, 65, .78)' },
  zoomButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, borderCurve: 'continuous', backgroundColor: '#FFFFFF' },
  zoomButtonText: { color: '#071B41', fontSize: 25, fontWeight: '700', lineHeight: 28 },
  zoomText: { minWidth: 42, color: '#FFFFFF', fontSize: 16, fontWeight: '700', textAlign: 'center', fontVariant: ['tabular-nums'] },
  notice: { color: '#52627C', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  resultCard: { gap: 10, padding: 18, borderRadius: 20, borderCurve: 'continuous', borderWidth: 1, borderColor: '#B9D1FF', backgroundColor: '#FFFFFF', boxShadow: '0 1px 2px rgba(13, 27, 62, .08)' },
  eyebrow: { color: '#1463F3', fontSize: 13, fontWeight: '800' },
  host: { color: '#0D1B3E', fontSize: 18, fontWeight: '800' },
  value: { color: '#17233B', fontSize: 14, lineHeight: 20, fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace' },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  primaryAction: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#1463F3' },
  secondaryAction: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#1463F3', backgroundColor: '#FFFFFF' },
  fullAction: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: '#1463F3', backgroundColor: '#FFFFFF' },
  primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderCurve: 'continuous', backgroundColor: '#1463F3' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
  secondaryActionText: { color: '#125EE9', fontSize: 16, fontWeight: '800' },
  scanAgain: { minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  scanAgainText: { color: '#125EE9', fontSize: 15, fontWeight: '700' },
  privacy: { color: '#64738C', fontSize: 12, lineHeight: 18, textAlign: 'center', paddingHorizontal: 10 },
});
