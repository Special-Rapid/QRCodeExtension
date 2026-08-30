import { CameraView, type BarcodeScanningResult, type BarcodeType, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { type GestureResponderEvent, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isOcrAvailable, recognizeUrlText } from '../../modules/qr-scan-ocr';
import { canCommitDetection, nextDetectionEpoch } from '../lib/detection-coordinator';
import { getHandoffReceipt, getMobileDevices, loadMobileIdentity, refreshMobileIdentityLabel, sendHandoff, type HandoffTarget } from '../lib/handoff';
import { candidateSignature, collectBarcodeCandidates, collectOcrUrlCandidates, toHttpUrl, type ScanCandidate } from '../lib/scan-candidates';

type DeliveryState = 'idle' | 'sending' | 'waiting' | 'sent' | 'expired' | 'failed' | 'not_paired';
type ScannerPhase = 'ready' | 'acquiring' | 'picking' | 'result';
type CapturedFrame = { width: number; height: number };

const barcodeTypes: BarcodeType[] = ['qr', 'ean13', 'ean8', 'code128', 'code39', 'upc_a', 'upc_e', 'pdf417', 'aztec', 'datamatrix'];
const zoomPresets = [{ label: '5×', value: 1 }, { label: '3×', value: 0.5 }, { label: '1×', value: 0 }];

function clampZoom(value: number) { return Math.max(0, Math.min(1, Number(value.toFixed(2)))); }
function zoomLabel(zoom: number) { return `${Math.round((1 + zoom * 4) * 10) / 10}×`; }
function touchDistance(event: GestureResponderEvent) {
  const [first, second] = event.nativeEvent.touches;
  return first && second ? Math.hypot(second.pageX - first.pageX, second.pageY - first.pageY) : null;
}
function markerPosition(candidate: ScanCandidate, frame: CapturedFrame | null, viewport: { width: number; height: number }) {
  if (!candidate.bounds) return null;
  if (candidate.type === 'barcode' || !frame) return { x: candidate.bounds.x, y: candidate.bounds.y };
  const scale = Math.max(viewport.width / frame.width, viewport.height / frame.height);
  const offsetX = (viewport.width - frame.width * scale) / 2;
  const offsetY = (viewport.height - frame.height * scale) / 2;
  return { x: offsetX + candidate.bounds.x * scale, y: offsetY + candidate.bounds.y * scale };
}

export default function ScannerScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [zoom, setZoom] = useState(0);
  const [torch, setTorch] = useState(false);
  const [phase, setPhase] = useState<ScannerPhase>('ready');
  const [result, setResult] = useState<ScanCandidate | null>(null);
  const [candidates, setCandidates] = useState<ScanCandidate[]>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | null>(null);
  const [capturedFrame, setCapturedFrame] = useState<CapturedFrame | null>(null);
  const [paired, setPaired] = useState(false);
  const [pairingReady, setPairingReady] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraSession, setCameraSession] = useState(0);
  const [delivery, setDelivery] = useState<DeliveryState>('idle');
  const [actionNotice, setActionNotice] = useState('');
  const scanLocked = useRef(false);
  const cameraRef = useRef<CameraView | null>(null);
  const acquisition = useRef<{ scans: BarcodeScanningResult[]; timer: ReturnType<typeof setTimeout>; generation: number; detectionEpoch: number } | null>(null);
  const autoDeliveryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const receiptTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveOcrTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const liveOcrBusy = useRef(false);
  const liveOcrSignature = useRef<string | null>(null);
  const liveOcrMatches = useRef(0);
  const phaseRef = useRef<ScannerPhase>('ready');
  const detectionEpoch = useRef(0);
  const scanGeneration = useRef(0);
  const pinch = useRef<{ distance: number; zoom: number } | null>(null);
  const insets = useSafeAreaInsets();
  const viewport = useWindowDimensions();

  const clearScanTimers = () => {
    if (acquisition.current) clearTimeout(acquisition.current.timer);
    acquisition.current = null;
    if (autoDeliveryTimer.current) clearTimeout(autoDeliveryTimer.current);
    autoDeliveryTimer.current = null;
    if (receiptTimer.current) clearTimeout(receiptTimer.current);
    receiptTimer.current = null;
    if (liveOcrTimer.current) clearTimeout(liveOcrTimer.current);
    liveOcrTimer.current = null;
    liveOcrSignature.current = null;
    liveOcrMatches.current = 0;
  };

  useEffect(() => { phaseRef.current = phase; }, [phase]);

  useEffect(() => () => {
    scanGeneration.current += 1;
    clearScanTimers();
  }, []);

  useFocusEffect(useCallback(() => {
    let active = true;
    setPairingReady(false);
    void (async () => {
      try {
        const storedIdentity = await loadMobileIdentity();
        const identity = storedIdentity ? await refreshMobileIdentityLabel(storedIdentity).catch(() => storedIdentity) : null;
        if (!identity) { if (active) setPaired(false); return; }
        const { deviceCount } = await getMobileDevices(identity);
        if (active) setPaired(deviceCount > 0);
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

  const scanAgain = (notice = '') => {
    scanGeneration.current += 1;
    detectionEpoch.current = nextDetectionEpoch(detectionEpoch.current);
    clearScanTimers();
    scanLocked.current = true;
    setCameraReady(false);
    setResult(null);
    setCandidates([]);
    setSelectedCandidateId(null);
    setCapturedFrame(null);
    setPhase('ready');
    setDelivery('idle');
    setActionNotice(notice);
    setCameraSession((value) => value + 1);
  };
  const pollHandoffReceipt = async (handoffs: HandoffTarget[], generation: number) => {
    if (generation !== scanGeneration.current) return;
    try {
      const receipt = await getHandoffReceipt(handoffs);
      if (generation !== scanGeneration.current) return;
      if (receipt.total > 0 && receipt.acknowledged === receipt.total) {
        setDelivery('sent');
        setActionNotice(`${receipt.total}台のPCが受領を確認しました。`);
        return;
      }
      if (receipt.expired > 0) {
        setDelivery('expired');
        setActionNotice(`${receipt.acknowledged} / ${receipt.total}台のPCが受領を確認しました。未確認の送信先は期限切れです。`);
        return;
      }
      setDelivery('waiting');
      setActionNotice(`${receipt.acknowledged} / ${receipt.total}台のPCが受領を確認中です。`);
      receiptTimer.current = setTimeout(() => { void pollHandoffReceipt(handoffs, generation); }, 1_000);
    } catch (error) {
      if (generation !== scanGeneration.current) return;
      const code = error instanceof Error ? (error as { code?: string }).code : '';
      if (code === 'unauthorized' || code === 'not_paired') setPaired(false);
      setDelivery('waiting');
      setActionNotice('PCの受領状態を再確認しています…');
      receiptTimer.current = setTimeout(() => { void pollHandoffReceipt(handoffs, generation); }, 3_000);
    }
  };

  const sendCandidate = async (candidate: ScanCandidate, generation = scanGeneration.current) => {
    if (generation !== scanGeneration.current) return;
    if (!paired) {
      if (generation === scanGeneration.current) setDelivery('not_paired');
      return;
    }
    setDelivery('sending');
    try {
      const response = await sendHandoff(candidate.data);
      if (generation !== scanGeneration.current) return;
      setDelivery('waiting');
      setActionNotice(`0 / ${response.total}台のPCが受領を確認中です。`);
      void pollHandoffReceipt(response.handoffs, generation);
    }
    catch (error) {
      if (generation !== scanGeneration.current) return;
      if (error instanceof Error && ['unauthorized', 'not_paired'].includes((error as { code?: string }).code ?? '')) setPaired(false);
      setDelivery('failed');
      setActionNotice(error instanceof Error ? error.message : 'PCへ送信できませんでした。');
    }
  };

  const freezePreview = useCallback(async () => {
    if (process.env.EXPO_OS !== 'web') await cameraRef.current?.pausePreview().catch(() => undefined);
  }, []);

  const beginPicker = useCallback(async (nextCandidates: ScanCandidate[], frame: CapturedFrame | null, generation: number) => {
    if (generation !== scanGeneration.current) return false;
    await freezePreview();
    if (generation !== scanGeneration.current) return false;
    setCapturedFrame(frame);
    setCandidates(nextCandidates);
    setSelectedCandidateId(nextCandidates[0]?.id ?? null);
    setPhase('picking');
    setActionNotice('候補を選んでからPCへ届けます。');
    if (process.env.EXPO_OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  }, [freezePreview]);

  const finalizeBarcodeAcquisition = async (generation: number) => {
    const activeAcquisition = acquisition.current;
    if (!activeAcquisition || activeAcquisition.generation !== generation || generation !== scanGeneration.current || !canCommitDetection({ claimEpoch: activeAcquisition.detectionEpoch, currentEpoch: detectionEpoch.current, phase: phaseRef.current, expectedPhase: 'acquiring', locked: scanLocked.current })) return;
    const scans = activeAcquisition.scans;
    acquisition.current = null;
    scanLocked.current = true;
    const nextCandidates = collectBarcodeCandidates(scans);
    if (nextCandidates.length === 0) {
      scanLocked.current = false;
      setPhase('ready');
      return;
    }
    if (nextCandidates.length > 1) {
      await beginPicker(nextCandidates, null, generation);
      return;
    }
    await freezePreview();
    if (generation !== scanGeneration.current) return;
    const candidate = nextCandidates[0];
    setResult(candidate);
    setPhase('result');
    setActionNotice('この結果をPCへ送ります。続けてで取り消せます。');
    if (process.env.EXPO_OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    autoDeliveryTimer.current = setTimeout(() => {
      if (generation === scanGeneration.current) void sendCandidate(candidate, generation);
    }, 500);
  };

  const onBarcodeScanned = (scan: BarcodeScanningResult) => {
    if (scanLocked.current || !['ready', 'acquiring'].includes(phase)) return;
    if (!acquisition.current) {
      const generation = scanGeneration.current;
      const nextEpoch = nextDetectionEpoch(detectionEpoch.current);
      detectionEpoch.current = nextEpoch;
      const timer = setTimeout(() => { void finalizeBarcodeAcquisition(generation); }, 600);
      acquisition.current = { scans: [], timer, generation, detectionEpoch: nextEpoch };
      setPhase('acquiring');
      setActionNotice('候補を確認しています…');
    }
    acquisition.current.scans.push(scan);
  };

  useEffect(() => {
    if (!cameraReady || !pairingReady || phase !== 'ready' || !isOcrAvailable()) return;
    let active = true;
    const schedule = (delay: number) => {
      if (!active) return;
      liveOcrTimer.current = setTimeout(() => { void scanLiveText(); }, delay);
    };
    const scanLiveText = async () => {
      if (!active || scanLocked.current || phaseRef.current !== 'ready') return;
      if (liveOcrBusy.current) {
        schedule(250);
        return;
      }
      const generation = scanGeneration.current;
      const snapshotEpoch = detectionEpoch.current;
      liveOcrBusy.current = true;
      let snapshotUri: string | null = null;
      try {
        const picture = await cameraRef.current?.takePictureAsync({ quality: 0.45, shutterSound: false });
        snapshotUri = picture?.uri ?? null;
        if (!picture || !active || generation !== scanGeneration.current || !canCommitDetection({ claimEpoch: snapshotEpoch, currentEpoch: detectionEpoch.current, phase: phaseRef.current, expectedPhase: 'ready', locked: scanLocked.current })) return;
        const recognition = await recognizeUrlText(picture.uri);
        if (!active || generation !== scanGeneration.current || !canCommitDetection({ claimEpoch: snapshotEpoch, currentEpoch: detectionEpoch.current, phase: phaseRef.current, expectedPhase: 'ready', locked: scanLocked.current })) return;
        const nextCandidates = collectOcrUrlCandidates(recognition.blocks);
        const signature = candidateSignature(nextCandidates);
        if (!signature) {
          liveOcrSignature.current = null;
          liveOcrMatches.current = 0;
          return;
        }
        liveOcrMatches.current = liveOcrSignature.current === signature ? liveOcrMatches.current + 1 : 1;
        liveOcrSignature.current = signature;
        if (liveOcrMatches.current < 2) return;
        detectionEpoch.current = nextDetectionEpoch(detectionEpoch.current);
        scanLocked.current = true;
        await beginPicker(nextCandidates, { width: recognition.width, height: recognition.height }, generation);
      } catch {
        // A transient preview frame failure must not interrupt QR scanning.
      } finally {
        if (snapshotUri) {
          try { new File(snapshotUri).delete(); } catch { /* cache cleanup is best effort */ }
        }
        liveOcrBusy.current = false;
        if (active && generation === scanGeneration.current && !scanLocked.current && phaseRef.current === 'ready') schedule(650);
      }
    };
    schedule(450);
    return () => {
      active = false;
      if (liveOcrTimer.current) clearTimeout(liveOcrTimer.current);
      liveOcrTimer.current = null;
    };
  }, [beginPicker, cameraReady, cameraSession, pairingReady, phase]);

  const selectedCandidate = candidates.find((candidate) => candidate.id === selectedCandidateId) ?? null;
  const displayCandidate = result ?? selectedCandidate;
  const copyCandidate = async (candidate: ScanCandidate | null) => {
    if (!candidate) return;
    await Clipboard.setStringAsync(candidate.data);
    setActionNotice('コピーしました。');
  };
  const openCandidate = async (candidate: ScanCandidate | null) => {
    const url = candidate?.url ? toHttpUrl(candidate.url) : candidate ? toHttpUrl(candidate.data) : null;
    if (url) await Linking.openURL(url.toString());
  };
  const deliverSelectedCandidate = () => {
    if (!selectedCandidate) return;
    setResult(selectedCandidate);
    setCandidates([]);
    setPhase('result');
    setActionNotice('PCへ送信しています…');
    void sendCandidate(selectedCandidate, scanGeneration.current);
  };
  if (!permission) return <View style={styles.center}><Text style={styles.loadingText}>カメラを準備しています…</Text></View>;
  if (!permission.granted) {
    const permanentlyDenied = !permission.canAskAgain;
    return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.permissionContainer}>
      <Text style={styles.permissionTitle}>カメラへのアクセスが必要です</Text>
      <Text selectable style={styles.permissionBody}>QRコード・バーコード・印刷URLをこの端末内で読み取るためにだけ使用します。画像は送信しません。</Text>
      {permanentlyDenied && <Text selectable style={styles.permissionBody}>カメラを許可するには、端末の設定でこのアプリのカメラアクセスをオンにしてください。</Text>}
      <Pressable style={styles.primaryButton} onPress={permanentlyDenied ? Linking.openSettings : requestPermission}><Text style={styles.primaryButtonText}>{permanentlyDenied ? '設定を開く' : 'カメラを許可'}</Text></Pressable>
    </ScrollView>;
  }

  const url = displayCandidate?.url ? toHttpUrl(displayCandidate.url) : displayCandidate ? toHttpUrl(displayCandidate.data) : null;
  const deliveryCopy = { idle: pairingReady ? paired ? 'PCへ自動送信' : 'PC未連携' : 'PC状態を確認中…', sending: 'PCへ送信中…', waiting: 'PCの受領を確認中…', sent: 'PCへ送信済み', expired: 'PCの受領を確認できませんでした', failed: '送信できませんでした', not_paired: 'PC連携で自動送信' }[delivery];
  return <View
    style={styles.screen}
    onTouchStart={startPinch}
    onTouchMove={movePinch}
    onTouchEnd={endPinch}
    onTouchCancel={endPinch}>
    <CameraView ref={cameraRef} key={cameraSession} facing="back" enableTorch={torch} zoom={zoom} barcodeScannerSettings={{ barcodeTypes }} onCameraReady={() => { setCameraReady(true); if (phase === 'ready') scanLocked.current = false; }} onBarcodeScanned={['ready', 'acquiring'].includes(phase) && pairingReady && cameraReady ? onBarcodeScanned : undefined} style={StyleSheet.absoluteFill} />
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
    {phase === 'picking' && selectedCandidate ? candidates.map((candidate, index) => {
      const position = markerPosition(candidate, capturedFrame, viewport);
      if (!position) return null;
      return <Pressable key={candidate.id} accessibilityLabel={`候補 ${index + 1} を選ぶ`} style={[styles.candidateMarker, { left: Math.max(12, Math.min(viewport.width - 48, position.x)), top: Math.max(insets.top + 64, Math.min(viewport.height - 220, position.y)) }, candidate.id === selectedCandidate.id && styles.candidateMarkerActive]} onPress={() => setSelectedCandidateId(candidate.id)}><Text style={styles.candidateMarkerText}>{index + 1}</Text></Pressable>;
    }) : null}
    {['ready', 'acquiring'].includes(phase) && <View style={[styles.scanHint, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Text style={styles.scanHintText}>{!pairingReady ? 'PC連携の状態を確認しています…' : !cameraReady ? 'カメラを再開しています…' : phase === 'acquiring' ? '候補を確認しています…' : isOcrAvailable() ? 'QRコード・印刷URLを枠に合わせてください' : 'QRコードを枠に合わせてください'}</Text>
      {actionNotice && phase === 'ready' ? <Text selectable style={styles.scanNotice}>{actionNotice}</Text> : null}
    </View>}
    {phase === 'picking' && selectedCandidate && <View style={[styles.resultOverlay, { paddingBottom: Math.max(insets.bottom, 16) }]}><View style={styles.resultCard}>
      <View style={styles.resultHeader}><View style={styles.selectionDot} /><Text selectable style={styles.deliveryText}>{selectedCandidate.type === 'ocr' ? '文字リンク候補' : '読み取り候補'}</Text><Pressable style={styles.scanAgain} onPress={() => scanAgain()}><Text style={styles.scanAgainText}>撮り直す</Text></Pressable></View>
      <View style={styles.candidateNavigator}><Pressable disabled={candidates.length < 2} style={styles.candidateNavButton} onPress={() => { const index = candidates.findIndex((candidate) => candidate.id === selectedCandidate.id); setSelectedCandidateId(candidates[(index - 1 + candidates.length) % candidates.length]?.id ?? null); }}><Text style={styles.candidateNavText}>前へ</Text></Pressable><Text selectable style={styles.candidateCount}>{candidates.findIndex((candidate) => candidate.id === selectedCandidate.id) + 1} / {candidates.length}</Text><Pressable disabled={candidates.length < 2} style={styles.candidateNavButton} onPress={() => { const index = candidates.findIndex((candidate) => candidate.id === selectedCandidate.id); setSelectedCandidateId(candidates[(index + 1) % candidates.length]?.id ?? null); }}><Text style={styles.candidateNavText}>次へ</Text></Pressable></View>
      {url && <Text selectable numberOfLines={1} style={styles.host}>{url.host}</Text>}
      <Text selectable numberOfLines={2} style={styles.value}>{selectedCandidate.data}</Text>
      {actionNotice ? <Text selectable numberOfLines={2} style={styles.actionNotice}>{actionNotice}</Text> : null}
      <View style={styles.resultActions}>{url && <Pressable style={styles.copyAction} onPress={() => { void openCandidate(selectedCandidate); }}><Text style={styles.copyActionText}>開く</Text></Pressable>}<Pressable style={styles.copyAction} onPress={() => { void copyCandidate(selectedCandidate); }}><Text style={styles.copyActionText}>コピー</Text></Pressable><Pressable style={styles.openAction} onPress={deliverSelectedCandidate}><Text style={styles.openActionText}>PCに届ける</Text></Pressable></View>
    </View></View>}
    {result && <View style={[styles.resultOverlay, { paddingBottom: Math.max(insets.bottom, 16) }]}><View style={styles.resultCard}>
      <View style={styles.resultHeader}><View style={[styles.deliveryDot, delivery === 'sent' && styles.deliveryDotSent, (delivery === 'failed' || delivery === 'expired') && styles.deliveryDotFailed]} /><Text selectable style={styles.deliveryText}>{deliveryCopy}</Text><Pressable style={styles.scanAgain} onPress={() => scanAgain()}><Text style={styles.scanAgainText}>続けて</Text></Pressable></View>
      {url && <Text selectable numberOfLines={1} style={styles.host}>{url.host}</Text>}
      <Text selectable numberOfLines={2} style={styles.value}>{result.data}</Text>
      {actionNotice ? <Text selectable numberOfLines={2} style={[styles.actionNotice, (delivery === 'failed' || delivery === 'expired') && styles.actionNoticeError]}>{actionNotice}</Text> : null}
      <View style={styles.resultActions}>
        {url && <Pressable style={styles.openAction} onPress={() => { void openCandidate(result); }}><Text style={styles.openActionText}>開く</Text></Pressable>}
        <Pressable style={styles.copyAction} onPress={() => { void copyCandidate(result); }}><Text style={styles.copyActionText}>コピー</Text></Pressable>
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
  scanHint: { position: 'absolute', left: 24, right: 90, bottom: 18, alignItems: 'flex-start', gap: 9 }, scanHintText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0, 0, 0, .65)', textShadowRadius: 7 }, scanNotice: { color: '#C7DBFF', fontSize: 12, lineHeight: 17, textShadowColor: 'rgba(0, 0, 0, .65)', textShadowRadius: 7 }, candidateMarker: { position: 'absolute', zIndex: 3, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#FFFFFF', borderRadius: 18, backgroundColor: 'rgba(5, 20, 52, .86)' }, candidateMarkerActive: { borderColor: '#BBD9FF', backgroundColor: '#2476F3', transform: [{ scale: 1.12 }] }, candidateMarkerText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
  resultOverlay: { position: 'absolute', left: 16, right: 16, bottom: 0 }, resultCard: { gap: 9, padding: 15, borderWidth: 1, borderColor: 'rgba(185, 209, 255, .44)', borderRadius: 20, borderCurve: 'continuous', backgroundColor: 'rgba(5, 18, 46, .94)', boxShadow: '0 12px 32px rgba(0, 0, 0, .3)' }, resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 }, deliveryDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#9AA9C1' }, selectionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#79AEFF' }, deliveryDotSent: { backgroundColor: '#46D58E' }, deliveryDotFailed: { backgroundColor: '#FF7777' }, deliveryText: { flex: 1, color: '#C8D8F4', fontSize: 13, fontWeight: '800' }, scanAgain: { minHeight: 32, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' }, scanAgainText: { color: '#8CB9FF', fontSize: 13, fontWeight: '800' }, candidateNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, paddingVertical: 2 }, candidateNavButton: { minHeight: 32, minWidth: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#567EBA', borderRadius: 10, borderCurve: 'continuous' }, candidateNavText: { color: '#CFE1FF', fontSize: 12, fontWeight: '800' }, candidateCount: { color: '#FFFFFF', fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] }, host: { color: '#FFFFFF', fontSize: 17, fontWeight: '800' }, value: { color: '#D4DEF1', fontSize: 13, lineHeight: 18, fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace' }, actionNotice: { color: '#AFCBFF', fontSize: 12, lineHeight: 17 }, actionNoticeError: { color: '#FFB0B0' }, resultActions: { flexDirection: 'row', gap: 9, marginTop: 2 }, openAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', backgroundColor: '#2476F3' }, openActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' }, copyAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#789ED6', borderRadius: 12, borderCurve: 'continuous' }, copyActionText: { color: '#CFE1FF', fontSize: 14, fontWeight: '900' }, pairAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#789ED6', borderRadius: 12, borderCurve: 'continuous' },
});
