import { CameraView, type BarcodeScanningResult, type BarcodeType, useCameraPermissions } from 'expo-camera';
import * as Clipboard from 'expo-clipboard';
import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, Linking, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isOcrAvailable, recognizeUrlText } from '../../modules/qr-scan-ocr';
import { canCommitDetection, nextDetectionEpoch } from '../lib/detection-coordinator';
import { getHandoffReceipt, getMobileDevices, loadMobileIdentity, refreshMobileIdentityLabel, sendHandoff, type HandoffTarget } from '../lib/handoff';
import { candidateSignature, collectBarcodeCandidates, collectOcrUrlCandidates, toHttpUrl, type ScanCandidate } from '../lib/scan-candidates';
import { usePreferences } from '../lib/preferences';
import { formatString, getStrings, handoffErrorMessage } from '../lib/strings';
import { createSystemStyles, getPalette } from '../lib/theme';

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
  const { resolvedTheme, locale } = usePreferences();
  const isDark = resolvedTheme === 'dark';
  const t = useMemo(() => getStrings(locale), [locale]);
  const candidatePickNotice = t.candidatePickNotice;
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
  const styles = useMemo(() => createSystemStyles(getPalette(isDark ? 'dark' : 'light')), [isDark]);

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
        setActionNotice(formatString(t.receiptConfirmed, { acknowledged: receipt.total }));
        return;
      }
      if (receipt.expired > 0) {
        setDelivery('expired');
        setActionNotice(formatString(t.receiptExpired, { acknowledged: receipt.acknowledged, total: receipt.total }));
        return;
      }
      setDelivery('waiting');
      setActionNotice(formatString(t.receiptWaiting, { acknowledged: receipt.acknowledged, total: receipt.total }));
      receiptTimer.current = setTimeout(() => { void pollHandoffReceipt(handoffs, generation); }, 1_000);
    } catch (error) {
      if (generation !== scanGeneration.current) return;
      const code = error instanceof Error ? (error as { code?: string }).code : '';
      if (code === 'unauthorized' || code === 'not_paired') setPaired(false);
      setDelivery('waiting');
      setActionNotice(t.deliveriesFailed);
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
      setActionNotice(formatString(t.receiptWaiting, { acknowledged: 0, total: response.total }));
      void pollHandoffReceipt(response.handoffs, generation);
    }
    catch (error) {
      if (generation !== scanGeneration.current) return;
      if (error instanceof Error && ['unauthorized', 'not_paired'].includes((error as { code?: string }).code ?? '')) setPaired(false);
      setDelivery('failed');
      setActionNotice(handoffErrorMessage(t, error));
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
    setActionNotice(candidatePickNotice);
    if (process.env.EXPO_OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    return true;
  }, [freezePreview, candidatePickNotice]);

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
    setActionNotice(t.deliveryPrompt);
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
      setActionNotice(t.candidateChecking);
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
    setActionNotice(t.deliveryCopied);
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
    setActionNotice(t.deliveryToPc);
    void sendCandidate(selectedCandidate, scanGeneration.current);
  };
  if (!permission) return <View style={styles.center}><Text style={styles.loadingText}>{t.cameraPreparing}</Text></View>;
  if (!permission.granted) {
    const permanentlyDenied = !permission.canAskAgain;
    return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.permissionContainer}>
      <Text style={styles.permissionTitle}>{t.cameraAccessRequired}</Text>
      <Text selectable style={styles.permissionBody}>{t.cameraPurpose}</Text>
      {permanentlyDenied && <Text selectable style={styles.permissionBody}>{t.cameraSettingsHint}</Text>}
      <Pressable accessibilityRole="button" style={styles.primaryButton} onPress={permanentlyDenied ? Linking.openSettings : requestPermission}><Text style={styles.primaryButtonText}>{permanentlyDenied ? t.openSettings : t.allowCamera}</Text></Pressable>
    </ScrollView>;
  }

  const url = displayCandidate?.url ? toHttpUrl(displayCandidate.url) : displayCandidate ? toHttpUrl(displayCandidate.data) : null;
  const deliveryCopy = { idle: pairingReady ? paired ? t.pcStateAutoSend : t.pcNeedLink : t.pcStateChecking, sending: t.pcSending, waiting: t.pcWaiting, sent: t.pcSent, expired: t.pcExpired, failed: t.pcFailed, not_paired: t.pcLinkForAutoSend }[delivery];
  return <View
    style={styles.screen}
    onTouchStart={startPinch}
    onTouchMove={movePinch}
    onTouchEnd={endPinch}
    onTouchCancel={endPinch}>
    <CameraView ref={cameraRef} key={cameraSession} facing="back" enableTorch={torch} zoom={zoom} barcodeScannerSettings={{ barcodeTypes }} onCameraReady={() => { setCameraReady(true); if (phase === 'ready') scanLocked.current = false; }} onBarcodeScanned={['ready', 'acquiring'].includes(phase) && pairingReady && cameraReady ? onBarcodeScanned : undefined} style={StyleSheet.absoluteFill} />
    <View pointerEvents="none" style={styles.cameraTint} />
    <View style={[styles.topBar, { paddingTop: insets.top + 12 }]}>
      <View><Text style={styles.brand}>{t.appName}</Text><Text style={styles.deliveryPill}>{result ? deliveryCopy : paired ? t.pcAutoSend : t.pcStateConnect}</Text></View>
      <View style={styles.topActions}>
        <Pressable accessibilityRole="button" accessibilityLabel={torch ? t.torchOn : t.torchOff} style={styles.topAction} onPress={() => setTorch((value) => !value)}><Text style={styles.topActionText}>{torch ? '☀' : '◐'}</Text></Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel={t.pcLinkSettings} style={styles.topAction} onPress={() => router.push('/pair')}><Text style={styles.topActionText}>PC</Text></Pressable>
      </View>
    </View>
    <View pointerEvents="none" style={styles.viewfinder}>
      <View style={[styles.corner, styles.cornerTopLeft]} /><View style={[styles.corner, styles.cornerTopRight]} />
      <View style={[styles.corner, styles.cornerBottomLeft]} /><View style={[styles.corner, styles.cornerBottomRight]} />
    </View>
    <View style={[styles.zoomRail, { top: insets.top + 186 }]}>
      {zoomPresets.map((preset) => <Pressable key={preset.label} accessibilityRole="button" accessibilityLabel={`${preset.label}${t.zoomTo}`} style={styles.zoomPreset} onPress={() => setZoom(preset.value)}><Text style={[styles.zoomPresetText, Math.abs(zoom - preset.value) < 0.08 && styles.zoomPresetTextActive]}>{preset.label}</Text></Pressable>)}
      <View style={styles.zoomTrack}><View style={[styles.zoomThumb, { bottom: `${zoom * 100}%` }]} /></View>
      <Text selectable style={styles.currentZoom}>{zoomLabel(zoom)}</Text>
    </View>
    {phase === 'picking' && selectedCandidate ? candidates.map((candidate, index) => {
      const position = markerPosition(candidate, capturedFrame, viewport);
      if (!position) return null;
      return <Pressable key={candidate.id} accessibilityRole="button" accessibilityLabel={`${index + 1}: ${t.candidateSelect}`} style={[styles.candidateMarker, { left: Math.max(12, Math.min(viewport.width - 48, position.x)), top: Math.max(insets.top + 64, Math.min(viewport.height - 220, position.y)) }, candidate.id === selectedCandidate.id && styles.candidateMarkerActive]} onPress={() => setSelectedCandidateId(candidate.id)}><Text style={styles.candidateMarkerText}>{index + 1}</Text></Pressable>;
    }) : null}
    {['ready', 'acquiring'].includes(phase) && <View style={[styles.scanHint, { paddingBottom: Math.max(insets.bottom, 16) }]}>
      <Text style={styles.scanHintText}>{!pairingReady ? t.pcStateChecking : !cameraReady ? t.scannerResuming : phase === 'acquiring' ? t.candidateChecking : isOcrAvailable() ? t.candidatePromptQr : t.candidatePromptReady}</Text>
      {actionNotice && phase === 'ready' ? <Text selectable style={styles.scanNotice}>{actionNotice}</Text> : null}
    </View>}
    {phase === 'picking' && selectedCandidate && <View style={[styles.resultOverlay, { paddingBottom: Math.max(insets.bottom, 16) }]}><View style={styles.resultCard}>
      <View style={styles.resultHeader}><View style={styles.selectionDot} /><Text selectable style={styles.deliveryText}>{selectedCandidate.type === 'ocr' ? t.candidateKindOcr : t.candidateKindRead}</Text><Pressable accessibilityRole="button" style={styles.scanAgain} onPress={() => scanAgain()}><Text style={styles.scanAgainText}>{t.candidateRetake}</Text></Pressable></View>
      <View style={styles.candidateNavigator}><Pressable accessibilityRole="button" disabled={candidates.length < 2} style={styles.candidateNavButton} onPress={() => { const index = candidates.findIndex((candidate) => candidate.id === selectedCandidate.id); setSelectedCandidateId(candidates[(index - 1 + candidates.length) % candidates.length]?.id ?? null); }}><Text style={styles.candidateNavText}>{t.candidatePrevious}</Text></Pressable><Text selectable style={styles.candidateCount}>{candidates.findIndex((candidate) => candidate.id === selectedCandidate.id) + 1} / {candidates.length}</Text><Pressable accessibilityRole="button" disabled={candidates.length < 2} style={styles.candidateNavButton} onPress={() => { const index = candidates.findIndex((candidate) => candidate.id === selectedCandidate.id); setSelectedCandidateId(candidates[(index + 1) % candidates.length]?.id ?? null); }}><Text style={styles.candidateNavText}>{t.candidateNext}</Text></Pressable></View>
      {url && <Text selectable numberOfLines={1} style={styles.host}>{url.host}</Text>}
      <Text selectable numberOfLines={2} style={styles.value}>{selectedCandidate.data}</Text>
      {actionNotice ? <Text selectable numberOfLines={2} style={styles.actionNotice}>{actionNotice}</Text> : null}
      <View style={styles.resultActions}>{url && <Pressable accessibilityRole="button" style={styles.copyAction} onPress={() => { void openCandidate(selectedCandidate); }}><Text style={styles.copyActionText}>{t.candidateOpen}</Text></Pressable>}<Pressable accessibilityRole="button" style={styles.copyAction} onPress={() => { void copyCandidate(selectedCandidate); }}><Text style={styles.copyActionText}>{t.candidateCopy}</Text></Pressable><Pressable accessibilityRole="button" style={styles.openAction} onPress={deliverSelectedCandidate}><Text style={styles.openActionText}>{t.candidateSendPc}</Text></Pressable></View>
    </View></View>}
    {result && <View style={[styles.resultOverlay, { paddingBottom: Math.max(insets.bottom, 16) }]}><View style={styles.resultCard}>
      <View style={styles.resultHeader}><View style={[styles.deliveryDot, delivery === 'sent' && styles.deliveryDotSent, (delivery === 'failed' || delivery === 'expired') && styles.deliveryDotFailed]} /><Text selectable style={styles.deliveryText}>{deliveryCopy}</Text><Pressable accessibilityRole="button" style={styles.scanAgain} onPress={() => scanAgain()}><Text style={styles.scanAgainText}>{t.deliveryContinue}</Text></Pressable></View>
      {url && <Text selectable numberOfLines={1} style={styles.host}>{url.host}</Text>}
      <Text selectable numberOfLines={2} style={styles.value}>{result.data}</Text>
      {actionNotice ? <Text selectable numberOfLines={2} style={[styles.actionNotice, (delivery === 'failed' || delivery === 'expired') && styles.actionNoticeError]}>{actionNotice}</Text> : null}
      <View style={styles.resultActions}>
        {url && <Pressable accessibilityRole="button" style={styles.openAction} onPress={() => { void openCandidate(result); }}><Text style={styles.openActionText}>{t.candidateOpen}</Text></Pressable>}
        <Pressable accessibilityRole="button" style={styles.copyAction} onPress={() => { void copyCandidate(result); }}><Text style={styles.copyActionText}>{t.candidateCopy}</Text></Pressable>
        {delivery === 'not_paired' && <Pressable accessibilityRole="button" style={styles.pairAction} onPress={() => router.push('/pair')}><Text style={styles.copyActionText}>{t.pairPc}</Text></Pressable>}
      </View>
    </View></View>}
  </View>;
}
