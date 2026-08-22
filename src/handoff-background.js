import { handoffApi, handoffError } from "./handoff-client.js";

const CREDENTIAL_KEY = "handoff-extension-credential";
const EVENTS_KEY = "handoff-extension-events";
const POLL_ALARM = "handoff-extension-poll";

chrome.runtime.onInstalled.addListener(() => { chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 }); });
chrome.runtime.onStartup.addListener(() => { chrome.alarms.create(POLL_ALARM, { periodInMinutes: 1 }); void refresh(); });
chrome.alarms.onAlarm.addListener((alarm) => { if (alarm.name === POLL_ALARM) void refresh(); });
chrome.notifications.onClicked.addListener((notificationId) => {
  if (!notificationId.startsWith("handoff:")) return;
  void chrome.tabs.create({ url: chrome.runtime.getURL(`options.html#event=${encodeURIComponent(notificationId.slice("handoff:".length))}`) });
});
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message).then(sendResponse, (error) => sendResponse({ ok: false, error: messageFor(error) }));
  return true;
});

async function handleMessage(message) {
  switch (message?.type) {
    case "handoff.get": return { ok: true, state: await getState() };
    case "handoff.create": return { ok: true, state: await createPair(message.label) };
    case "handoff.status": return { ok: true, state: await refresh() };
    case "handoff.confirm": return { ok: true, state: await confirmPair() };
    case "handoff.revoke": return { ok: true, state: await revokePair() };
    default: throw handoffError("request_failed");
  }
}

async function createPair(label = "Chrome拡張") {
  const pair = await handoffApi("/api/v1/pairs", { method: "POST", body: { receiver: "extension", label } });
  const credential = { ...pair, role: "web", status: "pending" };
  await chrome.storage.local.set({ [CREDENTIAL_KEY]: credential, [EVENTS_KEY]: [] });
  return getState();
}

async function confirmPair() {
  const credential = await getCredential();
  if (!credential) throw handoffError("not_paired");
  const response = await handoffApi(`/api/v1/pairs/${encodeURIComponent(credential.code)}/confirm`, { method: "POST", body: { role: "web", token: credential.token } });
  await chrome.storage.local.set({ [CREDENTIAL_KEY]: { ...credential, status: response.status } });
  return refresh();
}

async function revokePair() {
  const credential = await getCredential();
  if (credential?.status === "paired") await handoffApi(`/api/v1/pairs/${encodeURIComponent(credential.code)}/revoke`, { method: "POST", body: { role: "web", token: credential.token } });
  await clearState();
  return getState();
}

async function refresh() {
  const credential = await getCredential();
  if (!credential) return getState();
  let detail;
  try {
    detail = await handoffApi(`/api/v1/pairs/${encodeURIComponent(credential.code)}/status`, { headers: { authorization: `Bearer ${credential.token}`, "x-qr-role": "web" } });
  } catch (error) {
    if (["unauthorized", "not_found"].includes(error?.code)) await clearState();
    throw error;
  }
  const updated = { ...credential, ...detail, role: "web" };
  if (["expired", "revoked"].includes(updated.status)) {
    await clearState();
    return getState();
  }
  await chrome.storage.local.set({ [CREDENTIAL_KEY]: updated });
  if (updated.status === "paired") await refreshEvents(updated);
  return getState();
}

async function refreshEvents(credential) {
  const data = await handoffApi(`/api/v1/pairs/${encodeURIComponent(credential.code)}/events?receiver=${encodeURIComponent(credential.receiverId)}`, { headers: { authorization: `Bearer ${credential.token}` } });
  const now = Date.now();
  const existing = (await getEvents()).filter((event) => event.expiresAt > now);
  const known = new Set(existing.map((event) => event.id));
  const added = data.events.filter((event) => !known.has(event.id));
  const events = [...added, ...existing].sort((a, b) => b.createdAt - a.createdAt);
  await chrome.storage.local.set({ [EVENTS_KEY]: events });
  for (const event of added) await chrome.notifications.create(`handoff:${event.id}`, { type: "basic", title: "QR Scan に届きました", message: event.host ?? "新しい読み取り結果", iconUrl: chrome.runtime.getURL("icon-128.png") });
}

async function getState() {
  const [credential, events] = await Promise.all([getCredential(), getEvents()]);
  return { credential: credential ? publicCredential(credential) : null, events: events.filter((event) => event.expiresAt > Date.now()) };
}
async function getCredential() { return (await chrome.storage.local.get(CREDENTIAL_KEY))[CREDENTIAL_KEY] ?? null; }
async function getEvents() { return (await chrome.storage.local.get(EVENTS_KEY))[EVENTS_KEY] ?? []; }
async function clearState() { await chrome.storage.local.remove([CREDENTIAL_KEY, EVENTS_KEY]); }
function publicCredential(credential) { const { token: _token, ...publicValue } = credential; return publicValue; }
function messageFor(error) { return error instanceof Error ? error.message : "PC連携を完了できませんでした。"; }
