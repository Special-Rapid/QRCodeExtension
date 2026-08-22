import { env, runInDurableObject, SELF } from 'cloudflare:test';
import { beforeEach, describe, expect, it } from 'vitest';

const schema = `
  CREATE TABLE IF NOT EXISTS receivers (id TEXT PRIMARY KEY, token_hash TEXT NOT NULL, kind TEXT NOT NULL, label TEXT NOT NULL, created_at INTEGER NOT NULL, revoked_at INTEGER);
  CREATE TABLE IF NOT EXISTS pairings (id TEXT PRIMARY KEY, web_receiver_id TEXT NOT NULL, mobile_receiver_id TEXT NOT NULL, created_at INTEGER NOT NULL, revoked_at INTEGER);
`;

beforeEach(async () => {
  await env.DB.exec(schema);
  await env.DB.exec('DELETE FROM pairings; DELETE FROM receivers;');
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
    const handoffAfterRevoke = await api('/api/v1/handoffs', { method: 'POST', body: JSON.stringify({ receiverId: mobile.receiverId, data: 'https://example.com/after-revoke' }), headers: { 'content-type': 'application/json', authorization: `Bearer ${mobile.token}` } });
    expect(handoffAfterRevoke.status).toBe(401);
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

  it('returns an extension-owned receiver token only to a Chrome extension origin', async () => {
    const denied = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ receiver: 'extension' }), headers: { 'content-type': 'application/json', origin: 'https://example.com' } });
    expect(denied.status).toBe(403);

    const created = await api('/api/v1/pairs', { method: 'POST', body: JSON.stringify({ receiver: 'extension', label: 'Chrome extension' }), headers: { 'content-type': 'application/json', origin: 'chrome-extension://test-extension' } });
    expect(created.headers.get('set-cookie')).toBeNull();
    const extension = await created.json<{ code: string; token: string; receiverId: string }>();
    expect(extension.token).toMatch(/^[-_A-Za-z0-9]+$/);

    const claimed = await api(`/api/v1/pairs/${extension.code}/claim`, { method: 'POST', body: JSON.stringify({ label: 'Phone' }), headers: { 'content-type': 'application/json' } });
    const mobile = await claimed.json<{ token: string; receiverId: string }>();
    await api(`/api/v1/pairs/${extension.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'web', token: extension.token }), headers: { 'content-type': 'application/json' } });
    await api(`/api/v1/pairs/${extension.code}/confirm`, { method: 'POST', body: JSON.stringify({ role: 'mobile', token: mobile.token }), headers: { 'content-type': 'application/json' } });
    const sent = await api('/api/v1/handoffs', { method: 'POST', body: JSON.stringify({ receiverId: mobile.receiverId, data: 'https://example.com/extension' }), headers: { 'content-type': 'application/json', authorization: `Bearer ${mobile.token}` } });
    expect(sent.status).toBe(201);
    const inbox = await api(`/api/v1/pairs/${extension.code}/events?receiver=${extension.receiverId}`, { headers: { authorization: `Bearer ${extension.token}` } });
    await expect(inbox.json()).resolves.toMatchObject({ events: [{ data: 'https://example.com/extension' }] });
  });
});
