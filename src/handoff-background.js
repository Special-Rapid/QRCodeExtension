import { toSafeHttpUrl } from "./safe-url.js";

const CONNECTOR_KEY = "qr-scan-connector";
const API_ORIGIN = "https://qr.snkisk.com";
const PROTOCOL_PREFIX = "qr-scan.";
let socket = null;
let heartbeat = null;

chrome.runtime.onStartup.addListener(() => { void connect(); });
chrome.runtime.onInstalled.addListener(() => { void connect(); });
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
  if (!subscription) subscription = await globalThis.registration.pushManager.subscribe({ userVisibleOnly: false, applicationServerKey: base64UrlToUint8Array(publicKey) });
  const { connector } = await api("/api/v1/connector-links/claim", { method: "POST", body: { token, extensionId, subscription: subscription.toJSON() } });
  await chrome.storage.local.set({ [CONNECTOR_KEY]: connector });
  await connect();
  return state();
}

async function handlePush(event) {
  let data = null;
  try { data = event.data?.json() ?? null; } catch { data = null; }
  if (data?.type !== "handoff") return;
  await notify(data.eventId);
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
    if (data.type === "handoff") void notify(data.eventId);
    if (data.type === "revoked" || data.type === "connector_disconnected") void clearConnector();
  });
  activeSocket.addEventListener("close", () => {
    if (socket !== activeSocket) return;
    clearSocket();
    setTimeout(() => { void connect(); }, 5_000);
  });
  activeSocket.addEventListener("error", () => activeSocket.close());
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

async function clearConnector() { clearSocket(); await chrome.storage.local.remove(CONNECTOR_KEY); }
function clearSocket() { const active = socket; socket = null; if (heartbeat) clearInterval(heartbeat); heartbeat = null; active?.close(); }
async function getConnector() { return (await chrome.storage.local.get(CONNECTOR_KEY))[CONNECTOR_KEY] ?? null; }
async function state() { const connector = await getConnector(); return { connector: connector ? { id: connector.id, code: connector.code } : null }; }
async function api(path, options = {}) {
  const response = await fetch(`${API_ORIGIN}${path}`, { ...options, headers: { "content-type": "application/json", ...(options.headers ?? {}) }, body: options.body ? JSON.stringify(options.body) : undefined });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? "request_failed");
  return data;
}
function base64UrlToUint8Array(value) { const padded = value + "=".repeat((4 - value.length % 4) % 4); const binary = atob(padded.replace(/-/g, "+").replace(/_/g, "/")); return Uint8Array.from(binary, (character) => character.charCodeAt(0)); }
function messageFor(error) { return error instanceof Error ? ({ link_expired: "Web側からもう一度接続してください。", push_unavailable: "通知の準備中です。" })[error.message] ?? "Chrome接続に失敗しました。" : "Chrome接続に失敗しました。"; }
