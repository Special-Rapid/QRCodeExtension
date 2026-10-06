import assert from 'node:assert/strict';
import test from 'node:test';
import { build } from '../../../node_modules/esbuild/lib/main.js';
const { outputFiles } = await build({ entryPoints: [new URL('../src/lib/peers.ts', import.meta.url).pathname], bundle: true, write: false, format: 'esm', platform: 'node', plugins: [{ name: 'synthetic-native-storage', setup(build) {
  build.onResolve({ filter: /^(expo-secure-store|\.\/handoff)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
  build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'expo-secure-store' ? `export async function getItemAsync(k){return globalThis.qrStore.get(k)??null} export async function setItemAsync(k,v){globalThis.qrStore.set(k,v)} export async function deleteItemAsync(k){globalThis.qrStore.delete(k)}` : `export async function loadMobileIdentity(){return {receiverId:'synthetic-app',token:'synthetic-token',label:'Synthetic'}} export async function saveMobileIdentity(){} export function mobileDeviceLabel(){return 'Synthetic'}` }));
} }] });
const peers = await import('data:text/javascript;base64,' + Buffer.from(outputFiles[0].text).toString('base64'));
test('mobile peer selection defaults to legacy only until explicit selection, then persists even empty', async () => {
  globalThis.qrStore = new Map(); assert.equal(await peers.selectedPeerTargets(), null);
  await peers.savePeerTargets(['web-b', 'web-b']); assert.deepEqual(await peers.selectedPeerTargets(), ['web-b']);
  await peers.savePeerTargets([]); assert.deepEqual(await peers.selectedPeerTargets(), []);
  await assert.rejects(peers.sendPeerScan('synthetic', []), /not_paired/);
});
test('uncertain mobile delivery retains one expiring encrypted operation and reuses its id on retry', async () => {
  globalThis.qrStore = new Map(); const previousFetch = globalThis.fetch; const requests = [];let fails=true;
  globalThis.fetch = async (url, init) => {
    if(url.endsWith('/devices')) return {ok:true,json:async()=>({devices:[{id:'web-b',label:'Web B'}]})};
    requests.push(JSON.parse(init.body)); if(fails) throw new Error('synthetic offline');
    return {ok:true,json:async()=>({deliveries:[{targetId:'web-b',status:'accepted'}]})};
  };
  try {
    await assert.rejects(peers.sendPeerScan('fixture',['web-b']), /offline/);
    const pending = JSON.parse(globalThis.qrStore.get('qr-peer-pending-send'));assert.equal(pending.data,'fixture'); assert.ok(pending.expiresAt <= Date.now()+600000);
    fails=false;const receipt=await peers.sendPeerScan('fixture',['web-b']);assert.equal(requests[0].requestId,requests[1].requestId);assert.equal(receipt.handoffs[0].code,'peer:web-b');assert.equal(globalThis.qrStore.has('qr-peer-pending-send'),false);
  } finally {globalThis.fetch=previousFetch;}
});
