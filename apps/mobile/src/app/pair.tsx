import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { claimPair, confirmPair, getMobileDevices, getPairStatus, loadMobileIdentity, mobileDeviceLabel, refreshMobileIdentityLabel, revokePair, type MobileIdentity, type PairedPcDevice, type PairCredential } from '../lib/handoff';
import { usePreferences } from '../lib/preferences';
import { getStrings, handoffErrorMessage } from '../lib/strings';
import { createPairStyles, getPalette } from '../lib/theme';

export default function PairScreen() {
  const { resolvedTheme, locale } = usePreferences();
  const t = useMemo(() => getStrings(locale), [locale]);
  const pairingInputStatus = t.pairingInputStatus;
  const pairRemoteRevoked = t.pairRemoteRevoked;
  const pairCodeExpired = t.pairCodeExpired;
  const pairComplete = t.pairComplete;
  const styles = useMemo(() => createPairStyles(getPalette(resolvedTheme)), [resolvedTheme]);
  const [code, setCode] = useState('');
  const [pair, setPair] = useState<PairCredential | null>(null);
  const [identity, setIdentity] = useState<MobileIdentity | null>(null);
  const [identityReady, setIdentityReady] = useState(false);
  const [identityError, setIdentityError] = useState(false);
  const [devices, setDevices] = useState<PairedPcDevice[]>([]);
  const [message, setMessage] = useState(t.pairDefaultMessage);
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
        const storedIdentity = await loadMobileIdentity();
        const currentIdentity = storedIdentity ? await refreshMobileIdentityLabel(storedIdentity).catch(() => storedIdentity) : null;
        setIdentity(currentIdentity);
        await refreshDevices(currentIdentity);
      } catch {
        setIdentityError(true);
        setMessage(pairingInputStatus);
      }
      finally { setIdentityReady(true); }
    })();
  }, [refreshDevices, pairingInputStatus]);

  useEffect(() => {
    if (!pair || pair.status === 'paired') return;
    const timer = setInterval(async () => {
      try {
        const current = await getPairStatus(pair);
        if (current.status === 'revoked' || current.status === 'expired') {
          setPair(null);
          setMessage(current.status === 'revoked' ? pairRemoteRevoked : pairCodeExpired);
          return;
        }
        setPair(current);
        if (current.status === 'paired') {
          const currentIdentity = await loadMobileIdentity();
          setIdentity(currentIdentity);
          await refreshDevices(currentIdentity);
          setMessage(pairComplete);
        }
      } catch { /* The visible controls keep a recovery path. */ }
    }, 1800);
    return () => clearInterval(timer);
  }, [pair, refreshDevices, pairRemoteRevoked, pairCodeExpired, pairComplete]);

  const beginPair = async () => {
    setBusy(true);
    try {
      const credential = await claimPair(code, mobileDeviceLabel(), identity);
      setPair(credential);
      setMessage(t.pairingMessage);
    } catch (error) {
      setMessage(handoffErrorMessage(t, error));
    } finally { setBusy(false); }
  };

  const approvePair = async () => {
    if (!pair) return;
    setBusy(true);
    try {
      const response = await confirmPair(pair);
      setMessage(response.status === 'paired' ? t.pairComplete : t.pairAwaitingPc);
      if (response.status === 'paired') {
        const currentIdentity = await loadMobileIdentity();
        setIdentity(currentIdentity);
        await refreshDevices(currentIdentity);
        setPair({ ...pair, status: 'paired' });
      }
    } catch (error) {
      setMessage(handoffErrorMessage(t, error));
    } finally { setBusy(false); }
  };

  const removeDevice = async (device: PairedPcDevice) => {
    if (!identity) return;
    setRemovingId(device.id);
    try {
      await revokePair({ code: device.id, receiverId: identity.receiverId, token: identity.token, role: 'mobile', phrase: '', expiresAt: 0, status: 'paired' });
      await refreshDevices(identity);
      if (pair?.code === device.id) setPair(null);
      setMessage(`${device.label} ${t.pairRemoveLabel}`);
    } catch (error) {
      setMessage(handoffErrorMessage(t, error));
    } finally { setRemovingId(null); }
  };

  const canStart = identityReady && !identityError && (!pair || pair.status === 'paired');
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.titleRow}><Text style={styles.title}>{t.pairTitle}</Text><Pressable accessibilityRole="button" accessibilityLabel={t.settingsOpen} onPress={() => router.push('/settings')} style={styles.titleAction}><Text style={styles.titleActionText}>{t.settingsOpen}</Text></Pressable></View>
    <Text style={styles.copy}>{t.pairBody}</Text>

    <View style={styles.card}>
      <View style={styles.cardHeading}><Text style={styles.label}>{t.thisPhone}</Text><Text style={styles.currentDeviceLabel}>{identity?.label ?? mobileDeviceLabel()}</Text></View>
      <View style={styles.cardHeading}><Text style={styles.label}>{t.connectedPcs}</Text><Text style={styles.count}>{devices.length}</Text></View>
      {devices.length === 0 ? <Text style={styles.status}>{t.notConnected}</Text> : devices.map((device) => <View key={device.id} style={styles.deviceRow}>
        <View style={styles.deviceCopy}><Text style={styles.deviceLabel}>{device.label}</Text><Text style={styles.deviceMeta}>{t.pairedOn}: {new Date(device.createdAt).toLocaleDateString(locale === 'ja' ? 'ja-JP' : 'en-US')}</Text></View>
        <Pressable accessibilityRole="button" accessibilityLabel={`${device.label}${t.pairRemoveLabel}`} disabled={removingId === device.id} onPress={() => void removeDevice(device)} style={styles.remove}><Text style={styles.removeText}>{removingId === device.id ? t.pairRemoving : t.pairRemove}</Text></Pressable>
      </View>)}
    </View>

    {canStart && <View style={styles.card}>
      <Text style={styles.label}>{t.pairAddPc}</Text>
      <TextInput autoCapitalize="characters" autoCorrect={false} accessibilityLabel={t.pairCodeLabel} maxLength={9} onChangeText={setCode} placeholder={t.pairCodePlaceholder} style={styles.input} value={code} />
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: !identityReady || identityError || busy || code.replace(/[^a-z0-9]/gi, '').length !== 8 }} disabled={!identityReady || identityError || busy || code.replace(/[^a-z0-9]/gi, '').length !== 8} onPress={beginPair} style={styles.primary}><Text style={styles.primaryText}>{!identityReady ? t.pcStateChecking : busy ? t.pairingRetry : t.confirmCode}</Text></Pressable>
    </View>}

    {pair && pair.status !== 'paired' && <View style={styles.card}>
      <Text style={styles.label}>{t.confirmPhrase}</Text>
      <Text style={styles.phrase}>{pair.phrase}</Text>
      <Text style={styles.status}>{message}</Text>
      <Pressable accessibilityRole="button" accessibilityState={{ disabled: busy }} disabled={busy} onPress={approvePair} style={styles.primary}><Text style={styles.primaryText}>{busy ? t.pairingRetry : t.confirmThisPhone}</Text></Pressable>
    </View>}

    <Text style={styles.status}>{message}</Text>
    <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.secondary}><Text style={styles.secondaryText}>{t.pairingBack}</Text></Pressable>
  </ScrollView>;
}
