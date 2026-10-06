import * as SecureStore from 'expo-secure-store';
import { loadMobileIdentity, mobileDeviceLabel, saveMobileIdentity, type MobileIdentity, type HandoffTarget } from './handoff';
const origin = process.env.EXPO_PUBLIC_HANDOFF_ORIGIN ?? 'https://qr.snkisk.com';
const selectedKey = 'qr-peer-selected-targets';
const pendingKey = 'qr-peer-pending-send';
export type PeerDevice = { id: string; label: string; kind: string; linkId: string; transport: 'peer' | 'legacy' };
export type PeerInvitation = { code: string; phrase: string; expiresAt: number; status: 'pending' | 'paired' | 'expired'; owner: { id: string; label: string }; claimant?: { id: string; label: string }; ownerConfirmed: boolean; claimantConfirmed: boolean };
export type PeerEvent = { id: string; data: string; senderLabel: string; senderId: string; linkId: string; openUrl: string | null; expiresAt: number };
export async function peerRequest(path: string, body?: object, identity?: MobileIdentity | null) {
  const current = identity ?? await loadMobileIdentity();
  const response = await fetch(`${origin}/api/v2/${path}`, { method: body ? 'POST' : 'GET', headers: { 'content-type': 'application/json', ...(current ? { Authorization: `Bearer ${current.token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const data = await response.json(); if (!response.ok) throw Object.assign(new Error(data.error), { code: data.error }); return data;
}
export async function ensurePeerIdentity() {
  const current = await loadMobileIdentity(); if (current) return current;
  const { device, token } = await peerRequest('device', { kind: 'mobile', label: mobileDeviceLabel() });
  const identity = { receiverId: device.id, label: device.label, token };
  await saveMobileIdentity(identity); return identity;
}
export async function selectedPeerTargets(): Promise<string[] | null> {
  const value = await SecureStore.getItemAsync(selectedKey); if (!value) return null;
  try { const parsed = JSON.parse(value); return Array.isArray(parsed) && parsed.every(item => typeof item === 'string') ? parsed : []; } catch { return []; }
}
export async function savePeerTargets(targets: string[]) { await SecureStore.setItemAsync(selectedKey, JSON.stringify([...new Set(targets)])); }
export async function peerDevices(): Promise<PeerDevice[]> { return (await peerRequest('devices')).devices; }
export async function peerEvents(): Promise<PeerEvent[]> { return (await peerRequest('events')).events; }
export async function sendPeerScan(data: string, targets: string[]) {
  if (!targets.length) throw Object.assign(new Error('not_paired'), { code: 'not_paired' });
  const identity = await loadMobileIdentity(); if (!identity) throw Object.assign(new Error('not_paired'), { code: 'not_paired' });
  const ids = [...targets].sort();
  const previous = await SecureStore.getItemAsync(pendingKey).then(value => { try { return value ? JSON.parse(value) : null; } catch { return null; } });
  // The opaque request ID survives uncertain network delivery; only this encrypted, expiring pending operation retains a payload.
  const operation = previous?.data === data && previous?.targets?.join() === ids.join() && previous?.expiresAt > Date.now() ? previous : { data, targets: ids, requestId: `mobile-${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`, expiresAt: Date.now() + 600000 };
  await SecureStore.setItemAsync(pendingKey, JSON.stringify(operation));
  const devices = await peerDevices();
  const response = await peerRequest('handoffs', { data, targetIds: ids, requestId: operation.requestId }, identity);
  if (response.deliveries.some((item: { status: string }) => item.status !== 'accepted')) throw Object.assign(new Error('delivery_failed'), { code: 'delivery_failed' });
  await SecureStore.deleteItemAsync(pendingKey);
  const handoffs: HandoffTarget[] = ids.map(id => ({ code: `peer:${id}`, eventId: `${identity.receiverId}:${operation.requestId}`, label: devices.find(item => item.id === id)?.label ?? id }));
  return { total: handoffs.length, acknowledged: 0, pending: handoffs.length, expired: 0, handoffs };
}
