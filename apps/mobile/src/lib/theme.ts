import { StyleSheet } from 'react-native';
import type { ResolvedTheme } from './preferences';

export type Palette = {
  screen: string;
  loadingScreen: string;
  loadingText: string;
  permissionScreen: string;
  permissionTitle: string;
  permissionBody: string;
  primaryButton: string;
  primaryButtonText: string;
  scannerBackdrop: string;
  cameraTint: string;
  topActionBorder: string;
  topActionBackground: string;
  topActionText: string;
  brandText: string;
  deliveryPillBg: string;
  deliveryPillText: string;
  viewfinderBorder: string;
  zoomRailBorder: string;
  zoomRailBg: string;
  zoomTrack: string;
  zoomThumb: string;
  zoomText: string;
  scanHintText: string;
  scanNoticeText: string;
  candidateMarkerBg: string;
  candidateMarkerBorder: string;
  candidateMarkerActiveBg: string;
  candidateMarkerActiveBorder: string;
  candidateMarkerText: string;
  resultOverlay: string;
  resultBorder: string;
  resultShadow: string;
  selectionDot: string;
  deliveryDot: string;
  deliveryDotSent: string;
  deliveryDotFailed: string;
  deliveryText: string;
  scanAgainText: string;
  navButtonBorder: string;
  navButtonText: string;
  countText: string;
  hostText: string;
  valueText: string;
  actionNoticeText: string;
  actionNoticeErrorText: string;
  openAction: string;
  copyActionBorder: string;
  copyActionText: string;
  pairActionBorder: string;
  pairScreenBg: string;
  pairCardBg: string;
  pairCardBorder: string;
  pairTitle: string;
  pairCopy: string;
  pairLabel: string;
  pairCount: string;
  pairCurrentDevice: string;
  pairInputBorder: string;
  pairInputText: string;
  pairInputBg: string;
  pairPhrase: string;
  pairStatus: string;
  pairPrimaryBg: string;
  pairSecondaryBorder: string;
  pairSecondaryText: string;
  pairDeviceBorder: string;
  pairDeviceLabel: string;
  pairDeviceMeta: string;
  pairRemoveBg: string;
  pairRemoveText: string;
  controlBg: string;
  controlBorder: string;
  controlText: string;
};

const dark: Palette = {
  screen: '#06142D',
  loadingScreen: '#071B41',
  loadingText: '#DCE8FF',
  permissionScreen: '#06142D',
  permissionTitle: '#FFFFFF',
  permissionBody: '#B7C7E6',
  primaryButton: '#2476F3',
  primaryButtonText: '#FFFFFF',
  scannerBackdrop: '#06142D',
  cameraTint: 'rgba(2, 10, 25, .18)',
  topActionBorder: 'rgba(203, 223, 255, .36)',
  topActionBackground: 'rgba(5, 20, 52, .76)',
  topActionText: '#FFFFFF',
  brandText: '#FFFFFF',
  deliveryPillBg: 'rgba(5, 20, 52, .72)',
  deliveryPillText: '#AFCBFF',
  viewfinderBorder: '#FFFFFF',
  zoomRailBorder: 'rgba(166, 199, 255, .25)',
  zoomRailBg: 'rgba(4, 18, 47, .72)',
  zoomTrack: 'rgba(255, 255, 255, .36)',
  zoomThumb: '#4C91FF',
  zoomText: '#FFFFFF',
  scanHintText: '#FFFFFF',
  scanNoticeText: '#C7DBFF',
  candidateMarkerBg: 'rgba(5, 20, 52, .86)',
  candidateMarkerBorder: '#FFFFFF',
  candidateMarkerActiveBg: '#2476F3',
  candidateMarkerActiveBorder: '#BBD9FF',
  candidateMarkerText: '#FFFFFF',
  resultOverlay: '#06142D',
  resultBorder: 'rgba(185, 209, 255, .44)',
  resultShadow: '0 12px 32px rgba(0, 0, 0, .3)',
  selectionDot: '#79AEFF',
  deliveryDot: '#9AA9C1',
  deliveryDotSent: '#46D58E',
  deliveryDotFailed: '#FF7777',
  deliveryText: '#C8D8F4',
  scanAgainText: '#8CB9FF',
  navButtonBorder: '#567EBA',
  navButtonText: '#CFE1FF',
  countText: '#FFFFFF',
  hostText: '#FFFFFF',
  valueText: '#D4DEF1',
  actionNoticeText: '#AFCBFF',
  actionNoticeErrorText: '#FFB0B0',
  openAction: '#2476F3',
  copyActionBorder: '#789ED6',
  copyActionText: '#CFE1FF',
  pairActionBorder: '#789ED6',
  pairScreenBg: '#071B41',
  pairCardBg: '#102A57',
  pairCardBorder: '#35588F',
  pairTitle: '#FFFFFF',
  pairCopy: '#C7D6EF',
  pairLabel: '#B7C7E6',
  pairCount: '#8CB9FF',
  pairCurrentDevice: '#FFFFFF',
  pairInputBorder: '#567EBA',
  pairInputText: '#FFFFFF',
  pairInputBg: '#0B2149',
  pairPhrase: '#FFFFFF',
  pairStatus: '#C7D6EF',
  pairPrimaryBg: '#2476F3',
  pairSecondaryBorder: '#79AEFF',
  pairSecondaryText: '#AFCBFF',
  pairDeviceBorder: '#284A7C',
  pairDeviceLabel: '#FFFFFF',
  pairDeviceMeta: '#B7C7E6',
  pairRemoveBg: '#4A1F2A',
  pairRemoveText: '#FFB8B1',
  controlBg: '#06142D',
  controlBorder: '#0F285B',
  controlText: '#FFFFFF',
};

const light: Palette = {
  ...dark,
  screen: '#F7FAFF',
  loadingScreen: '#F7FAFF',
  loadingText: '#0D1B3E',
  permissionScreen: '#F7FAFF',
  permissionTitle: '#0D1B3E',
  permissionBody: '#52627C',
  primaryButton: '#1463F3',
  scannerBackdrop: '#F7FAFF',
  cameraTint: 'rgba(255, 255, 255, .12)',
  topActionBorder: 'rgba(20, 99, 243, .18)',
  topActionBackground: 'rgba(255, 255, 255, .82)',
  topActionText: '#0D1B3E',
  brandText: '#0D1B3E',
  deliveryPillBg: 'rgba(255, 255, 255, .88)',
  deliveryPillText: '#1463F3',
  zoomRailBorder: 'rgba(20, 99, 243, .20)',
  zoomRailBg: 'rgba(255, 255, 255, .82)',
  zoomTrack: 'rgba(20, 99, 243, .28)',
  zoomThumb: '#1463F3',
  zoomText: '#0D1B3E',
  scanHintText: '#FFFFFF',
  scanNoticeText: '#D5E4FF',
  candidateMarkerBg: 'rgba(255, 255, 255, .92)',
  candidateMarkerBorder: '#1463F3',
  candidateMarkerActiveBg: '#1463F3',
  candidateMarkerActiveBorder: '#0D4EC0',
  candidateMarkerText: '#0D1B3E',
  resultOverlay: '#FFFFFF',
  resultBorder: 'rgba(20, 99, 243, .16)',
  resultShadow: '0 12px 32px rgba(13, 27, 62, .14)',
  selectionDot: '#1463F3',
  deliveryDot: '#8EA3C8',
  deliveryDotSent: '#1B9E5A',
  deliveryDotFailed: '#D64040',
  deliveryText: '#0D1B3E',
  scanAgainText: '#125EE9',
  navButtonBorder: '#AFC5EC',
  navButtonText: '#52627C',
  countText: '#0D1B3E',
  hostText: '#0D1B3E',
  valueText: '#31405B',
  actionNoticeText: '#52627C',
  actionNoticeErrorText: '#B42318',
  openAction: '#1463F3',
  copyActionBorder: '#9DBBF0',
  copyActionText: '#125EE9',
  pairActionBorder: '#9DBBF0',
  pairScreenBg: '#F7FAFF',
  pairCardBg: '#FFFFFF',
  pairCardBorder: '#B9D1FF',
  pairTitle: '#0D1B3E',
  pairCopy: '#52627C',
  pairLabel: '#52627C',
  pairCount: '#1463F3',
  pairCurrentDevice: '#0D1B3E',
  pairInputBorder: '#9DBBF0',
  pairInputText: '#0D1B3E',
  pairInputBg: '#FFFFFF',
  pairPhrase: '#0D1B3E',
  pairStatus: '#52627C',
  pairPrimaryBg: '#1463F3',
  pairSecondaryBorder: '#1463F3',
  pairSecondaryText: '#125EE9',
  pairDeviceBorder: '#E4ECFA',
  pairDeviceLabel: '#0D1B3E',
  pairDeviceMeta: '#64738C',
  pairRemoveBg: '#FFF2F0',
  pairRemoveText: '#B42318',
  controlBg: '#FFFFFF',
  controlBorder: '#B9D1FF',
  controlText: '#0D1B3E',
};

export function getPalette(theme: ResolvedTheme) {
  return theme === 'dark' ? dark : light;
}

export function createSystemStyles(palette: Palette) {
  return StyleSheet.create({
    screen: { flex: 1, overflow: 'hidden', backgroundColor: palette.scannerBackdrop },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.loadingScreen },
    loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palette.loadingScreen },
    loadingText: { color: palette.loadingText, fontSize: 16 },
    permissionContainer: { flexGrow: 1, justifyContent: 'center', padding: 24, gap: 16, backgroundColor: palette.permissionScreen },
    permissionTitle: { color: palette.permissionTitle, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
    permissionBody: { color: palette.permissionBody, fontSize: 16, lineHeight: 25 },
    primaryButton: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderCurve: 'continuous', backgroundColor: palette.primaryButton },
    primaryButtonText: { color: palette.primaryButtonText, fontSize: 16, fontWeight: '800' },
    cameraTint: { ...StyleSheet.absoluteFill, backgroundColor: palette.cameraTint },
    topBar: { position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 20 },
    brand: { color: palette.brandText, fontSize: 27, fontWeight: '800', letterSpacing: -0.8, textShadowColor: 'rgba(0, 0, 0, .45)', textShadowRadius: 8 },
    deliveryPill: { alignSelf: 'flex-start', marginTop: 7, paddingHorizontal: 9, paddingVertical: 5, borderRadius: 99, overflow: 'hidden', backgroundColor: palette.deliveryPillBg, color: palette.deliveryPillText, fontSize: 12, fontWeight: '800' },
    topActions: { flexDirection: 'row', gap: 9 },
    topAction: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.topActionBorder, borderRadius: 22, backgroundColor: palette.topActionBackground },
    topActionText: { color: palette.topActionText, fontSize: 14, fontWeight: '800' },
    viewfinder: { position: 'absolute', top: '26%', left: '12%', right: '18%', bottom: '31%' },
    corner: { position: 'absolute', width: 38, height: 38, borderColor: palette.viewfinderBorder, borderRadius: 8, borderCurve: 'continuous' },
    cornerTopLeft: { top: 0, left: 0, borderTopWidth: 3, borderLeftWidth: 3 },
    cornerTopRight: { top: 0, right: 0, borderTopWidth: 3, borderRightWidth: 3 },
    cornerBottomLeft: { bottom: 0, left: 0, borderBottomWidth: 3, borderLeftWidth: 3 },
    cornerBottomRight: { bottom: 0, right: 0, borderBottomWidth: 3, borderRightWidth: 3 },
    zoomRail: { position: 'absolute', right: 16, alignItems: 'center', gap: 7, paddingVertical: 12, paddingHorizontal: 8, borderWidth: 1, borderColor: palette.zoomRailBorder, borderRadius: 22, backgroundColor: palette.zoomRailBg },
    zoomPreset: { width: 38, minHeight: 28, alignItems: 'center', justifyContent: 'center' },
    zoomPresetText: { color: palette.actionNoticeText, fontSize: 11, fontWeight: '700', fontVariant: ['tabular-nums'] },
    zoomPresetTextActive: { color: palette.zoomText, fontSize: 12, fontWeight: '900' },
    zoomTrack: { width: 2, height: 72, borderRadius: 2, backgroundColor: palette.zoomTrack, overflow: 'visible' },
    zoomThumb: { position: 'absolute', left: -5, width: 12, height: 12, borderRadius: 6, backgroundColor: palette.zoomThumb, borderWidth: 2, borderColor: '#DCEBFF' },
    currentZoom: { color: palette.zoomText, fontSize: 12, fontWeight: '900', fontVariant: ['tabular-nums'] },
    scanHint: { position: 'absolute', left: 24, right: 90, bottom: 18, alignItems: 'flex-start', gap: 9 },
    scanHintText: { color: palette.scanHintText, fontSize: 13, fontWeight: '700', textShadowColor: 'rgba(0, 0, 0, .65)', textShadowRadius: 7 },
    scanNotice: { color: palette.scanNoticeText, fontSize: 12, lineHeight: 17, textShadowColor: 'rgba(0, 0, 0, .65)', textShadowRadius: 7 },
    candidateMarker: { position: 'absolute', zIndex: 3, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: palette.candidateMarkerBorder, borderRadius: 18, backgroundColor: palette.candidateMarkerBg },
    candidateMarkerActive: { borderColor: palette.candidateMarkerActiveBorder, backgroundColor: palette.candidateMarkerActiveBg, transform: [{ scale: 1.12 }] },
    candidateMarkerText: { color: palette.candidateMarkerText, fontSize: 14, fontWeight: '900', fontVariant: ['tabular-nums'] },
    resultOverlay: { position: 'absolute', left: 16, right: 16, bottom: 0 },
    resultCard: { gap: 9, padding: 15, borderWidth: 1, borderColor: palette.resultBorder, borderRadius: 20, borderCurve: 'continuous', backgroundColor: palette.resultOverlay, boxShadow: palette.resultShadow },
    resultHeader: { flexDirection: 'row', alignItems: 'center', gap: 7 },
    deliveryDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.deliveryDot },
    selectionDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: palette.selectionDot },
    deliveryDotSent: { backgroundColor: palette.deliveryDotSent },
    deliveryDotFailed: { backgroundColor: palette.deliveryDotFailed },
    deliveryText: { flex: 1, color: palette.deliveryText, fontSize: 13, fontWeight: '800' },
    scanAgain: { minHeight: 32, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center' },
    scanAgainText: { color: palette.scanAgainText, fontSize: 13, fontWeight: '800' },
    candidateNavigator: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 9, paddingVertical: 2 },
    candidateNavButton: { minHeight: 32, minWidth: 54, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.navButtonBorder, borderRadius: 10, borderCurve: 'continuous' },
    candidateNavText: { color: palette.navButtonText, fontSize: 12, fontWeight: '800' },
    candidateCount: { color: palette.countText, fontSize: 13, fontWeight: '900', fontVariant: ['tabular-nums'] },
    host: { color: palette.hostText, fontSize: 17, fontWeight: '800' },
    value: { color: palette.valueText, fontSize: 13, lineHeight: 18, fontFamily: 'monospace' },
    actionNotice: { color: palette.actionNoticeText, fontSize: 12, lineHeight: 17 },
    actionNoticeError: { color: palette.actionNoticeErrorText },
    resultActions: { flexDirection: 'row', gap: 9, marginTop: 2 },
    openAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', backgroundColor: palette.openAction },
    openActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '900' },
    copyAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.copyActionBorder, borderRadius: 12, borderCurve: 'continuous' },
    copyActionText: { color: palette.copyActionText, fontSize: 14, fontWeight: '900' },
    pairAction: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.pairActionBorder, borderRadius: 12, borderCurve: 'continuous' },
    settingsCard: { gap: 16, padding: 18, borderWidth: 1, borderColor: palette.pairCardBorder, borderRadius: 18, borderCurve: 'continuous', backgroundColor: palette.pairCardBg },
    settingsSection: { gap: 10 },
    settingsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    settingsLabel: { color: palette.pairLabel, fontSize: 13, fontWeight: '800' },
    settingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    settingsChip: { minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderCurve: 'continuous', borderWidth: 1, borderColor: palette.pairCardBorder },
    settingsChipActive: { backgroundColor: palette.pairPrimaryBg, borderColor: palette.pairPrimaryBg },
    settingsChipText: { color: palette.pairSecondaryText, fontSize: 13, fontWeight: '800' },
    settingsChipTextActive: { color: '#FFFFFF' },
  });
}

export function createPairStyles(palette: Palette) {
  return StyleSheet.create({
    content: { flexGrow: 1, gap: 18, padding: 22, backgroundColor: palette.pairScreenBg },
    title: { color: palette.pairTitle, fontSize: 31, fontWeight: '800', letterSpacing: -0.6 },
    titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 16 },
    titleAction: { minHeight: 44, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.pairSecondaryBorder, borderRadius: 12, borderCurve: 'continuous' },
    titleActionText: { color: palette.pairSecondaryText, fontSize: 14, fontWeight: '800' },
    copy: { color: palette.pairCopy, fontSize: 15, lineHeight: 24 },
    card: { gap: 14, padding: 20, borderRadius: 18, borderCurve: 'continuous', borderWidth: 1, borderColor: palette.pairCardBorder, backgroundColor: palette.pairCardBg },
    cardHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    label: { color: palette.pairLabel, fontSize: 13, fontWeight: '800' },
    count: { color: palette.pairCount, fontSize: 18, fontWeight: '900' },
    currentDeviceLabel: { flex: 1, marginLeft: 12, color: palette.pairCurrentDevice, fontSize: 14, fontWeight: '800', textAlign: 'right' },
    input: { minHeight: 54, borderWidth: 1, borderColor: palette.pairInputBorder, backgroundColor: palette.pairInputBg, borderRadius: 12, color: palette.pairInputText, fontSize: 24, fontWeight: '800', letterSpacing: 2, paddingHorizontal: 15, textAlign: 'center' },
    phrase: { color: palette.pairPhrase, fontSize: 27, fontWeight: '800', letterSpacing: 1, textAlign: 'center' },
    status: { color: palette.pairStatus, fontSize: 14, lineHeight: 21, textAlign: 'center' },
    primary: { minHeight: 52, alignItems: 'center', justifyContent: 'center', borderRadius: 13, borderCurve: 'continuous', backgroundColor: palette.pairPrimaryBg },
    primaryText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' },
    secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderCurve: 'continuous', borderWidth: 1, borderColor: palette.pairSecondaryBorder },
    secondaryText: { color: palette.pairSecondaryText, fontSize: 16, fontWeight: '800' },
    deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 12, borderTopWidth: 1, borderTopColor: palette.pairDeviceBorder, paddingTop: 13 },
    deviceCopy: { flex: 1, gap: 3 },
    deviceLabel: { color: palette.pairDeviceLabel, fontSize: 16, fontWeight: '800' },
    deviceMeta: { color: palette.pairDeviceMeta, fontSize: 12 },
    remove: { minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, backgroundColor: palette.pairRemoveBg },
    removeText: { color: palette.pairRemoveText, fontSize: 13, fontWeight: '800' },
    choiceRow: { flexDirection: 'row', gap: 8 },
    choice: { minHeight: 44, flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: palette.pairInputBorder, borderRadius: 10, backgroundColor: palette.pairCardBg },
    choiceActive: { backgroundColor: palette.pairCount === '#1463F3' ? '#DCEAFF' : palette.pairPrimaryBg, borderColor: palette.pairPrimaryBg },
    choiceText: { color: palette.pairCurrentDevice, fontWeight: '800' },
    settingsCard: { gap: 16, padding: 18, borderWidth: 1, borderColor: palette.pairCardBorder, borderRadius: 18, borderCurve: 'continuous', backgroundColor: palette.pairCardBg },
    settingsSection: { gap: 10 },
    settingsLabel: { color: palette.pairLabel, fontSize: 13, fontWeight: '800' },
    settingsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    settingsChip: { minHeight: 38, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderCurve: 'continuous', borderWidth: 1, borderColor: palette.pairCardBorder },
    settingsChipActive: { backgroundColor: palette.pairPrimaryBg, borderColor: palette.pairPrimaryBg },
    settingsChipText: { color: palette.pairSecondaryText, fontSize: 13, fontWeight: '800' },
    settingsChipTextActive: { color: '#FFFFFF' },
  });
}
