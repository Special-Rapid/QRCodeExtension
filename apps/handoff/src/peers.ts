import { canSendPush, sendHandoffPush, type DeliveryChannel } from "./push";
import { createOpaqueToken, createPairCode, createConfirmationPhrase, hashToken, normalizePairCode, validateLabel, validatePayload, isSafeOpenUrl, PAIR_TTL_MS, HANDOFF_TTL_MS } from './protocol';

type PeerEnv = { DB: D1Database; PAIR_DO: DurableObjectNamespace<import('./index').PairingRoom>; VAPID_PUBLIC_KEY?: string; VAPID_PRIVATE_KEY?: string; VAPID_SUBJECT?: string; };
type Device = { id: string; kind: string; label: string };
type Invitation = { code: string; owner: Device; claimant?: Device; ownerConfirmed: boolean; claimantConfirmed: boolean; phrase: string; expiresAt: number; status: 'pending' | 'paired' | 'expired' };
type Receipt = { id: string; expiresAt: number; acknowledged?: boolean; payloadHash: string };
type Event = { id: string; senderId: string; senderLabel: string; linkId: string; data: string; createdAt: number; expiresAt: number };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
const stub = (env: PeerEnv, id: string) => env.PAIR_DO.get(env.PAIR_DO.idFromName(`peer:${id}`));
const internal = (env: PeerEnv, id: string, action: string, body: unknown) => stub(env, id).fetch(`https://peer.internal/peer/${action}`, { method: 'POST', body: JSON.stringify(body) });
function cookie(request: Request) { return request.headers.get('cookie')?.split(';').map(s => s.trim()).find(s => s.startsWith('qr_device='))?.slice(10) ?? ''; }
export async function authenticateDevice(request: Request, env: PeerEnv): Promise<Device | null> {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || cookie(request);
  if (!token) return null;
  return env.DB.prepare("SELECT id, kind, label FROM receivers WHERE token_hash = ? AND kind IN ('web','mobile') AND revoked_at IS NULL").bind(await hashToken(token)).first<Device>();
}
function withCookie(response: Response, request: Request, token: string) {
  const headers = new Headers(response.headers);
  headers.append('set-cookie', `qr_device=${token}; HttpOnly${new URL(request.url).protocol === 'https:' ? '; Secure' : ''}; SameSite=Strict; Path=/api/; Max-Age=2592000`);
  return new Response(response.body, { status: response.status, headers });
}
export function adoptWebDevice(request: Request, token: string, device: Device) { return withCookie(json({ device }, 200), request, token); }
export async function peerApi(request: Request, env: PeerEnv): Promise<Response> {
  const url = new URL(request.url), path = url.pathname.slice('/api/v2/'.length);
  // Cookie-authenticated writes are strictly same-origin; native bearer clients have no ambient authority.
  if (request.method !== 'GET' && request.headers.get('origin') && request.headers.get('origin') !== url.origin) return json({ error: 'forbidden' }, 403);
  let device = await authenticateDevice(request, env);
  if (path === 'device' && request.method === 'POST') {
    if (device) return json({ device });
    // Never silently replace an invalid credential with another identity.
    if (request.headers.get('authorization') || cookie(request)) return json({ error: 'unauthorized' }, 401);
    const body = await request.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
    if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'invalid_request'},400);
    const native = body.kind === 'mobile' && !request.headers.get('origin');
    const token = createOpaqueToken(); device = { id: crypto.randomUUID(), kind: native ? 'mobile' : 'web', label: validateLabel(body.label, native ? 'QR Scan app' : 'QR Scan browser') };
    await env.DB.prepare('INSERT INTO receivers (id,token_hash,kind,label,created_at) VALUES (?,?,?,?,?)').bind(device.id, await hashToken(token), device.kind, device.label, Date.now()).run();
    return native ? json({ device, token }, 201) : withCookie(json({ device }, 201), request, token);
  }
  if (!device) return json({ error: 'unauthorized' }, 401);
  if (path === 'device' && request.method === 'GET') return json({ device });
  if (path === 'devices' && request.method === 'GET') return json({ device, devices: await linkedDevices(env, device.id) });
  const body = request.method === 'GET' ? {} : await request.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
  if (!body || typeof body !== 'object' || Array.isArray(body)) return json({error:'invalid_request'},400);
  if (path === 'push-subscriptions' && request.method === 'POST') {
    const subscription = body.subscription as {endpoint?: string; keys?: {p256dh?:string;auth?:string}};
    let endpoint: URL; try { endpoint = new URL(subscription?.endpoint ?? ''); } catch { return json({error:'invalid_subscription'},400); }
    if (device.kind !== 'web' || endpoint.protocol !== 'https:' || !['fcm.googleapis.com','updates.push.services.mozilla.com','web.push.apple.com'].includes(endpoint.hostname) || endpoint.username || endpoint.password || endpoint.port || !subscription.keys?.p256dh || !subscription.keys.auth || subscription.keys.p256dh.length>1024 || subscription.keys.auth.length>512) return json({error:'invalid_subscription'},400);
    const now=Date.now();
    await env.DB.batch([
      env.DB.prepare('UPDATE receiver_delivery_channels SET revoked_at = ? WHERE endpoint = ? AND receiver_id = ? AND revoked_at IS NULL').bind(now,endpoint.href,device.id),
      env.DB.prepare("INSERT INTO receiver_delivery_channels (id,receiver_id,kind,endpoint,p256dh,auth,created_at,updated_at) VALUES (?,?,'web_push',?,?,?,?,?)").bind(crypto.randomUUID(),device.id,endpoint.href,subscription.keys.p256dh,subscription.keys.auth,now,now)
    ]); return json({status:'enabled'});
  }
  if (path === 'invitations' && request.method === 'POST') {
    for (let attempt = 0; attempt < 3; attempt++) {
      const code = createPairCode(); const response = await internal(env, `invite:${code}`, 'invite', { code, device });
      if (response.status !== 409) return response;
    }
    return json({ error: 'try_again' }, 503);
  }
  const invite = path.match(/^invitations\/([A-Z0-9-]+)(?:\/(claim|confirm))?$/i);
  if (invite) {
    const code = normalizePairCode(invite[1]); if (!code) return json({ error: 'invalid_code' }, 400);
    const action = invite[2] || 'status';
    if ((action === 'status' && request.method !== 'GET') || (action !== 'status' && request.method !== 'POST')) return json({ error: 'not_found' }, 404);
    return internal(env, `invite:${code}`, action, { device });
  }
  if (path === 'revoke' && request.method === 'POST') {
    const target = String(body.targetId ?? '');
    const relationships = await linkedDevices(env,device.id);
    if (!relationships.some(peer=>peer.id===target)) return json({error:'not_paired'},409);
    const legacy=await env.DB.prepare('SELECT id FROM pairings WHERE revoked_at IS NULL AND ((web_receiver_id = ? AND mobile_receiver_id = ?) OR (web_receiver_id = ? AND mobile_receiver_id = ?))').bind(device.id,target,target,device.id).all<{id:string}>();
    const token=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'') || cookie(request);
    for(const pair of legacy.results){
      const response=await env.PAIR_DO.get(env.PAIR_DO.idFromName(`pair:${pair.id}`)).fetch('https://pair.internal/revoke',{method:'POST',body:JSON.stringify({role:device.kind,token})});
      if(!response.ok)return json({error:'revoke_failed'},503);
      await revokePersistedPair(env,pair.id);
    }
    await env.DB.prepare('UPDATE peer_links SET revoked_at = ? WHERE revoked_at IS NULL AND ((first_id = ? AND second_id = ?) OR (first_id = ? AND second_id = ?))').bind(Date.now(),device.id,target,target,device.id).run();
    // Inbox reads re-authorize each event, so revocation fences old and concurrent deliveries.
    return json({ status: 'revoked' });
  }
  if (path === 'handoffs/status' && request.method === 'POST') {
    if (!Array.isArray(body.handoffs) || body.handoffs.length>20 || body.handoffs.some(value=>!value || typeof value!=='object' || typeof (value as any).code!=='string' || typeof (value as any).eventId!=='string')) return json({error:'invalid_request'},400);
    const peers=await linkedDevices(env,device.id);
    const handoffs=await Promise.all(body.handoffs.map(async value=>{
      const item=value as {code:string;eventId:string}; const target=item.code?.startsWith('peer:') ? item.code.slice(5) : '';
      if (!peers.some(peer=>peer.id===target) || !item.eventId?.startsWith(device!.id+':')) return {...item,status:'expired'};
      const response=await internal(env,`inbox:${target}`,'receipt',{eventId:item.eventId}); return {...item,...await response.json<{status:string}>()};
    }));const acknowledged=handoffs.filter(item=>item.status==='acknowledged').length,expired=handoffs.filter(item=>item.status==='expired').length;
    return json({handoffs,total:handoffs.length,acknowledged,expired,pending:handoffs.length-acknowledged-expired});
  }
  if (path === 'handoffs' && request.method === 'POST') {
    const data = validatePayload(body.data), requestId = body.requestId;
    const ids = Array.isArray(body.targetIds) ? [...new Set(body.targetIds)] : [];
    if (!data || typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{16,80}$/.test(requestId) || !ids.length || ids.length > 20 || ids.some(id => typeof id !== 'string' || id === device!.id)) return json({ error: 'invalid_request' }, 400);
    const peers = await linkedDevices(env, device.id);
    if (ids.some(id => !peers.some(peer => peer.id === id))) return json({ error: 'unauthorized' }, 401);
    const deliveries = await Promise.all(ids.map(async id => {
      const response = await internal(env, `inbox:${id}`, 'deliver', { sender: device, targetId: id, requestId, data });
      return { targetId: id, status: response.ok ? 'accepted' : 'failed' };
    }));
    return json({ deliveries }, deliveries.some(d => d.status === 'failed') ? 503 : 202);
  }
  if (path === 'events' && request.method === 'GET') return internal(env, `inbox:${device.id}`, 'events', { device });
  if (path === 'ack' && request.method === 'POST') return internal(env, `inbox:${device.id}`, 'ack', { device, eventId: body.eventId });
  return json({ error: 'not_found' }, 404);
}
export async function linkedDevices(env: PeerEnv, id: string) {
  const peers = await env.DB.prepare(`SELECT r.id,r.label,r.kind,p.id AS linkId,p.created_at AS createdAt,'peer' AS transport FROM peer_links p JOIN receivers r ON r.id = CASE WHEN p.first_id = ? THEN p.second_id ELSE p.first_id END WHERE (p.first_id = ? OR p.second_id = ?) AND p.revoked_at IS NULL AND r.revoked_at IS NULL ORDER BY p.created_at DESC`).bind(id,id,id).all<Device & { linkId: string; createdAt: number; transport: string }>();
  const legacy = await env.DB.prepare(`SELECT r.id,r.label,r.kind,p.id AS linkId,p.created_at AS createdAt,'legacy' AS transport FROM pairings p JOIN receivers r ON r.id = CASE WHEN p.web_receiver_id = ? THEN p.mobile_receiver_id ELSE p.web_receiver_id END WHERE (p.web_receiver_id = ? OR p.mobile_receiver_id = ?) AND p.revoked_at IS NULL AND r.revoked_at IS NULL`).bind(id,id,id).all<Device & { linkId: string; createdAt: number; transport: string }>();
  return [...new Map([...legacy.results,...peers.results].map(peer=>[peer.id,peer])).values()];
}
async function connected(env: PeerEnv, from: string, to: string) { return (await linkedDevices(env, from)).some(peer=>peer.id === to); }

// Existing PAIR_DO namespace, separate peer keys. This function receives only Worker-authenticated identities.
export async function peerRoom(ctx: DurableObjectState, env: PeerEnv, request: Request): Promise<Response> {
  const action = new URL(request.url).pathname.slice('/peer/'.length);
  const body = await request.json<any>();
  if (action === 'invite') {
    const existing = await ctx.storage.get<Invitation>('invitation');
    if (existing) return json({ error: 'code_in_use' }, 409);
    const invitation: Invitation = { code: body.code, owner: body.device, ownerConfirmed: false, claimantConfirmed: false, phrase: createConfirmationPhrase(), expiresAt: Date.now()+PAIR_TTL_MS, status: 'pending' };
    await ctx.storage.put('invitation',invitation); return json(invitation,201);
  }
  if (['claim','confirm','status'].includes(action)) {
    const invitation = await ctx.storage.get<Invitation>('invitation');
    if (!invitation) return json({ error: 'not_found' },404);
    const mine = body.device?.id === invitation.owner.id;
    if (action === 'status' && !mine && body.device?.id !== invitation.claimant?.id) return json({ error: 'unauthorized' },401);
    if (invitation.status === 'pending' && invitation.expiresAt <= Date.now()) { invitation.status = 'expired'; await ctx.storage.put('invitation', invitation); }
    if (action === 'status') return json(invitation);
    if (invitation.status !== 'pending') return json({ error: 'expired' },410);
    if (action === 'claim') {
      if (mine) return json({ error: 'self_pair' },400);
      if (invitation.claimant && invitation.claimant.id !== body.device.id) return json({ error: 'already_claimed' },409);
      invitation.claimant = body.device;
    } else {
      if (!invitation.claimant || (!mine && body.device.id !== invitation.claimant.id)) return json({ error: 'unauthorized' },401);
      if (mine) invitation.ownerConfirmed = true; else invitation.claimantConfirmed = true;
      if (invitation.ownerConfirmed && invitation.claimantConfirmed) {
        const [first,second] = [invitation.owner.id, invitation.claimant.id].sort();
        await env.DB.prepare('INSERT OR IGNORE INTO peer_links (id,first_id,second_id,created_at) VALUES (?,?,?,?)').bind(invitation.code,first,second,Date.now()).run();
        invitation.status = 'paired';
      }
    }
    await ctx.storage.put('invitation', invitation); return json(invitation);
  }
  const events = ((await ctx.storage.get<Event[]>('peer-events')) ?? []).filter(event=>event.expiresAt > Date.now());
  if (action === 'deliver') {
    const relationship = (await linkedDevices(env, body.sender.id)).find(peer=>peer.id===body.targetId);
    if (!relationship) return json({ error: 'not_paired' },409);
    const id = `${body.sender.id}:${body.requestId}`;
    const receipts = ((await ctx.storage.get<Receipt[]>('peer-receipts')) ?? []).filter(item=>item.expiresAt > Date.now());
    const payloadHash=await hashToken(body.data);const previous=receipts.find(event=>event.id===id);
    if (previous) return previous.payloadHash===payloadHash ? json({status:'accepted',id}) : json({error:'idempotency_conflict'},409);
    if (events.length >= 100) return json({ error: 'inbox_full' },429);
    const event: Event = { id, senderId: body.sender.id, senderLabel: body.sender.label, linkId: relationship.linkId, data: body.data, createdAt: Date.now(), expiresAt: Date.now()+HANDOFF_TTL_MS };
    events.push(event); receipts.push({id,expiresAt:event.expiresAt,payloadHash});
    const pushes = (await ctx.storage.get<Event[]>('peer-pushes')) ?? [];
    if (((await ctx.storage.get<number>('peer-last-poll')) ?? 0) < Date.now()-8000) pushes.push(event);
    await ctx.storage.put({ 'peer-events': events, 'peer-receipts': receipts, 'peer-pushes': pushes, 'peer-target': body.targetId });
    await ctx.storage.setAlarm(pushes.length ? Date.now()+1000 : Math.min(...events.map(event=>event.expiresAt)));
    return json({ status: 'accepted',id },202);
  }
  if (action === 'events') {
    await ctx.storage.put('peer-last-poll',Date.now());
    const fresh = [];
    for (const event of events) if ((await linkedDevices(env,event.senderId)).some(peer=>peer.id===body.device.id && peer.linkId===event.linkId)) fresh.push(event);
    await ctx.storage.put('peer-events',fresh);
    return json({ events: fresh.map(event=>{ const url=isSafeOpenUrl(event.data);return {...event,host:url?.host ?? null,openUrl:url?.href ?? null}; }) });
  }
  if (action === 'receipt') { const receipt=((await ctx.storage.get<Receipt[]>('peer-receipts'))??[]).find(item=>item.id===body.eventId && item.expiresAt>Date.now());return json({status:!receipt?'expired':receipt.acknowledged?'acknowledged':'pending'}); }
  if (action === 'ack') { const receipts=(await ctx.storage.get<Receipt[]>('peer-receipts'))??[];const receipt=receipts.find(item=>item.id===body.eventId);if(receipt)receipt.acknowledged=true;await ctx.storage.put({'peer-events':events.filter(event=>event.id!==body.eventId),'peer-receipts':receipts});return json({status:'acknowledged'}); }
  return json({error:'not_found'},404);
}
export async function peerAlarm(ctx: DurableObjectState, env: PeerEnv) {
  const now=Date.now();
  const {events,receipts,pushes}=await ctx.storage.transaction(async storage=>{
    const events=((await storage.get<Event[]>('peer-events'))??[]).filter(event=>event.expiresAt>now);
    const receipts=((await storage.get<Receipt[]>('peer-receipts'))??[]).filter(event=>event.expiresAt>now);
    const pushes=((await storage.get<Event[]>('peer-pushes'))??[]).filter(event=>event.expiresAt>now);
    await storage.put({'peer-events':events,'peer-receipts':receipts,'peer-pushes':pushes});
    return {events,receipts,pushes};
  });
  const target=await ctx.storage.get<string>('peer-target'); const pending: Event[]=[];
  for (const event of pushes) {
    if (!target || !(await linkedDevices(env,event.senderId)).some(peer=>peer.id===target && peer.linkId===event.linkId)) continue;
    const config={publicKey:env.VAPID_PUBLIC_KEY,privateKey:env.VAPID_PRIVATE_KEY,subject:env.VAPID_SUBJECT};
    if (!canSendPush(config)) continue;
    const channels=await env.DB.prepare("SELECT id,endpoint,p256dh,auth,kind FROM receiver_delivery_channels WHERE receiver_id = ? AND kind = 'web_push' AND revoked_at IS NULL").bind(target).all<DeliveryChannel>();
    let sent=false;
    for (const channel of channels.results) { const result=await sendHandoffPush(channel,config,event.id,'PEER');if(result.sent){sent=true;break;}if(result.expired)await env.DB.prepare('UPDATE receiver_delivery_channels SET revoked_at = ? WHERE id = ?').bind(now,channel.id).run(); }
    if (!sent && channels.results.length) pending.push(event);
  }
  await ctx.storage.transaction(async storage=>{const current=(await storage.get<Event[]>('peer-pushes'))??[];await storage.put('peer-pushes',[...current.filter(event=>event.expiresAt>Date.now() && !pushes.some(item=>item.id===event.id)),...pending]);});
  if (pending.length) { await ctx.storage.setAlarm(now+30000); return; }
  if (events.length || receipts.length) await ctx.storage.setAlarm(Math.min(...[...events,...receipts].map(event=>event.expiresAt)));
}

export async function revokePersistedPair(env: PeerEnv, code: string) {
  const now=Date.now();
  await env.DB.batch([
    env.DB.prepare('UPDATE peer_links SET revoked_at = ? WHERE revoked_at IS NULL AND EXISTS (SELECT 1 FROM pairings p WHERE p.id = ? AND ((peer_links.first_id = p.web_receiver_id AND peer_links.second_id = p.mobile_receiver_id) OR (peer_links.first_id = p.mobile_receiver_id AND peer_links.second_id = p.web_receiver_id)))').bind(now,code),
    env.DB.prepare('UPDATE pairings SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL').bind(now,code),
    env.DB.prepare('UPDATE connector_link_tokens SET used_at = ? WHERE pairing_id = ? AND used_at IS NULL').bind(now,code),
    env.DB.prepare("UPDATE receiver_delivery_channels SET revoked_at = ? WHERE kind = 'extension_push' AND receiver_id = (SELECT web_receiver_id FROM pairings WHERE id = ?) AND revoked_at IS NULL").bind(now,code),
    env.DB.prepare('UPDATE receiver_connectors SET revoked_at = ? WHERE receiver_id = (SELECT web_receiver_id FROM pairings WHERE id = ?) AND revoked_at IS NULL').bind(now,code)
  ]);
}
