import { toSafeHttpUrl } from "./safe-url.js";

const CONNECTOR_KEY = "qr-scan-connector";
const PENDING_ACKS_KEY = "qr-scan-pending-acks";
const ACK_RETRY_ALARM = "qr-scan-ack-retry";
const API_ORIGIN = "https://qr.snkisk.com";
const PROTOCOL_PREFIX = "qr-scan.";
let socket = null;
let heartbeat = null;
let pendingAckMutation = Promise.resolve();

chrome.runtime.onStartup.addListener(() => { void retryPendingAcks(); void connect(); });
chrome.runtime.onInstalled.addListener(() => { void retryPendingAcks(); void connect(); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === ACK_RETRY_ALARM) void retryPendingAcks(); });
chrome.notifications.onClicked.addListener((id) => {
  if (!id.startsWith("qr-scan-handoff:")) return;
  void openHandoff(id.slice("qr-scan-handoff:".length));
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse, (error) => sendResponse({ ok: false, error: messageFor(error) }));
  return true;
});
if (typeof self !== "undefined") self.addEventListener("push", (event) => { event.waitUntil(handlePush(event)); });

async function handleMessage(message) {
  if (message?.type === "connector.claim") return { ok: true, state: await claimConnector(message) };
  if (message?.type === "connector.get") return { ok: true, state: await state() };
  if (message?.type === "connector.open-inbox") { await chrome.tabs.create({ url: `${API_ORIGIN}/` }); return { ok: true, state: await state() }; }
  throw new Error("request_failed");
}

async function claimConnector(message) {
  const token = typeof message.token === "string" ? message.token : "";
  const extensionId = typeof message.extensionId === "string" ? message.extensionId : "";
  if (!token || extensionId !== chrome.runtime.id) throw new Error("link_expired");
  const { publicKey } = await api("/api/v1/vapid-public-key");
  let subscription = await globalThis.registration.pushManager.getSubscription();
  if (!subscription) subscription = await globalThis.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: base64UrlToUint8Array(publicKey) });
  const { connector } = await api("/api/v1/connector-links/claim", { method: "POST", body: { token, extensionId, subscription: subscription.toJSON() } });
  await chrome.storage.local.set({ [CONNECTOR_KEY]: connector });
  await connect();
  return state();
}

async function handlePush(event) {
  let data = null;
  try { data = event.data?.json() ?? null; } catch { data = null; }
  if (data?.type !== "handoff") return;
  await receiveHandoff(data.eventId);
  await connect();
}

async function connect() {
  const connector = await getConnector();
  if (!connector || socket) return;
  if (!await connectorIsActive(connector)) return;
  const protocol = API_ORIGIN.startsWith("https:") ? "wss:" : "ws:";
  const activeSocket = new WebSocket(`${protocol}//${new URL(API_ORIGIN).host}/api/v1/pairs/${encodeURIComponent(connector.code)}/connector-ws?connector=${encodeURIComponent(connector.id)}`, [`${PROTOCOL_PREFIX}${connector.token}`]);
  socket = activeSocket;
  activeSocket.addEventListener("open", () => { heartbeat = setInterval(() => socket?.readyState === WebSocket.OPEN && socket.send("ping"), 20_000); });
  activeSocket.addEventListener("message", (event) => {
    const data = JSON.parse(event.data);
    if (data.type === "handoff") void receiveHandoff(data.eventId);
    if (data.type === "revoked" || data.type === "connector_disconnected") void clearConnector();
  });
  activeSocket.addEventListener("close", () => {
    if (socket !== activeSocket) return;
    clearSocket();
    setTimeout(() => { void connect(); }, 5_000);
  });
  activeSocket.addEventListener("error", () => activeSocket.close());
  void retryPendingAcks();
}

async function connectorIsActive(connector) {
  try {
    await api(`/api/v1/pairs/${encodeURIComponent(connector.code)}/connector-health?connector=${encodeURIComponent(connector.id)}`, { headers: { authorization: `Bearer ${connector.token}` } });
    return true;
  } catch (error) {
    if (error instanceof Error && ["unauthorized", "not_paired", "not_found"].includes(error.message)) await clearConnector();
    return false;
  }
}

async function notify(eventId) {
  const notificationId = typeof eventId === "string" && eventId ? `qr-scan-handoff:${eventId}` : `qr-scan-handoff:${crypto.randomUUID()}`;
  await chrome.notifications.create(notificationId, { type: "basic", title: "QR Scan に届きました", message: "新しい読み取り結果があります。", iconUrl: chrome.runtime.getURL("icon-128.png") });
}

async function receiveHandoff(eventId) {
  await notify(eventId);
  await acknowledgeHandoff(eventId);
}

async function acknowledgeHandoff(eventId) {
  if (typeof eventId !== "string" || !eventId) return;
  const connector = await getConnector();
  if (!connector) return;
  try {
    await api(`/api/v1/pairs/${encodeURIComponent(connector.code)}/ack?connector=${encodeURIComponent(connector.id)}`, { method: "POST", headers: { authorization: `Bearer ${connector.token}` }, body: { eventId } });
    await removePendingAck(connector, eventId);
  } catch (error) {
    if (error instanceof Error && ["unauthorized", "not_paired", "not_found"].includes(error.message)) await clearConnector();
    else await queuePendingAck(connector, eventId);
  }
}

async function queuePendingAck(connector, eventId) {
  await mutatePendingAcks(async (records) => {
    const current = await getConnector();
    // A connector can be revoked while the failed ACK is still in flight.
    // Do not recreate retry state after that revocation has removed it.
    if (!current || current.id !== connector.id || current.code !== connector.code) return null;
    if (!records.some((item) => item.connectorId === connector.id && item.code === connector.code && item.eventId === eventId)) {
      records.push({ connectorId: connector.id, code: connector.code, eventId, expiresAt: Date.now() + 10 * 60 * 1000 });
    }
    chrome.alarms.create(ACK_RETRY_ALARM, { when: Date.now() + 30_000 });
    return records;
  });
}

async function removePendingAck(connector, eventId) {
  await mutatePendingAcks(async (records) => {
    const current = await getConnector();
    // A successful in-flight ACK must not recreate an empty retry key after
    // another event has already invalidated this connector.
    if (!current || current.id !== connector.id || current.code !== connector.code) return null;
    return records.filter((item) => item.connectorId !== connector.id || item.code !== connector.code || item.eventId !== eventId);
  });
}

async function retryPendingAcks() {
  let clearAfterRetry = false;
  await mutatePendingAcks(async (records) => {
    const connector = await getConnector();
    const now = Date.now();
    if (!connector) {
      clearAfterRetry = true;
      return null;
    }
    const remaining = [];
    for (const item of records) {
      if (item.expiresAt <= now) continue;
      if (connector.id !== item.connectorId || connector.code !== item.code) continue;
      try {
        await api(`/api/v1/pairs/${encodeURIComponent(connector.code)}/ack?connector=${encodeURIComponent(connector.id)}`, { method: "POST", headers: { authorization: `Bearer ${connector.token}` }, body: { eventId: item.eventId } });
      } catch (error) {
        if (error instanceof Error && ["unauthorized", "not_paired", "not_found"].includes(error.message)) {
          // Remove the connector before releasing this serialized mutation so
          // any already-running failed ACK cannot enqueue stale retry work.
          await chrome.storage.local.remove(CONNECTOR_KEY);
          clearAfterRetry = true;
          return null;
        }
        remaining.push(item);
      }
    }
    if (remaining.length) chrome.alarms.create(ACK_RETRY_ALARM, { when: now + 30_000 });
    else await chrome.alarms.clear(ACK_RETRY_ALARM);
    return remaining;
  });
  if (clearAfterRetry) await clearConnector();
}

async function openHandoff(eventId) {
  try {
    const destination = await handoffUrl(eventId);
    await chrome.tabs.create({ url: destination ?? `${API_ORIGIN}/` });
  } catch {
    await chrome.tabs.create({ url: `${API_ORIGIN}/` });
  }
}

async function handoffUrl(eventId) {
  if (typeof eventId !== "string" || !eventId) return null;
  const connector = await getConnector();
  if (!connector) return null;
  const { events } = await api(`/api/v1/pairs/${encodeURIComponent(connector.code)}/connector-events?connector=${encodeURIComponent(connector.id)}&event=${encodeURIComponent(eventId)}`, { headers: { authorization: `Bearer ${connector.token}` } });
  const event = Array.isArray(events) ? events.find((item) => item?.id === eventId) : null;
  return safeHttpUrl(event?.data);
}

function safeHttpUrl(value) {
  return toSafeHttpUrl(value)?.toString() ?? null;
}

async function clearConnector() {
  clearSocket();
  // Removing the connector first makes all queued retry mutations resolve to
  // the deletion sentinel below rather than writing a stale record back.
  await chrome.storage.local.remove(CONNECTOR_KEY);
  await mutatePendingAcks(() => null);
  await chrome.alarms.clear(ACK_RETRY_ALARM);
}
function clearSocket() { const active = socket; socket = null; if (heartbeat) clearInterval(heartbeat); heartbeat = null; active?.close(); }
async function getConnector() { return (await chrome.storage.local.get(CONNECTOR_KEY))[CONNECTOR_KEY] ?? null; }
async function pendingAcks() {
  const value = (await chrome.storage.local.get(PENDING_ACKS_KEY))[PENDING_ACKS_KEY];
  return Array.isArray(value) ? value.filter((item) => item && typeof item.connectorId === "string" && typeof item.code === "string" && typeof item.eventId === "string" && typeof item.expiresAt === "number") : [];
}
function mutatePendingAcks(mutation) {
  const run = pendingAckMutation.then(async () => {
    const next = await mutation(await pendingAcks());
    if (next === null) await chrome.storage.local.remove(PENDING_ACKS_KEY);
    else await chrome.storage.local.set({ [PENDING_ACKS_KEY]: next });
  });
  pendingAckMutation = run.catch(() => undefined);
  return run;
}
async function state() { const connector = await getConnector(); return { connector: connector ? { id: connector.id, code: connector.code } : null }; }
async function api(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "request_failed");
  return data;
}
function base64UrlToUint8Array(value) { const padded = value + "=".repeat((4 - value.length % 4) % 4); const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function messageFor(error) { return error instanceof Error ? ({ link_expired: "Web側からもう一度接続してください。", push_unavailable: "通知の準備中です。" })[error.message] ?? "Chrome接続に失敗しました。" : "Chrome接続に失敗しました。"; }
