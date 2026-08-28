import { env, runInDurableObject, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const schema = `
  CREATE TABLE IF NOT EXISTS receivers (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL, created_at INTEGER NOT NULL, revoked_at INTEGER);
  CREATE TABLE IF NOT EXISTS pairings (id TEXT PRIMARY KEY, web_receiver_id TEXT NOT NULL, mobile_receiver_id TEXT NOT NULL, created_at INTEGER NOT NULL, revoked_at INTEGER);
  CREATE TABLE IF NOT EXISTS receiver_connectors (id TEXT PRIMARY KEY, receiver_id TEXT NOT NULL, token_hash TEXT NOT NULL, extension_id TEXT NOT NULL, label TEXT NOT NULL, created_at INTEGER NOT NULL, last_seen_at INTEGER NOT NULL, revoked_at INTEGER);
  CREATE TABLE IF NOT EXISTS receiver_delivery_channels (id TEXT PRIMARY KEY, receiver_id TEXT NOT NULL, connector_id TEXT, kind TEXT NOT NULL, endpoint TEXT NOT NULL, p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, revoked_at INTEGER);
  CREATE TABLE IF NOT EXISTS connector_link_tokens (token_hash TEXT PRIMARY KEY, receiver_id TEXT NOT NULL, pairing_id TEXT NOT NULL, extension_id TEXT NOT NULL, expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL, used_at INTEGER);
`;

beforeEach(async () => {
  await env.DB.exec(schema);
  await env.DB.exec('DELETE FROM connector_link_tokens; DELETE FROM receiver_delivery_channels; DELETE FROM receiver_connectors; DELETE FROM pairings; DELETE FROM receivers;');
});

async function api(path: string, init: RequestInit = {}) {
  return SELF.fetch(new Request(`https://qr.test${path}`, init));
}

describe('handoff Worker integration', () => {
  it('requires both devices to confirm before a mobile payload reaches the web inbox', async () => {
    const created = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ label: 'Test Web' }), headers: { 'content-type': 'application/json' } });
    expect(created.status).toBe(200);
    const web = await created.json<{ code: string; receiverId: string }>();
    const webCookie = created.headers.get('set-cookie');
    expect(webCookie).toContain(`qr_pair_${web.code}=`);

    const claimed = await api(`/api/v1/pairs/${web.code}/claim`, { method: 'POST', body: JSON.stringify({ label: 'Test Phone' }), headers: { 'content-type': 'application/json' } });
    expect(claimed.status).toBe(200);
    const mobile = await claimed.json<{ token: string; receiverId: string }>();

    const webConfirmed = await api(`/api/v1/pairs/${web.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'web' }), headers: { 'content-type': 'application/json', cookie: webCookie! } });
    expect((await webConfirmed.json() as { status: string }).status).toBe('pending');

    const mobileConfirmed = await api(`/api/v1/pairs/${web.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'mobile', token: mobile.token }), headers: { 'content-type': 'application/json' } });
    expect((await mobileConfirmed.json() as { status: string }).status).toBe('paired');

    const socketResponse = await api(`/api/v1/pairs/${web.code}/ws`, { headers: { cookie: webCookie!, upgrade: 'websocket' } });
    expect(socketResponse.status).toBe(101);
    expect(socketResponse.webSocket).not.toBeNull();
    socketResponse.webSocket!.accept();

    const sent = await api('/api/v1/handoffs', { method: 'POST', body: JSON.stringify({ receiverId: mobile.receiverId, data: 'https://example.com/from-phone' }), headers: { 'content-type': 'application/json', authorization: `Bearer ${mobile.token}` } });
    expect(sent.status).toBe(201);

    const denied = await api(`/api/v1/pairs/${web.code}/events?receiver=${web.receiverId}`);
    expect(denied.status).toBe(401);

    const inbox = await api(`/api/v1/pairs/${web.code}/events?receiver=${web.receiverId}`, { headers: { cookie: webCookie! } });
    expect(inbox.status).toBe(200);
    await expect(inbox.json()).resolves.toMatchObject({ events: [{ data: 'https://example.com/from-phone', host: 'example.com' }] });

    const revoked = await api(`/api/v1/pairs/${web.code}/revoke`, { method: 'POST', body: '{}' , headers: { 'content-type': 'application/json', cookie: webCookie! } });
    expect(await revoked.json()).toEqual({ status: 'revoked' });
    const inboxAfterRevoke = await api(`/api/v1/pairs/${web.code}/events?receiver=${web.receiverId}`, { headers: { cookie: webCookie! } });
    expect(inboxAfterRevoke.status).toBe(401);
    const socketAfterRevoke = await api(`/api/v1/pairs/${web.code}/ws`, { headers: { cookie: webCookie!, upgrade: 'websocket' } });
    expect(socketAfterRevoke.status).toBe(401);
    const handoffAfterRevoke = await api('/api/v1/handoffs', { method: 'POST', body: JSON.stringify({ data: 'https://example.com/after-revoke' }), headers: { 'content-type': 'application/json', authorization: `Bearer ${mobile.token}` } });
    expect(handoffAfterRevoke.status).toBe(409);
  });

  it('fans one stable mobile identity out to multiple PC receivers and revokes only the chosen PC', async () => {
    const firstCreated = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ label: 'Mac のブラウザ' }), headers: { 'content-type': 'application/json' } });
    const firstWeb = await firstCreated.json<{ code: string; receiverId: string }>();
    const firstCookie = firstCreated.headers.get('set-cookie')!;
    const firstClaim = await api(`/api/v1/pairs/${firstWeb.code}/claim`, { method: 'POST', body: JSON.stringify({ label: 'Kenta の Android' }), headers: { 'content-type': 'application/json' } });
    const mobile = await firstClaim.json<{ token: string; receiverId: string }>();
    await api(`/api/v1/pairs/${firstWeb.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'web' }), headers: { 'content-type': 'application/json', cookie: firstCookie } });
    await api(`/api/v1/pairs/${firstWeb.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'mobile', token: mobile.token }), headers: { 'content-type': 'application/json' } });

    const secondCreated = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ label: 'Windows のブラウザ' }), headers: { 'content-type': 'application/json' } });
    const secondWeb = await secondCreated.json<{ code: string; receiverId: string }>();
    const secondCookie = secondCreated.headers.get('set-cookie')!;
    const secondClaim = await api(`/api/v1/pairs/${secondWeb.code}/claim`, { method: 'POST', body: JSON.stringify({ label: 'ignored', mobileReceiverId: mobile.receiverId, mobileToken: mobile.token }), headers: { 'content-type': 'application/json' } });
    expect(secondClaim.status).toBe(200);
    await expect(secondClaim.json()).resolves.toMatchObject({ receiverId: mobile.receiverId, token: mobile.token });
    await api(`/api/v1/pairs/${secondWeb.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'web' }), headers: { 'content-type': 'application/json', cookie: secondCookie } });
    await api(`/api/v1/pairs/${secondWeb.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'mobile', token: mobile.token }), headers: { 'content-type': 'application/json' } });

    const devices = await api('/api/v1/mobile/devices', { headers: { authorization: `Bearer ${mobile.token}` } });
    await expect(devices.json()).resolves.toMatchObject({ deviceCount: 2, devices: [{ id: secondWeb.code, label: 'Windows のブラウザ' }, { id: firstWeb.code, label: 'Mac のブラウザ' }] });

    const sent = await api('/api/v1/handoffs', { method: 'POST', body: JSON.stringify({ data: 'https://example.com/to-both' }), headers: { 'content-type': 'application/json', authorization: `Bearer ${mobile.token}` } });
    await expect(sent.json()).resolves.toEqual({ status: 'delivered', delivered: 2 });
    for (const [web, cookie] of [[firstWeb, firstCookie], [secondWeb, secondCookie]] as const) {
      const inbox = await api(`/api/v1/pairs/${web.code}/events?receiver=${web.receiverId}`, { headers: { cookie } });
      await expect(inbox.json()).resolves.toMatchObject({ events: [{ data: 'https://example.com/to-both' }] });
    }

    const revoked = await api(`/api/v1/pairs/${firstWeb.code}/revoke`, { method: 'POST', body: JSON.stringify({ role: 'mobile', token: mobile.token }), headers: { 'content-type': 'application/json' } });
    expect(revoked.status).toBe(200);
    const remaining = await api('/api/v1/mobile/devices', { headers: { authorization: `Bearer ${mobile.token}` } });
    await expect(remaining.json()).resolves.toMatchObject({ deviceCount: 1, devices: [{ id: secondWeb.code, label: 'Windows のブラウザ' }] });

    const sentAfterRevoke = await api('/api/v1/handoffs', { method: 'POST', body: JSON.stringify({ data: 'https://example.com/second-only' }), headers: { 'content-type': 'application/json', authorization: `Bearer ${mobile.token}` } });
    await expect(sentAfterRevoke.json()).resolves.toEqual({ status: 'delivered', delivered: 1 });
    const firstInbox = await api(`/api/v1/pairs/${firstWeb.code}/events?receiver=${firstWeb.receiverId}`, { headers: { cookie: firstCookie } });
    expect(firstInbox.status).toBe(401);
    const secondInbox = await api(`/api/v1/pairs/${secondWeb.code}/events?receiver=${secondWeb.receiverId}`, { headers: { cookie: secondCookie } });
    const secondEvents = await secondInbox.json<{ events: Array<{ data: string }> }>();
    expect(secondEvents.events.some((event) => event.data === 'https://example.com/second-only')).toBe(true);
  });

  it('allows the mobile receiver to revoke a paired connection', async () => {
    const created = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ label: 'Web' }), headers: { 'content-type': 'application/json' } });
    const web = await created.json<{ code: string; receiverId: string }>();
    const webCookie = created.headers.get('set-cookie');
    const claimed = await api(`/api/v1/pairs/${web.code}/claim`, { method: 'POST', body: JSON.stringify({ label: 'Phone' }), headers: { 'content-type': 'application/json' } });
    const mobile = await claimed.json<{ token: string; receiverId: string }>();
    await api(`/api/v1/pairs/${web.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'web' }), headers: { 'content-type': 'application/json', cookie: webCookie! } });
    await api(`/api/v1/pairs/${web.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'mobile', token: mobile.token }), headers: { 'content-type': 'application/json' } });

    const revoked = await api(`/api/v1/pairs/${web.code}/revoke`, { method: 'POST', body: JSON.stringify({ role: 'mobile', token: mobile.token }), headers: { 'content-type': 'application/json' } });
    expect(await revoked.json()).toEqual({ status: 'revoked' });
    const status = await api(`/api/v1/pairs/${web.code}/status`, { headers: { cookie: webCookie! } });
    await expect(status.json()).resolves.toMatchObject({ status: 'revoked' });
    const socket = await api(`/api/v1/pairs/${web.code}/ws`, { headers: { cookie: webCookie!, upgrade: 'websocket' } });
    expect(socket.status).toBe(401);
  });

  it('expires a pending pairing before it can be claimed', async () => {
    const created = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ label: 'Expiry Web' }), headers: { 'content-type': 'application/json' } });
    const pair = await created.json<{ code: string }>();
    const stub = env.PAIR_DO.getByName(`pair:${pair.code}`);
    await runInDurableObject(stub, async (instance, objectState) => {
      const session = await objectState.storage.get<{ expiresAt: number }>('pair-session');
      if (!session) throw new Error('pair session is missing');
      session.expiresAt = 0;
      await objectState.storage.put('pair-session', session);
      await instance.alarm();
    });

    const claimed = await api(`/api/v1/pairs/${pair.code}/claim`, { method: 'POST', body: JSON.stringify({ label: 'Late Phone' }), headers: { 'content-type': 'application/json' } });
    expect(claimed.status).toBe(410);
  });

  it('links a Chrome connector to an existing web receiver without a second mobile pairing', async () => {
    const created = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ label: 'Web' }), headers: { 'content-type': 'application/json' } });
    const web = await created.json<{ code: string }>();
    const webCookie = created.headers.get('set-cookie');
    const claimed = await api(`/api/v1/pairs/${web.code}/claim`, { method: 'POST', body: JSON.stringify({ label: 'Phone' }), headers: { 'content-type': 'application/json' } });
    const mobile = await claimed.json<{ token: string }>();
    await api(`/api/v1/pairs/${web.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'web' }), headers: { 'content-type': 'application/json', cookie: webCookie! } });
    await api(`/api/v1/pairs/${web.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'mobile', token: mobile.token }), headers: { 'content-type': 'application/json' } });

    const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
    const linked = await api(`/api/v1/pairs/${web.code}/connector-link`, { method: 'POST', body: JSON.stringify({ extensionId }), headers: { 'content-type': 'application/json', cookie: webCookie! } });
    const { token } = await linked.json<{ token: string }>();
    const connectorClaim = await api('/api/v1/connector-links/claim', { method: 'POST', body: JSON.stringify({ token, extensionId, subscription: { endpoint: 'https://push.example.test/connector', keys: { p256dh: 'key', auth: 'auth' } } }), headers: { 'content-type': 'application/json', origin: `chrome-extension://${extensionId}` } });
    expect(connectorClaim.status).toBe(201);
    const connector = await connectorClaim.json<{ connector: { id: string; token: string; code: string } }>();
    expect(connector.connector.code).toBe(web.code);

    const status = await api(`/api/v1/pairs/${web.code}/connector-status`, { headers: { cookie: webCookie! } });
    await expect(status.json()).resolves.toMatchObject({ connector: { id: connector.connector.id, extensionId } });
    const health = await api(`/api/v1/pairs/${web.code}/connector-health?connector=${connector.connector.id}`, { headers: { authorization: `Bearer ${connector.connector.token}` } });
    expect(health.status).toBe(200);
    await expect(health.json()).resolves.toEqual({ status: 'active' });
    const connectorSocket = await api(`/api/v1/pairs/${web.code}/connector-ws?connector=${connector.connector.id}`, { headers: { upgrade: 'websocket', 'sec-websocket-protocol': `qr-scan.${connector.connector.token}` } });
    expect(connectorSocket.status).toBe(101);

    const disconnected = await api(`/api/v1/pairs/${web.code}/connector-disconnect`, { method: 'POST', body: JSON.stringify({ extensionId }), headers: { 'content-type': 'application/json', cookie: webCookie! } });
    expect(disconnected.status).toBe(200);
    const afterDisconnect = await api(`/api/v1/pairs/${web.code}/connector-status`, { headers: { cookie: webCookie! } });
    await expect(afterDisconnect.json()).resolves.toEqual({ connector: null });

    const linkBeforeRevoke = await api(`/api/v1/pairs/${web.code}/connector-link`, { method: 'POST', body: JSON.stringify({ extensionId }), headers: { 'content-type': 'application/json', cookie: webCookie! } });
    const revocable = await linkBeforeRevoke.json<{ token: string }>();
    const revoked = await api(`/api/v1/pairs/${web.code}/revoke`, { method: 'POST', body: '{}', headers: { 'content-type': 'application/json', cookie: webCookie! } });
    expect(revoked.status).toBe(200);
    const rejectedAfterRevoke = await api('/api/v1/connector-links/claim', { method: 'POST', body: JSON.stringify({ token: revocable.token, extensionId, subscription: { endpoint: 'https://push.example.test/revoked', keys: { p256dh: 'key', auth: 'auth' } } }), headers: { 'content-type': 'application/json', origin: `chrome-extension://${extensionId}` } });
    expect(rejectedAfterRevoke.status).toBe(410);
    const oldExtensionPairing = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ receiver: 'extension' }), headers: { 'content-type': 'application/json', origin: `chrome-extension://${extensionId}` } });
    expect(oldExtensionPairing.status).toBe(410);
  });
});
