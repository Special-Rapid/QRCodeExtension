import { DurableObject } from "cloudflare:workers";
import { createConfirmationPhrase, createOpaqueToken, createPairCode, HANDOFF_TTL_MS, hashToken, isSafeOpenUrl, normalizePairCode, PAIR_TTL_MS, type ReceiverRole, validateLabel, validatePayload } from "./protocol";

type Env = {
  ASSETS: Fetcher;
  DB: D1Database;
  PAIR_DO: DurableObjectNamespace<PairingRoom>;
};

type SessionReceiver = {
  id: string;
  tokenHash: string;
  label: string;
  confirmed: boolean;
};

type PairSession = {
  code: string;
  phrase: string;
  expiresAt: number;
  status: "pending" | "paired" | "expired" | "revoked";
  web: SessionReceiver;
  mobile?: SessionReceiver;
};

type HandoffEvent = {
  id: string;
  data: string;
  createdAt: number;
  expiresAt: number;
};

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" };

export class PairingRoom extends DurableObject<Env> {
  private readonly sessionKey = "pair-session";
  private readonly eventsKey = "handoff-events";

  async fetch(request: Request) {
    const url = new URL(request.url);
    if (url.pathname === "/rate" && request.method === "POST") return this.rateLimit();

    if (request.method === "GET" && url.pathname === "/status") return this.status(request);
    if (request.method === "GET" && url.pathname === "/events") return this.events(request);
    if (request.method === "GET" && url.pathname === "/ws") return this.socket(request);

    const body = await request.json<Record<string, unknown>>().catch(() => null);
    if (!body) return json({ error: "invalid_request" }, 400);
    if (request.method === "POST" && url.pathname === "/create") return this.create(body);
    if (request.method === "POST" && url.pathname === "/claim") return this.claim(body);
    if (request.method === "POST" && url.pathname === "/confirm") return this.confirm(body);
    if (request.method === "POST" && url.pathname === "/revoke") return this.revoke(body);
    if (request.method === "POST" && url.pathname === "/handoffs") return this.createHandoff(body);
    return json({ error: "not_found" }, 404);
  }

  async alarm() {
    const session = await this.getSession();
    const events = await this.getEvents();
    const now = Date.now();
    if (session && session.status === "pending" && session.expiresAt <= now) {
      session.status = "expired";
      await this.saveSession(session);
      this.broadcast({ type: "expired" });
    }
    const freshEvents = events.filter((event) => event.expiresAt > now);
    await this.saveEvents(freshEvents);
    await this.scheduleAlarm(session, freshEvents);
  }

  private async rateLimit() {
    const now = Date.now();
    const windowStart = now - 60_000;
    const values = (await this.ctx.storage.get<number[]>("attempts")) ?? [];
    const attempts = values.filter((timestamp) => timestamp > windowStart);
    if (attempts.length >= 20) return json({ error: "rate_limited" }, 429);
    attempts.push(now);
    await this.ctx.storage.put("attempts", attempts);
    return json({ ok: true });
  }

  private async create(body: Record<string, unknown>) {
    const existing = await this.getSession();
    if (existing && existing.status === "pending" && existing.expiresAt > Date.now()) return json({ error: "code_in_use" }, 409);
    const code = normalizePairCode(String(body.code ?? ""));
    if (!code) return json({ error: "invalid_code" }, 400);

    const token = createOpaqueToken();
    const session: PairSession = {
      code,
      phrase: createConfirmationPhrase(),
      expiresAt: Date.now() + PAIR_TTL_MS,
      status: "pending",
      web: { id: crypto.randomUUID(), tokenHash: await hashToken(token), label: validateLabel(body.label, "このブラウザ"), confirmed: false }
    };
    await this.saveSession(session);
    await this.scheduleAlarm(session, []);
    return json({ code, phrase: session.phrase, expiresAt: session.expiresAt, receiverId: session.web.id, token });
  }

  private async claim(body: Record<string, unknown>) {
    const session = await this.requirePendingSession();
    if (session instanceof Response) return session;
    if (session.mobile) return json({ error: "already_claimed" }, 409);
    const token = createOpaqueToken();
    session.mobile = { id: crypto.randomUUID(), tokenHash: await hashToken(token), label: validateLabel(body.label, "このスマホ"), confirmed: false };
    await this.saveSession(session);
    this.broadcast({ type: "claimed", phrase: session.phrase, mobileLabel: session.mobile.label });
    return json({ code: session.code, phrase: session.phrase, expiresAt: session.expiresAt, receiverId: session.mobile.id, token });
  }

  private async confirm(body: Record<string, unknown>) {
    const session = await this.requirePendingSession();
    if (session instanceof Response) return session;
    const receiver = await this.authorizeSessionReceiver(session, body);
    if (!receiver) return json({ error: "unauthorized" }, 401);
    receiver.confirmed = true;
    if (session.web.confirmed && session.mobile?.confirmed) {
      session.status = "paired";
      await this.persistPair(session);
      this.broadcast({ type: "paired", phrase: session.phrase, webLabel: session.web.label, mobileLabel: session.mobile.label });
    }
    await this.saveSession(session);
    await this.scheduleAlarm(session, await this.getEvents());
    return json({ status: session.status, phrase: session.phrase, peerConfirmed: session.web.confirmed && session.mobile?.confirmed });
  }

  private async status(request: Request) {
    const session = await this.getSession();
    if (!session) return json({ error: "not_found" }, 404);
    const role = request.headers.get("x-qr-role") as ReceiverRole | null;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    const receiver = role === "web" ? session.web : role === "mobile" ? session.mobile : undefined;
    if (!receiver || receiver.tokenHash !== await hashToken(token)) return json({ error: "unauthorized" }, 401);
    if (session.status === "pending" && session.expiresAt <= Date.now()) {
      session.status = "expired";
      await this.saveSession(session);
    }
    return json({ status: session.status, code: session.code, phrase: session.phrase, expiresAt: session.expiresAt, receiverId: receiver.id, selfConfirmed: receiver.confirmed, peerLabel: role === "web" ? session.mobile?.label ?? null : session.web.label, peerConfirmed: role === "web" ? session.mobile?.confirmed ?? false : session.web.confirmed });
  }

  private async createHandoff(body: Record<string, unknown>) {
    const session = await this.getSession();
    if (!session || session.status !== "paired" || !session.mobile) return json({ error: "not_paired" }, 409);
    if (body.senderId !== session.mobile.id) return json({ error: "unauthorized" }, 401);
    const data = validatePayload(body.data);
    if (!data) return json({ error: "invalid_payload" }, 400);
    const events = await this.getEvents();
    const event = { id: crypto.randomUUID(), data, createdAt: Date.now(), expiresAt: Date.now() + HANDOFF_TTL_MS };
    events.push(event);
    await this.saveEvents(events);
    await this.scheduleAlarm(session, events);
    this.broadcast({ type: "handoff", event: publicEvent(event) }, "web");
    return json({ event: publicEvent(event) }, 201);
  }

  private async revoke(body: Record<string, unknown>) {
    const session = await this.getSession();
    if (!session) return json({ error: "not_found" }, 404);
    if (session.status !== "paired") return json({ error: "not_paired" }, 409);
    const receiver = await this.authorizeSessionReceiver(session, body);
    if (!receiver) return json({ error: "unauthorized" }, 401);
    session.status = "revoked";
    await this.saveSession(session);
    await this.saveEvents([]);
    await this.ctx.storage.deleteAlarm();
    this.broadcast({ type: "revoked", by: receiver.label });
    for (const socket of this.ctx.getWebSockets()) socket.close(1000, "pair revoked");
    return json({ status: "revoked" });
  }

  private async events(request: Request) {
    const session = await this.getSession();
    const receiverId = new URL(request.url).searchParams.get("receiver");
    if (!session || session.status !== "paired" || receiverId !== session.web.id) return json({ error: "unauthorized" }, 401);
    const events = (await this.getEvents()).filter((event) => event.expiresAt > Date.now());
    await this.saveEvents(events);
    return json({ events: events.map(publicEvent) });
  }

  private async socket(request: Request) {
    if (request.headers.get("Upgrade") !== "websocket") return json({ error: "upgrade_required" }, 426);
    const session = await this.getSession();
    const token = request.headers.get("x-qr-web-token") ?? "";
    if (!session || session.status !== "paired" || session.web.tokenHash !== await hashToken(token)) return json({ error: "unauthorized" }, 401);
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);
    this.ctx.acceptWebSocket(server, ["web"]);
    server.serializeAttachment({ role: "web" });
    server.send(JSON.stringify({ type: "state", status: session.status, phrase: session.phrase, expiresAt: session.expiresAt, mobileLabel: session.mobile?.label ?? null, webConfirmed: session.web.confirmed, mobileConfirmed: session.mobile?.confirmed ?? false }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(socket: WebSocket, message: string | ArrayBuffer) {
    if (typeof message !== "string") socket.close(1003, "text only");
  }

  private broadcast(message: Record<string, unknown>, tag?: string) {
    for (const socket of this.ctx.getWebSockets(tag)) socket.send(JSON.stringify(message));
  }

  private async requirePendingSession() {
    const session = await this.getSession();
    if (!session) return json({ error: "not_found" }, 404);
    if (session.status !== "pending" || session.expiresAt <= Date.now()) return json({ error: "expired" }, 410);
    return session;
  }

  private async authorizeSessionReceiver(session: PairSession, body: Record<string, unknown>) {
    const role = body.role as ReceiverRole;
    const token = typeof body.token === "string" ? body.token : "";
    const receiver = role === "web" ? session.web : role === "mobile" ? session.mobile : undefined;
    return receiver && receiver.tokenHash === await hashToken(token) ? receiver : null;
  }

  private async persistPair(session: PairSession) {
    if (!session.mobile) return;
    const now = Date.now();
    await this.env.DB.batch([
      this.env.DB.prepare("INSERT OR IGNORE INTO receivers (id, token_hash, kind, label, created_at) VALUES (?, ?, 'web', ?, ?)").bind(session.web.id, session.web.tokenHash, session.web.label, now),
      this.env.DB.prepare("INSERT OR IGNORE INTO receivers (id, token_hash, kind, label, created_at) VALUES (?, ?, 'mobile', ?, ?)").bind(session.mobile.id, session.mobile.tokenHash, session.mobile.label, now),
      this.env.DB.prepare("INSERT OR IGNORE INTO pairings (id, web_receiver_id, mobile_receiver_id, created_at) VALUES (?, ?, ?, ?)").bind(session.code, session.web.id, session.mobile.id, now)
    ]);
  }

  private async getSession() { return (await this.ctx.storage.get<PairSession>(this.sessionKey)) ?? null; }
  private async saveSession(session: PairSession) { await this.ctx.storage.put(this.sessionKey, session); }
  private async getEvents() { return (await this.ctx.storage.get<HandoffEvent[]>(this.eventsKey)) ?? []; }
  private async saveEvents(events: HandoffEvent[]) { await this.ctx.storage.put(this.eventsKey, events); }
  private async scheduleAlarm(session: PairSession | null, events: HandoffEvent[]) {
    const deadlines = [session?.status === "pending" ? session.expiresAt : undefined, ...events.map((event) => event.expiresAt)].filter((value): value is number => typeof value === "number");
    if (deadlines.length) await this.ctx.storage.setAlarm(Math.min(...deadlines));
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders(request) });

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (request.method === "POST" && (url.pathname === "/api/v1/pairs" || url.pathname.endsWith("/claim"))) {
      const rate = await env.PAIR_DO.get(env.PAIR_DO.idFromName(`rate:${ip}`)).fetch("https://pair.internal/rate", { method: "POST" });
      if (!rate.ok) return withCors(json({ error: "rate_limited" }, 429), request);
    }

    if (request.method === "POST" && url.pathname === "/api/v1/pairs") {
      const body = await request.json<Record<string, unknown>>().catch((): Record<string, unknown> => ({}));
      const extensionReceiver = isExtensionPairRequest(request, body);
      if (body.receiver === "extension" && !extensionReceiver) return withCors(json({ error: "extension_origin_required" }, 403), request);
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const code = createPairCode();
        const response = await pairStub(env, code).fetch("https://pair.internal/create", jsonRequest({ ...body, code }));
        if (response.status !== 409) return extensionReceiver ? withCors(response, request) : withPairCookie(response, request, code);
      }
      return withCors(json({ error: "try_again" }, 503), request);
    }

    const match = url.pathname.match(/^\/api\/v1\/pairs\/([A-Z0-9-]+)(?:\/(claim|confirm|revoke|status|events|ws))?$/i);
    if (match) {
      const code = normalizePairCode(match[1]);
      if (!code) return withCors(json({ error: "invalid_code" }, 400), request);
      const action = match[2] ?? "status";
      const webToken = cookieValue(request, `qr_pair_${code}`);
      if (action === "events") {
        const token = bearerToken(request) || webToken;
        const receiverId = url.searchParams.get("receiver") ?? "";
        const membership = token && receiverId ? await env.DB.prepare("SELECT p.id FROM receivers r JOIN pairings p ON p.web_receiver_id = r.id WHERE r.id = ? AND r.token_hash = ? AND r.kind = 'web' AND r.revoked_at IS NULL AND p.id = ? AND p.revoked_at IS NULL").bind(receiverId, await hashToken(token), code).first() : null;
        if (!membership) return withCors(json({ error: "unauthorized" }, 401), request);
      }
      const forwardUrl = new URL(`https://pair.internal/${action}`);
      forwardUrl.search = url.search;
      const headers = new Headers(request.headers);
      headers.delete("host");
      if (action === "status" && webToken && !bearerToken(request)) {
        headers.set("authorization", `Bearer ${webToken}`);
        headers.set("x-qr-role", "web");
      }
      if (action === "ws" && webToken) headers.set("x-qr-web-token", webToken);
      let forwardedBody: BodyInit | null | undefined = request.method === "GET" ? undefined : request.body;
      if ((action === "confirm" || action === "revoke") && webToken && !bearerToken(request)) {
        const body = await request.json<Record<string, unknown>>().catch(() => ({}));
        forwardedBody = JSON.stringify({ ...body, role: "web", token: webToken });
        headers.set("content-type", "application/json");
      }
      const response = await pairStub(env, code).fetch(new Request(forwardUrl, { method: request.method, headers, body: forwardedBody }));
      if (action === "revoke" && response.ok) {
        await revokePersistedPair(env, code);
        if (webToken && !bearerToken(request)) return clearPairCookie(response, request, code);
      }
      return withCors(response, request);
    }

    if (request.method === "POST" && url.pathname === "/api/v1/handoffs") return withCors(await sendHandoff(request, env), request);
    return withCors(json({ error: "not_found" }, 404), request);
  }
} satisfies ExportedHandler<Env>;

async function sendHandoff(request: Request, env: Env) {
  const token = bearerToken(request);
  const body = await request.json<Record<string, unknown>>().catch(() => null);
  if (!token || !body) return json({ error: "unauthorized" }, 401);
  const receiverId = typeof body.receiverId === "string" ? body.receiverId : "";
  const data = validatePayload(body.data);
  if (!receiverId || !data) return json({ error: "invalid_request" }, 400);
  const tokenHash = await hashToken(token);
  const receiver = await env.DB.prepare("SELECT id FROM receivers WHERE id = ? AND token_hash = ? AND kind = 'mobile' AND revoked_at IS NULL").bind(receiverId, tokenHash).first<{ id: string }>();
  if (!receiver) return json({ error: "unauthorized" }, 401);
  const pairing = await env.DB.prepare("SELECT id FROM pairings WHERE mobile_receiver_id = ? AND revoked_at IS NULL").bind(receiverId).first<{ id: string }>();
  if (!pairing) return json({ error: "not_paired" }, 409);
  return pairStub(env, pairing.id).fetch("https://pair.internal/handoffs", jsonRequest({ senderId: receiverId, data }));
}

async function revokePersistedPair(env: Env, code: string) {
  const now = Date.now();
  await env.DB.batch([
    env.DB.prepare("UPDATE pairings SET revoked_at = ? WHERE id = ? AND revoked_at IS NULL").bind(now, code),
    env.DB.prepare("UPDATE receivers SET revoked_at = ? WHERE id IN (SELECT web_receiver_id FROM pairings WHERE id = ? UNION SELECT mobile_receiver_id FROM pairings WHERE id = ?) AND revoked_at IS NULL").bind(now, code, code)
  ]);
}

function pairStub(env: Env, code: string) { return env.PAIR_DO.get(env.PAIR_DO.idFromName(`pair:${code}`)); }
function bearerToken(request: Request) { return request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? ""; }
function json(data: unknown, status = 200) { return Response.json(data, { status, headers: JSON_HEADERS }); }
function jsonRequest(data: unknown) { return new Request("https://pair.internal", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(data) }); }
function publicEvent(event: HandoffEvent) { const url = isSafeOpenUrl(event.data); return { id: event.id, data: event.data, host: url?.host ?? null, createdAt: event.createdAt, expiresAt: event.expiresAt }; }
function isExtensionPairRequest(request: Request, body: Record<string, unknown>) { return body.receiver === "extension" && request.headers.get("origin")?.startsWith("chrome-extension://") === true; }
function corsHeaders(request: Request): Record<string, string> {
  const origin = request.headers.get("origin");
  return origin === "https://qr.snkisk.com" || origin?.startsWith("http://localhost:") || origin?.startsWith("chrome-extension://")
    ? { "access-control-allow-origin": origin, "access-control-allow-headers": "authorization, content-type, x-qr-role", "access-control-allow-methods": "GET, POST, OPTIONS", "vary": "Origin" }
    : {};
}
function withCors(response: Response, request: Request) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  if (response.webSocket) return new Response(null, { status: response.status, statusText: response.statusText, headers, webSocket: response.webSocket });
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function withPairCookie(response: Response, request: Request, code: string) {
  if (!response.ok) return withCors(response, request);
  return response.json<{ token?: string }>().then((data) => {
    const headers = new Headers(JSON_HEADERS);
    for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
    const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
    if (data.token) headers.append("set-cookie", `qr_pair_${code}=${data.token}; HttpOnly${secure}; SameSite=Strict; Path=/api/v1/pairs/${code}; Max-Age=2592000`);
    const { token: _token, ...publicData } = data;
    return Response.json(publicData, { status: response.status, headers });
  });
}
function clearPairCookie(response: Response, request: Request, code: string) {
  const headers = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders(request))) headers.set(key, value);
  const secure = new URL(request.url).protocol === "https:" ? "; Secure" : "";
  headers.append("set-cookie", `qr_pair_${code}=; HttpOnly${secure}; SameSite=Strict; Path=/api/v1/pairs/${code}; Max-Age=0`);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
function cookieValue(request: Request, name: string) { return request.headers.get("cookie")?.split(";").map((entry) => entry.trim()).find((entry) => entry.startsWith(`${name}=`))?.slice(name.length + 1) ?? ""; }
