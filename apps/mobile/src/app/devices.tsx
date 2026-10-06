import { usePeerInbox } from '../lib/peer-inbox';
import { router, useFocusEffect } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, AppState, Linking, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { ensurePeerIdentity, peerDevices, peerRequest, savePeerTargets, selectedPeerTargets, type PeerDevice, type PeerInvitation } from '../lib/peers';
import { revokePair } from '../lib/handoff';
import { usePreferences } from '../lib/preferences';
import { getStrings } from '../lib/strings';
import { createPairStyles, getPalette } from '../lib/theme';
import { toHttpUrl } from '../lib/scan-candidates';
const deviceName=(device:{id:string;label:string})=>`${device.label} · ${device.id.slice(0,6)}`;
export default function DevicesScreen() {
  const { resolvedTheme, locale } = usePreferences(); const t = useMemo(() => getStrings(locale), [locale]);
  const styles = useMemo(() => createPairStyles(getPalette(resolvedTheme)), [resolvedTheme]);
  const [devices, setDevices] = useState<PeerDevice[]>([]), [selected, setSelected] = useState<string[]>([]);
  const [code, setCode] = useState(''), [invitation, setInvitation] = useState<PeerInvitation | null>(null), [status, setStatus] = useState<keyof typeof t | null>(null), [busy, setBusy] = useState(false);
  const events=usePeerInbox();
  const lock = useRef(false), generation = useRef(0);
  const currentInvitation = useRef(invitation); useEffect(() => { currentInvitation.current = invitation; }, [invitation]);
  const refresh = async () => { const epoch=generation.current;const list = await peerDevices(); const saved = await selectedPeerTargets();if(epoch!==generation.current)return;setDevices(list);setSelected((saved ?? []).filter(id => list.some(item => item.id === id))); };
  const action = async (work: () => Promise<void>, success: keyof typeof t = 'peerLoaded') => {
    if (lock.current) return; lock.current = true; setBusy(true);setStatus('peerPending');const epoch=generation.current;
    try { await work(); if(epoch===generation.current)setStatus(success); }catch { if(epoch===generation.current)setStatus('peerFailed'); }finally {if(epoch===generation.current){lock.current=false;setBusy(false);}}
  };
  useFocusEffect(useCallback(() => {
    let active = true, polling = false; ++generation.current;lock.current=false;setBusy(false);
    void action(async () => { await ensurePeerIdentity();await refresh(); },'peerLoaded');
    const timer=setInterval(async()=>{
      if(!active || polling || AppState.currentState!=='active')return;polling=true;
      try {
        const pending=currentInvitation.current;
        if(pending?.status==='pending'){const next=await peerRequest(`invitations/${pending.code}`);if(active){setInvitation(next);if(next.status==='paired'){await refresh();setStatus('peerReady');}if(next.status==='expired')setStatus('peerFailed');}}

      }catch {if(active)setStatus('peerFailed');}finally{polling=false;}
    },2000);
    return()=>{active=false;generation.current++;clearInterval(timer);};
  // Remote data and invitation refs are independent of appearance/language rerenders.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]));
  const add=()=>void action(async()=>{setInvitation(await peerRequest('invitations',{}));},'peerWaiting');
  const claim=()=>void action(async()=>{setInvitation(await peerRequest(`invitations/${code.toUpperCase().replace(/[^A-Z0-9]/g,'')}/claim`,{}));},'peerWaiting');
  const approve=()=>void action(async()=>{if(!invitation)return;const next=await peerRequest(`invitations/${invitation.code}/confirm`,{});setInvitation(next);if(next.status==='paired')await refresh();},'peerWaiting');
  const toggle=(id:string)=>void action(async()=>{const next=selected.includes(id)?selected.filter(item=>item!==id):[...selected,id];await savePeerTargets(next);setSelected(next);},'peerSaved');
  const remove=(device:PeerDevice)=>Alert.alert(t.peerRemoveConfirm,deviceName(device),[{text:t.pairRemoveCancel,style:'cancel'},{text:t.peerRemove,style:'destructive',onPress:()=>void action(async()=>{
    if(device.transport==='legacy'){const identity=await ensurePeerIdentity();await revokePair({code:device.linkId,receiverId:identity.receiverId,token:identity.token,role:'mobile',phrase:'',expiresAt:0,status:'paired'});}else await peerRequest('revoke',{targetId:device.id});
const next=selected.filter(id=>id!==device.id);await savePeerTargets(next);await refresh();
  },'peerRemoved')}]);
  return <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={styles.content}>
    <View style={styles.pageIntro}><Text style={styles.title}>{t.peerDevicesTitle}</Text><Text style={styles.copy}>{t.peerDevicesBody}</Text><Pressable accessibilityRole="button" onPress={()=>router.push('/settings')} style={styles.secondary}><Text style={styles.secondaryText}>{t.settingsOpen}</Text></Pressable></View>
    <View style={styles.card}><Text style={styles.label}>{t.peerTargets}</Text><Text style={styles.copy}>{t.peerAutoSend}</Text>{!devices.length&&<Text style={styles.status}>{t.peerEmpty}</Text>}{devices.map(device=><View key={device.id} style={styles.deviceRow}><View style={styles.deviceCopy}><Text style={styles.deviceLabel}>{deviceName(device)}</Text><Pressable accessibilityRole="checkbox" accessibilityState={{checked:selected.includes(device.id),disabled:busy}} accessibilityLabel={`${deviceName(device)}: ${t.peerTargets}`} disabled={busy} onPress={()=>toggle(device.id)} style={styles.secondary}><Text style={styles.secondaryText}>{selected.includes(device.id)?t.peerSelected:t.peerUnselected}</Text></Pressable></View><Pressable accessibilityRole="button" accessibilityLabel={`${deviceName(device)}: ${t.peerRemove}`} disabled={busy} onPress={()=>remove(device)} style={styles.remove}><Text style={styles.removeText}>{t.peerRemove}</Text></Pressable></View>)}</View>
    <View style={styles.card}><Pressable accessibilityRole="button" disabled={busy} onPress={add} style={styles.primary}><Text style={styles.primaryText}>{t.peerAdd}</Text></Pressable><Text style={styles.label}>{t.peerCode}</Text><TextInput value={code} onChangeText={setCode} maxLength={9} autoCapitalize="characters" autoCorrect={false} accessibilityLabel={t.peerCode} style={styles.input}/><Pressable accessibilityRole="button" disabled={busy || code.replace(/[^a-z0-9]/gi,'').length!==8} onPress={claim} style={styles.secondary}><Text style={styles.secondaryText}>{t.peerClaim}</Text></Pressable></View>
    {invitation&&<View style={styles.card}><Text style={styles.phrase}>{invitation.code}</Text><Text style={styles.phrase}>{invitation.phrase}</Text><Text style={styles.copy}>{deviceName(invitation.owner)} ↔ {invitation.claimant ? deviceName(invitation.claimant) : ''}</Text>{invitation.status==='pending'&&invitation.claimant&&<Pressable accessibilityRole="button" disabled={busy} onPress={approve} style={styles.primary}><Text style={styles.primaryText}>{t.peerConfirm}</Text></Pressable>}</View>}
    <Text accessibilityLiveRegion="polite" style={styles.status}>{status?t[status]:''}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void action(refresh)} style={styles.secondary}><Text style={styles.secondaryText}>{t.peerRefresh}</Text></Pressable>
    <View style={styles.card}><Text style={styles.label}>{t.peerIncoming}</Text><Text style={styles.copy}>{t.peerForeground}</Text>{events.map(event=><View key={event.id} style={styles.deviceCopy}><Text style={styles.deviceLabel}>{deviceName({id:event.senderId,label:event.senderLabel})}</Text><Text selectable style={styles.copy}>{event.data}</Text><Pressable accessibilityRole="button" disabled={busy} onPress={()=>void action(async()=>{await Clipboard.setStringAsync(event.data);},'peerCopied')} style={styles.secondary}><Text style={styles.secondaryText}>{t.peerCopy}</Text></Pressable>{toHttpUrl(event.data)&&<Pressable accessibilityRole="button" onPress={()=>void action(async()=>{await Linking.openURL(toHttpUrl(event.data)!.href);})} style={styles.secondary}><Text style={styles.secondaryText}>{t.peerOpen}</Text></Pressable>}</View>)}</View>
    <Pressable accessibilityRole="button" onPress={()=>router.back()} style={styles.secondary}><Text style={styles.secondaryText}>{t.pairingBack}</Text></Pressable>
  </ScrollView>;
}
